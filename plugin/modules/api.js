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
    const options = { method };
    if (body) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);
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
    selectedLogo: state.selectedLogo,
    selectedBrandFont: state.selectedFont,
    selectedBrandColors: Array.from(state.selectedColors.values()),
    availableComponents: state.allComponents,
    availableColorVariables: state.allColors,
    availableFontVariables: state.allFonts,
    availableLayers: context.availableLayers || [],
    apiKey: state.userApiKey || undefined,
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
        logoComponent: state.selectedLogo,
        brandFont: state.selectedFont,
        brandColors: Array.from(state.selectedColors.values()),
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

/**
 * Use selection as logo
 */
function useSelectionAsLogo() {
  parent.postMessage(
    { pluginMessage: { type: 'USE_SELECTION_AS_LOGO' } },
    'https://www.figma.com'
  );
}
