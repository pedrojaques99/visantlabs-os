# Modular UI System Integration Guide

## Overview

The Visant Copilot plugin UI has been refactored into a modular, event-driven architecture with progressive disclosure support (Simple vs Advanced modes).

### Architecture Principles

- **Event-Driven Communication**: Modules communicate via a centralized event bus (no direct dependencies)
- **Centralized State Management**: Single source of truth for all UI state
- **Separation of Concerns**: Each module has a single responsibility
- **Progressive Disclosure**: UI adapts based on Simple/Advanced mode toggle
- **No Circular Dependencies**: Modules are loaded in strict order

## Module Overview

### 1. **EventEmitter.js** (Load Order: 1st)
Global pub/sub event bus for module communication.

```javascript
// Usage
eventBus.on('event-name', (data) => { /* handle */ });
eventBus.emit('event-name', data);
eventBus.once('event-name', handler);
```

**Key Events**:
- `chat:operations-ready` - Operations generated from AI
- `chat:loading` - Loading state changes
- `context:updated` - Figma context updates
- `context:components-loaded` - Components available
- `brand:*` - Brand-related events
- `guideline:*` - Guideline changes
- `library:component-selected` - Component selection

### 2. **state.js** (Load Order: 2nd)
Centralized immutable state management.

```javascript
// Usage
setState('path.to.property', value);  // Update state
getState('path.to.property');         // Read state
watchState('path.to.property', callback); // Watch changes

// State structure
{
  mode: 'simple' | 'advanced',
  sessionId: string,
  chatHistory: Array,
  selectionDetails: Array,
  selectedLogo: Object | null,
  selectedFont: Object | null,
  selectedColors: Map,
  allComponents: Array,
  allColors: Array,
  allFonts: Array,
  savedGuidelines: Array,
  // ... more properties
}
```

**Helper Functions**:
- `isBrandConfigured()` - Check if brand is set
- `getBrandSummary()` - Get brand info text

### 3. **api.js** (Load Order: 3rd)
Centralized server communication.

```javascript
// Main API function
generateDesign(command, context)

// Plugin message methods
saveApiKey(key)
loadApiKey()
saveBrandGuideline(guideline)
deleteBrandGuideline(id)
loadGuidelines()
useSelectionAsLogo()
getContext()
applyOperations(operations)
generateWithContext(message, context)
```

### 4. **chat.js** (Load Order: 4th)
Chat UI and messaging module.

```javascript
class ChatModule {
  sendMessage()          // Send user message
  addUserMessage(text)   // Add to chat history
  addAssistantMessage(text)
  addErrorMessage(text)
  renderMessages()       // Render chat history
  setLoading(isLoading)  // Update loading state
  clearHistory()         // Clear chat
  escapeHtml(text)       // Security: XSS prevention
}
```

**Event Listeners**:
- Sends: `chat:loading` events
- Listens: `chat:loading`, `api:error`, `api:design-generated`

### 5. **brand.js** (Load Order: 5th)
Brand guidelines management.

```javascript
class BrandModule {
  updateBrandPill()              // Update brand indicator
  renderLogoSelection()          // Render selected logo
  renderFontSelection()          // Render selected font
  renderColorGrid()              // Render selected colors
  renderAvailableColors()        // Available colors list
  renderFontList()               // Available fonts list
  selectGuideline(id)            // Load guideline
  saveCurrentGuideline()         // Save as preset
  deleteCurrentGuideline()       // Delete preset
}
```

**Managed State**:
- `selectedLogo`, `selectedFont`, `selectedColors`
- `savedGuidelines`, `activeGuidelineId`
- `allColors`, `allFonts`, `allAvailableFonts`

### 6. **library.js** (Load Order: 6th)
Component library and folder management.

```javascript
class LibraryModule {
  render()                       // Render library
  renderFolderView()            // Hierarchical view
  renderListView()              // Flat list view
  buildFolderTree(components)   // Organize by path
  filterComponents(query)       // Search functionality
}
```

**Features**:
- Folder tree view with expand/collapse
- Component search filtering
- Component thumbnail display
- Click to select components

### 7. **uiManager.js** (Load Order: 7th)
Main UI coordinator and progressive disclosure.

```javascript
class UIManager {
  setupEventListeners()          // Bind all DOM events
  setupStateListeners()          // Watch state changes
  setupSandboxListeners()        // Handle Figma messages

  updateUIForMode(mode)          // Toggle simple/advanced
  showOperationsInAdvancedMode() // Show operations log
  updateSelectionIndicator()     // Update selection preview
  updateContextInfo(data)        // Show file context

  openSettings()                 // Show settings view
  closeSettings()                // Hide settings view
  focusChatInput()               // Focus on chat
}
```

**Progressive Disclosure**:
- Simple Mode: Chat interface only
- Advanced Mode: Chat + Operations Log + JSON Preview

### 8. **ui-refactored.js** (Load Order: 8th)
Entry point and initialization.

```javascript
// Session ID initialization
window.PLUGIN_SESSION_ID = sessionId;

// DOMContentLoaded handlers
// Initialize modules
// Render initial state
// Setup global error handling
```

## Module Load Order

**CRITICAL**: Modules must load in this exact order:

```html
<script src="./modules/EventEmitter.js"></script>
<script src="./modules/state.js"></script>
<script src="./modules/api.js"></script>
<script src="./modules/chat.js"></script>
<script src="./modules/brand.js"></script>
<script src="./modules/library.js"></script>
<script src="./modules/uiManager.js"></script>
<script src="./ui-refactored.js"></script>
```

**Why this order**:
1. EventEmitter needed by everything
2. State needs EventEmitter
3. API needs State and EventEmitter
4. Chat/Brand/Library need API, State, EventEmitter
5. UIManager needs all previous modules
6. ui-refactored initializes everything

## Communication Patterns

### State Changes Trigger UI Updates

```javascript
setState('mode', 'advanced');  // Change mode
// Automatically triggers:
// 1. watchState('mode', callback) listeners
// 2. uiManager.updateUIForMode('advanced')
// 3. Advanced panel becomes visible
```

### Event-Driven Messaging

```javascript
// In one module
eventBus.emit('chat:operations-ready', operations);

// In another module
eventBus.on('chat:operations-ready', (operations) => {
  this.showOperationsInAdvancedMode(operations);
});
```

### API Calls with Context

```javascript
// In chat.js
generateWithContext(message, { fileId: state.sessionId });

// In api.js
const response = await generateDesign(command, context);
// Returns: { operations: [], provider: 'claude' }
```

## HTML Integration

Key HTML elements required:

```html
<!-- Mode Toggle -->
<input type="checkbox" id="modeToggle">

<!-- Advanced Panel -->
<div id="advancedPanel" class="advanced-panel hidden">
  <div id="operationsLog" class="operations-log"></div>
  <div id="jsonPreview" class="json-preview"></div>
</div>

<!-- Main Views -->
<div id="mainView"></div>
<div id="settingsView"></div>

<!-- Module Elements -->
<div id="chatMessages"></div>
<textarea id="chatInput"></textarea>
<button id="sendBtn"></button>
<div id="colorGrid"></div>
<div id="fontList"></div>
<div id="componentsLibrary"></div>
```

## CSS Classes

### Advanced Mode
- `.advanced-panel` - Advanced feature container
- `.advanced-section` - Section within panel
- `.advanced-header` - Section header
- `.operations-log` - Operations list
- `.json-preview` - JSON display
- `.operation-item` - Single operation

### Library
- `.folder-section` - Folder group
- `.folder-header` - Folder header
- `.component-item` - Component in library
- `.comp-thumb` - Component thumbnail
- `.comp-info` - Component metadata

## State Watch Pattern

```javascript
// In module constructor
watchState('selectedColors', () => {
  this.renderColorGrid();
  this.updateBrandPill();
});

// Triggered whenever selectedColors changes
setState('selectedColors', newColors);
```

## Error Handling

Global error handlers in ui-refactored.js:

```javascript
window.addEventListener('error', (event) => {
  console.error('[Plugin] Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Plugin] Unhandled promise rejection:', event.reason);
});
```

Module-level error handling:

```javascript
// In api.js
catch (error) {
  chatModule.addErrorMessage(`❌ Error: ${error.message}`);
  eventBus.emit('chat:loading', false);
}
```

## Testing the Integration

1. **Check Console**: Look for initialization logs
   ```
   [Plugin] Initializing with modular architecture...
   [Plugin] Initialization complete
   [Plugin] Mode: simple
   [Plugin] Session: uuid
   ```

2. **Test Mode Toggle**: Click "Avançado" checkbox
   - Advanced panel should appear/disappear
   - Operations log should show when available

3. **Test Chat**: Type message and send
   - Should load operations from API
   - Advanced mode shows operation details

4. **Test Brand**: Click 🎨 Brand → Configure colors/fonts
   - Brand pill should turn active
   - Selections should persist via state

5. **Test Library**: View components
   - Should show folder tree (if toggled)
   - Search should filter results

## Performance Considerations

- **State Updates**: Use `setState` for efficiency (change detection)
- **Event Listeners**: Cleanup via `eventBus.removeAllListeners()`
- **DOM Rendering**: Only re-render on actual data changes
- **Scrolling**: Advanced panel max-height 300px (prevent massive DOM)
- **Thumbnails**: Lazy loaded via sandbox messages

## Extending the System

To add a new module:

1. Create `plugin/modules/newModule.js`
2. Define a class with constructor
3. Implement `setupEventListeners()`, `setupStateListeners()`
4. Use `eventBus.on/emit` and `setState/getState/watchState`
5. Add to ui.html script tags in correct order
6. Add module instantiation: `const newModule = new NewModule();`

Example:

```javascript
// plugin/modules/analytics.js
class AnalyticsModule {
  constructor() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    eventBus.on('chat:operations-ready', (ops) => {
      this.trackOperation(ops);
    });
  }

  trackOperation(operations) {
    // Send analytics
  }
}

const analyticsModule = new AnalyticsModule();
```

## Migration from Old System

Old system (`ui.js`) had:
- Global variables and functions
- Inline onclick handlers
- Direct DOM manipulation
- Monolithic 683-line file

New system provides:
- Event-driven architecture
- Modular classes
- Centralized state
- Clear separation of concerns
- Extensible foundation

The new system maintains backward compatibility via the `generateWithContext`, `setState`, etc. functions that the sandbox expects.

---

**Last Updated**: March 3, 2026
**Version**: 1.0 - Modular Progressive Disclosure UI
