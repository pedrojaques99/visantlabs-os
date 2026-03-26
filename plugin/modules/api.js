/**
 * API module - Centralized server communication
 * Best practice: Single point for all network requests
 */

// Use an absolute URL because Figma plugins run in a data: origin where relative fetch() fails
let API_BASE = 'https://www.visantlabs.com/api';

// Dynamic detection for development mode (ngrok or localhost)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  API_BASE = 'http://localhost:3001/api'; // Direct to backend
} else if (window.location.hostname.includes('ngrok')) {
  API_BASE = window.location.origin + '/api';
} else if (window.location.protocol === 'file:' || window.location.protocol === 'data:') {
  // If loaded directly into Figma but the user is actively running the dev server, we can
  // explicitly use localhost for dev purposes. When deploying, build with production API_BASE.
  // We check if we're in development using a Vite/Next hint if it existed, otherwise fallback:
  API_BASE = 'http://localhost:3001/api'; // <--- Hardcoded for user's local development
}

// Active request abort controller (one at a time)
let _abortController = null;

/**
 * Cancel the currently in-flight API request (stop button)
 */
function cancelCurrentRequest() {
  if (_abortController) {
    _abortController.abort();
    _abortController = null;
  }
}

/**
 * Generic fetch wrapper with error handling
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {any} body - Request body
 * @returns {Promise<any>} null if request was cancelled
 */
async function apiCall(endpoint, method = 'GET', body = null) {
  _abortController = new AbortController();
  const signal = _abortController.signal;

  try {
    const headers = { 'Content-Type': 'application/json' };

    // Include auth token if available
    if (state.authToken) {
      headers['Authorization'] = `Bearer ${state.authToken}`;
    }

    const options = { method, headers, signal };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);

    // Try to parse JSON error response for better messages
    if (!response.ok) {
      let errorData = null;
      try {
        errorData = await response.json();
      } catch (_e) {
        // Response is not JSON, will use status text
      }

      // Handle specific status codes with user-friendly messages
      if (response.status === 401) {
        // Token expired or invalid
        const msg = errorData?.error || 'Sessão expirada. Faça login novamente.';
        console.warn(`[API] Auth error (401): ${msg}`);
        eventBus.emit('auth:session-expired', { endpoint, error: msg });
        throw new Error(msg);
      }

      if (response.status === 403) {
        // Forbidden - check for specific codes
        if (errorData?.code === 'NO_CREDITS') {
          setState('canGenerate', false);
          eventBus.emit('auth:no-credits', errorData.error);
          throw new Error(errorData.error);
        }
        const msg = errorData?.error || 'Acesso negado.';
        throw new Error(msg);
      }

      if (response.status === 429) {
        // Rate limited
        const msg = errorData?.error || 'Muitas tentativas. Aguarde alguns minutos.';
        console.warn(`[API] Rate limited (429): ${msg}`);
        eventBus.emit('auth:rate-limited', { endpoint, error: msg });
        throw new Error(msg);
      }

      if (response.status >= 500) {
        // Server error
        const msg = errorData?.message || 'Erro no servidor. Tente novamente.';
        console.error(`[API] Server error (${response.status}):`, errorData || response.statusText);
        throw new Error(msg);
      }

      // Other client errors (400, 404, etc)
      const msg = errorData?.error || errorData?.message || `Erro: ${response.statusText}`;
      throw new Error(msg);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`[API] Request cancelled: ${endpoint}`);
      return null; // Cancelled — not an error
    }
    // Network errors (offline, CORS, etc)
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error(`[API] Network error:`, error);
      eventBus.emit('api:error', { endpoint, method, error: 'Sem conexão com o servidor.' });
      throw new Error('Sem conexão com o servidor. Verifique sua internet.');
    }
    console.error(`[API] ${method} ${endpoint}:`, error);
    eventBus.emit('api:error', { endpoint, method, error: error.message });
    throw error;
  } finally {
    _abortController = null;
  }
}

/**
 * Generate design operations from AI
 * @param {string} command - User command
 * @param {any} context - Design context
 * @returns {Promise<Array>}
 */
async function generateDesign(command, context) {
  const payload = {
    command,
    sessionId: state.sessionId, // For chat memory
    fileId: context.fileId,
    selectedElements: context.selectedElements || [],
    // Brand: send the primary logo (logoLight) as selectedLogo for backward compat,
    // plus all 3 variants in brandLogos for richer context
    // Brand: send the first logo as default, plus all variants
    selectedLogo: (state.logos && state.logos.length > 0) ? state.logos[0].value : null,
    brandLogos: state.logos,
    selectedBrandFont: (state.typography && state.typography.length > 0) ? state.typography[0].value : null,
    brandFonts: state.typography,
    selectedBrandColors: Array.from(state.selectedColors.values()),
    availableComponents: state.allComponents,
    availableColorVariables: state.allColors,
    availableFontVariables: state.allFonts,
    availableLayers: context.availableLayers || [],
    mentions: context.mentions || [],
    designSystem: state.designSystem || undefined,
    brandGuideline: state.brandGuideline || undefined,
    designTokens: state.designTokens || undefined,
    selectedUIComponents: state.selectedUIComponents || undefined,
    attachments: (context.attachments || []).map(att => ({
      name: att.name,
      mimeType: att.mimeType,
      // Use pre-stripped data from sandbox, or strip dataUrl prefix as fallback
      data: att.data || (att.dataUrl ? att.dataUrl.split(',')[1] : ''),
    })),
    apiKey: state.userApiKey || undefined,
    anthropicApiKey: state.anthropicApiKey || undefined,
    thinkMode: context.thinkMode || false,
  };

  try {
    const result = await apiCall('/plugin', 'POST', payload);
    if (result === null) {
      // Request was cancelled by user (stop button)
      return [];
    }
    if (result.operations) {
      eventBus.emit('api:design-generated', result);
      return result.operations;
    }
    return [];
  } catch (error) {
    throw error; // api:error (from apiCall) already handles user-visible display
  }
}

/**
 * Save API key to plugin storage
 * @param {string} key - API key
 */
function saveApiKey(key) {
  parent.postMessage(
    {
      pluginMessage: { type: 'SAVE_API_KEY', key },
    },
    'https://www.figma.com'
  );
}

/**
 * Load saved API key
 */
function loadApiKey() {
  parent.postMessage(
    { pluginMessage: { type: 'GET_API_KEY' } },
    'https://www.figma.com'
  );
}

/**
 * Save Anthropic API key to plugin storage
 * @param {string} key - API key
 */
function saveAnthropicKey(key) {
  parent.postMessage(
    { pluginMessage: { type: 'SAVE_ANTHROPIC_KEY', key } },
    'https://www.figma.com'
  );
}

/**
 * Load saved Anthropic API key
 */
function loadAnthropicKey() {
  parent.postMessage(
    { pluginMessage: { type: 'GET_ANTHROPIC_KEY' } },
    'https://www.figma.com'
  );
}

/**
 * Save brand guideline
 * @param {any} guideline - Guideline object
 */
function saveBrandGuideline(guideline) {
  parent.postMessage(
    {
      pluginMessage: { type: 'SAVE_GUIDELINE', guideline },
    },
    'https://www.figma.com'
  );
}

/**
 * Delete brand guideline
 * @param {string} id - Guideline ID
 */
function deleteBrandGuideline(id) {
  parent.postMessage(
    {
      pluginMessage: { type: 'DELETE_GUIDELINE', id },
    },
    'https://www.figma.com'
  );
}

/**
 * Load saved guidelines from plugin storage
 */
function loadGuidelines() {
  parent.postMessage(
    { pluginMessage: { type: 'GET_GUIDELINES' } },
    'https://www.figma.com'
  );
}

/**
 * Save design system JSON to Figma file (figma.root.setPluginData)
 * Pass null to clear the stored design system.
 * @param {any|null} designSystem - Normalized design system object or null
 */
function saveDesignSystem(designSystem) {
  parent.postMessage(
    { pluginMessage: { type: 'SAVE_DESIGN_SYSTEM', designSystem } },
    'https://www.figma.com'
  );
}

/**
 * Load the design system stored in this Figma file
 */
function loadDesignSystem() {
  parent.postMessage(
    { pluginMessage: { type: 'GET_DESIGN_SYSTEM' } },
    'https://www.figma.com'
  );
}

/**
 * Request design context from sandbox
 */
function getContext() {
  parent.postMessage(
    { pluginMessage: { type: 'GET_CONTEXT' } },
    'https://www.figma.com'
  );
}

/**
 * Generate with full context (for chat flow)
 * @param {string} command - User command
 * @param {any} context - Additional context
 */
function generateWithContext(command, context) {
  parent.postMessage(
    {
      pluginMessage: {
        type: 'GENERATE_WITH_CONTEXT',
        command,
        scanPage: state.scanPage || false,
        // Send primary logo for backward compat + all variants
        logoComponent: state.logoLight || state.logoDark || state.logoAccent || null,
        brandLogos: {
          light: state.logoLight || null,
          dark: state.logoDark || null,
          accent: state.logoAccent || null,
        },
        brandFont: state.fontPrimary || null,
        brandFonts: {
          primary: state.fontPrimary || null,
          secondary: state.fontSecondary || null,
        },
        brandColors: Array.from(state.selectedColors.values()),
        designSystem: state.designSystem || undefined,
        thinkMode: state.thinkMode || false,
        mentions: context.mentions || [],
        attachments: (context.attachments || []).map(att => ({
          name: att.name,
          mimeType: att.mimeType,
          data: att.dataUrl.split(',')[1], // Remove data:image/png;base64, prefix
        })),
      },
    },
    'https://www.figma.com'
  );
}

/**
 * Apply operations to Figma
 * @param {Array} operations - Figma operations
 */
function applyOperations(operations) {
  parent.postMessage(
    {
      pluginMessage: {
        type: 'APPLY_OPERATIONS',
        payload: operations,
      },
    },
    'https://www.figma.com'
  );
}

/**
 * Delete current selection
 */
function deleteSelection() {
  parent.postMessage(
    { pluginMessage: { type: 'DELETE_SELECTION' } },
    'https://www.figma.com'
  );
}

/**
 * Open URL in browser
 * @param {string} url - URL to open
 */
function openExternal(url) {
  parent.postMessage(
    { pluginMessage: { type: 'OPEN_EXTERNAL', url } },
    'https://www.figma.com'
  );
}



// ── Auth & Credits ──

/**
 * Login with email/password → gets JWT token
 * Handles the plugin local authentication
 */
async function authLogin(email, password, rememberMe = true) {
  try {
    const result = await apiCall('/auth/signin', 'POST', { email, password });
    if (result.token) {
      setState('authToken', result.token);
      setState('authEmail', email);

      if (rememberMe) {
        saveAuthToken(result.token);
      } else {
        // Clear explicitly so that if they reopen the plugin, they are asked to log in again
        saveAuthToken('');
      }

      await fetchAuthStatus();
      eventBus.emit('auth:login-success', { email });
      return { success: true };
    }
    return { success: false, error: 'Token não recebido' };
  } catch (error) {
    eventBus.emit('auth:login-error', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch auth status and credits from server
 * Calls GET /api/plugin/auth/status
 */
async function fetchAuthStatus() {
  try {
    const data = await apiCall('/plugin/auth/status');
    if (data.authenticated) {
      setState('authEmail', data.email);
      setState('credits', {
        total: data.totalCredits,
        remaining: data.creditsRemaining,
        freeRemaining: data.freeGenerationsRemaining,
        tier: data.subscriptionTier,
        hasSubscription: data.hasActiveSubscription,
      });
      setState('canGenerate', data.canGenerate);
    } else if (state.authToken) {
      // We have a token but server says not authenticated = session expired
      console.warn('[API] Session expired - clearing auth state');
      setState('authToken', null);
      setState('authEmail', null);
      setState('canGenerate', true);
      saveAuthToken(''); // Clear from storage
      eventBus.emit('auth:session-expired', { reason: 'Token inválido ou expirado' });
    }
    return data;
  } catch (error) {
    // If we have a token but request failed, check if it's auth related
    if (state.authToken && error.message?.includes('401')) {
      console.warn('[API] Auth status failed with 401 - session expired');
      setState('authToken', null);
      setState('authEmail', null);
      saveAuthToken('');
      eventBus.emit('auth:session-expired', { reason: error.message });
    }
    // Fail silently for other errors — BYOK users may not have accounts
    return { authenticated: false, canGenerate: true };
  }
}

/**
 * Save auth token to sandbox (figma.clientStorage)
 */
function saveAuthToken(token) {
  parent.postMessage(
    { pluginMessage: { type: 'SAVE_AUTH_TOKEN', token } },
    'https://www.figma.com'
  );
}

/**
 * Load auth token from sandbox
 */
function loadAuthToken() {
  parent.postMessage(
    { pluginMessage: { type: 'GET_AUTH_TOKEN' } },
    'https://www.figma.com'
  );
}

/**
 * Logout — clear token and reset credit state
 */
function logout() {
  setState('authToken', null);
  setState('authEmail', null);
  setState('canGenerate', true);
  setState('credits', {
    total: 0, remaining: 0, freeRemaining: 4,
    tier: 'free', hasSubscription: false,
  });
  // Clear from sandbox storage
  parent.postMessage(
    { pluginMessage: { type: 'SAVE_AUTH_TOKEN', token: '' } },
    'https://www.figma.com'
  );
  eventBus.emit('auth:logout');
}
