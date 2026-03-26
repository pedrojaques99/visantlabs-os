/**
 * Centralized state management
 * Best practice: Single source of truth, immutable updates via events
 */

const state = {
  // Selection state
  selectionDetails: [],
  selectionThumb: null,

  // Brand configuration
  logos: [
    { id: 'light', label: 'Light Mode', value: null },
    { id: 'dark', label: 'Dark Mode', value: null },
    { id: 'accent', label: 'Accent', value: null }
  ],
  typography: [
    { id: 'primary', label: 'Primary', value: null },
    { id: 'secondary', label: 'Secondary', value: null }
  ],
  selectedColors: new Map(), // id -> { name, value, role }

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
  anthropicApiKey: '',
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

  // Page scan toggle
  scanPage: false,

  // Auth & Credits
  authToken: null,       // JWT token from Visant login
  authEmail: null,       // Authenticated user email
  credits: {
    total: 0,
    remaining: 0,
    freeRemaining: 4,
    tier: 'free',        // 'free' | 'premium' | 'pro'
    hasSubscription: false,
  },
  canGenerate: true,     // Whether user can generate (credits available)

  // Design System (imported from JSON, stored in Figma file)
  designSystem: null, // Parsed design system object or null
  brandGuideline: null, // BrandGuideline v2 (unified, server-synced)
  designTokens: { spacing: {}, radius: {}, shadows: {} }, // Local tokens (spacing, radius, shadows)
  linkedGuidelineId: null, // ID of linked brand guideline from API
  linkedGuideline: null, // Full guideline object from API
  apiGuidelines: [], // List of guidelines from API

  // UI Components (captured from file)
  selectedUIComponents: {}, // { button: {...}, card: {...}, ... }
  customComponentTypes: [], // ['Header', 'Footer', ...]
  activeComponentCapture: null, // Type being captured
  availableComponents: [], // Components available in file

  // Media attachments
  pendingAttachments: [], // Array of { name, type, mimeType, size, dataUrl }

  // Image generation settings
  selectedFrameSize: '16:9-800x450', // Format: "aspectRatio-widthxheight" or "custom"
  selectedResolution: 'HD', // 'HD', '1K', '2K', '4K'
  customWidth: 800,
  customHeight: 450,
  selectedModel: 'gemini-2.5-flash-image', // 'gemini-2.5-flash-image' or 'gemini-3-pro-image-preview'

  // Think mode: LLM analyzes context + asks questions before generating any nodes
  thinkMode: false,
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
  const hasLogo = state.logos.some(l => !!l.value);
  const hasFont = state.typography.some(t => !!t.value);
  return hasLogo || hasFont || state.selectedColors.size > 0;
}

/**
 * Helper: Get brand summary
 */
function getBrandSummary() {
  const items = [];
  const configuredLogos = state.logos.filter(l => !!l.value);
  if (configuredLogos.length > 0) items.push(`Logos: ${configuredLogos.length}`);

  const configuredFonts = state.typography.filter(t => !!t.value);
  if (configuredFonts.length > 0) items.push(`Fonts: ${configuredFonts.length}`);

  if (state.selectedColors.size > 0) items.push(`Colors: ${state.selectedColors.size}`);
  return items.length > 0 ? items.join(' • ') : 'Brand não configurada';
}
