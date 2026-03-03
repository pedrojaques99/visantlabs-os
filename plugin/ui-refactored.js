/**
 * Visant Copilot Plugin - Refactored Entry Point
 *
 * Modular architecture with progressive disclosure
 * Load order is critical: EventEmitter → State → API → Modules → UI Manager
 *
 * Best practices:
 * - Event-driven communication between modules
 * - Centralized state management
 * - No circular dependencies
 * - Clean separation of concerns
 */

// ══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION SEQUENCE
// ══════════════════════════════════════════════════════════════════════════════

// Load order (DO NOT CHANGE):
// 1. EventEmitter.js - Global event bus
// 2. state.js - Centralized state
// 3. api.js - Server communication
// 4. chat.js - Chat module
// 5. brand.js - Brand guidelines module
// 6. library.js - Component library module
// 7. uiManager.js - Main UI coordinator
//
// Each module is self-contained and communicates only through:
// - eventBus.emit/on for events
// - setState/getState for state updates
// - API functions from api.js module

// ══════════════════════════════════════════════════════════════════════════════
// SESSION ID INITIALIZATION (Async via Sandbox)
// ══════════════════════════════════════════════════════════════════════════════

// Listen for session ID loaded from clientStorage
eventBus.on('state:session-loaded', (sessionId) => {
  if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
    // Save generated session ID back to clientStorage
    parent.postMessage({ pluginMessage: { type: 'SAVE_SESSION_ID', sessionId } }, '*');
  }
  state.sessionId = sessionId;
  console.log('[Plugin] Session: ' + state.sessionId);
});

// ══════════════════════════════════════════════════════════════════════════════
// MODULE INITIALIZATION HOOKS
// ══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  console.log('[Plugin] Initializing with modular architecture...');

  // Request initial context and persisted state from sandbox
  getContext();
  loadApiKey();
  loadAnthropicKey();
  parent.postMessage({ pluginMessage: { type: 'LOAD_PERSISTED_STATE' } }, '*');

  // Render initial state
  chatModule.renderMessages();
  brandModule.updateBrandPill();
  libraryModule.render();

  console.log('[Plugin] Initialization complete');
  console.log('[Plugin] Session: ' + state.sessionId);
});

// ══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING & LOGGING
// ══════════════════════════════════════════════════════════════════════════════

window.addEventListener('error', (event) => {
  console.error('[Plugin] Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Plugin] Unhandled promise rejection:', event.reason);
});

// Global logger
window.log = (msg, data = '') => {
  console.log(`[Plugin] ${msg}`, data);
};

window.logError = (msg, error = '') => {
  console.error(`[Plugin ERROR] ${msg}`, error);
};
