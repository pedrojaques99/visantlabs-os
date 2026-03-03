/**
 * Centralized state management
 * Best practice: Single source of truth, immutable updates via events
 */

const state = {
  // Selection state
  selectionDetails: [],
  selectionThumb: null,

  // Brand configuration
  logoLight: null,
  logoDark: null,
  logoAccent: null,
  fontPrimary: null,
  fontSecondary: null,
  selectedColors: new Map(), // id -> { name, value }

  // Library state
  allComponents: [],
  componentThumbs: {}, // id -> base64 thumbnail
  expandedFolders: new Set(),
  showFolders: false,
  allFonts: [], // font variables
  allAvailableFonts: [], // all font families
  allColors: [], // all color variables

  // Settings & API
  userApiKey: '',
  apiCollapsed: true,

  // Tabs & UI
  activeModalTarget: null, // 'logoLight', 'fontPrimary', etc.

  // Brand guidelines
  savedGuidelines: [],
  activeGuidelineId: null,

  // Chat
  chatHistory: [
    {
      role: 'assistant',
      content: 'Olá! Descreva o que quer criar ou modificar. Configure as Brand Guidelines em ⚙ Configurações.',
      isError: false,
    },
  ],
  sessionId: (window.crypto && typeof window.crypto.randomUUID === 'function') ? window.crypto.randomUUID() : 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36), // For chat memory (FASE 3)

  // UI Mode (Progressive Disclosure)
  mode: 'simple', // 'simple' | 'advanced'
};

/**
 * Update state immutably and emit change event
 * @param {string} path - Dot-notation path to update (e.g., 'selectedLogo.id')
 * @param {any} value - New value
 */
function setState(path, value) {
  const parts = path.split('.');
  let current = state;

  // Navigate to parent
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]];
  }

  const key = parts[parts.length - 1];
  const oldValue = current[key];

  // Only update if changed
  if (oldValue !== value) {
    current[key] = value;
    eventBus.emit(`state:${path}`, value, oldValue);
    eventBus.emit('state:changed', { path, value, oldValue });
  }
}

/**
 * Get state value
 * @param {string} path - Dot-notation path (e.g., 'selectedLogo.id')
 * @returns {any}
 */
function getState(path) {
  const parts = path.split('.');
  let current = state;
  for (const part of parts) {
    current = current[part];
  }
  return current;
}

/**
 * Watch for state changes
 * @param {string} path - Path to watch
 * @param {Function} callback - Called when state changes
 * @returns {Function} Unwatch function
 */
function watchState(path, callback) {
  return eventBus.on(`state:${path}`, (newValue, oldValue) => {
    callback(newValue, oldValue);
  });
}

/**
 * Helper: Check if brand is configured
 */
function isBrandConfigured() {
  return !!state.logoLight || !!state.logoDark || !!state.logoAccent || !!state.fontPrimary || !!state.fontSecondary || state.selectedColors.size > 0;
}

/**
 * Helper: Get brand summary
 */
function getBrandSummary() {
  const items = [];
  if (state.logoLight) items.push(`L-Light: ${state.logoLight.name}`);
  if (state.logoDark) items.push(`L-Dark: ${state.logoDark.name}`);
  if (state.logoAccent) items.push(`L-Accent: ${state.logoAccent.name}`);
  if (state.fontPrimary) items.push(`F-Pri: ${state.fontPrimary.name}`);
  if (state.fontSecondary) items.push(`F-Sec: ${state.fontSecondary.name}`);
  if (state.selectedColors.size > 0) items.push(`Colors: ${state.selectedColors.size}`);
  return items.join(' • ');
}
