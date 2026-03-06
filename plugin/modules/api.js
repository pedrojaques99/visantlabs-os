/**
 * API module - Centralized server communication
 * Best practice: Single point for all network requests
 */

// Use an absolute URL because Figma plugins run in a data: origin where relative fetch() fails
const API_BASE = 'http://localhost:3001/api'; // Change to https://www.visantlabs.com/api for production

/**
 * Generic fetch wrapper with error handling
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method
 * @param {any} body - Request body
 * @returns {Promise<any>}
 */
async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const headers = { 'Content-Type': 'application/json' };

    // Include auth token if available
    if (state.authToken) {
      headers['Authorization'] = `Bearer ${state.authToken}`;
    }

    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);

    // Handle credit exhaustion gracefully
    if (response.status === 403) {
      const data = await response.json();
      if (data.code === 'NO_CREDITS') {
        setState('canGenerate', false);
        eventBus.emit('auth:no-credits', data.error);
        throw new Error(data.error);
      }
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[API] ${method} ${endpoint}:`, error);
    eventBus.emit('api:error', { endpoint, method, error: error.message });
    throw error;
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
    selectedLogo: state.logoLight || state.logoDark || state.logoAccent || null,
    brandLogos: {
      light: state.logoLight || null,
      dark: state.logoDark || null,
      accent: state.logoAccent || null,
    },
    selectedBrandFont: state.fontPrimary || null,
    brandFonts: {
      primary: state.fontPrimary || null,
      secondary: state.fontSecondary || null,
    },
    selectedBrandColors: Array.from(state.selectedColors.values()),
    availableComponents: state.allComponents,
    availableColorVariables: state.allColors,
    availableFontVariables: state.allFonts,
    availableLayers: context.availableLayers || [],
    mentions: context.mentions || [],
    designSystem: state.designSystem || undefined,
    attachments: (context.attachments || []).map(att => ({
      name: att.name,
      mimeType: att.mimeType,
      data: att.dataUrl.split(',')[1], // Remove data: prefix
    })),
    apiKey: state.userApiKey || undefined,
    anthropicApiKey: state.anthropicApiKey || undefined,
  };

  try {
    const result = await apiCall('/plugin', 'POST', payload);
    if (result.operations) {
      eventBus.emit('api:design-generated', result);
      return result.operations;
    }
    return [];
  } catch (error) {
    eventBus.emit('api:design-error', error);
    throw error;
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
 * Reuses existing /api/auth/login endpoint
 */
async function authLogin(email, password) {
  try {
    const result = await apiCall('/auth/login', 'POST', { email, password });
    if (result.token) {
      setState('authToken', result.token);
      setState('authEmail', email);
      saveAuthToken(result.token);
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
    }
    return data;
  } catch (_e) {
    // Fail silently — BYOK users may not have accounts
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
