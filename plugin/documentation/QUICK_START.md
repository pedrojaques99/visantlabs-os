# Visant Copilot Plugin - Quick Start Guide

## 🚀 Getting Started

### What You Have
A fully modular, feature-rich Figma plugin with:
- Progressive disclosure (Simple vs Advanced modes)
- Chat-based design generation with AI
- Brand guidelines management
- Component library with search
- Multi-model AI (Claude + Gemini)
- Chat history with session memory

### What to Do Next

#### Option 1: Test in Figma
1. Open Figma
2. Go to Plugins → Development → Import plugin from manifest
3. Select `plugin/manifest.json` from this directory
4. Plugin loads in Figma
5. Open plugin panel
6. **Check console (F12)** for initialization messages:
   ```
   [Plugin] Initializing with modular architecture...
   [Plugin] Initialization complete
   [Plugin] Mode: simple
   [Plugin] Session: [UUID]
   ```

#### Option 2: Build for Production
```bash
cd plugin
npm run build
# Creates plugin/dist/code.js with compiled TypeScript
```

#### Option 3: Deploy to Server
```bash
# Build the Next.js server
npm run build

# Start server
npm start
# Server runs on http://localhost:3000
# API available at http://localhost:3000/api/plugin
```

---

## 📖 Documentation Structure

```
plugin/
├── ui.html                    # Main UI (updated for modular system)
├── ui.css                     # Styles (includes progressive disclosure)
├── ui-refactored.js          # Entry point & initialization
├── modules/                   # Modular architecture
│   ├── EventEmitter.js        # Global event bus
│   ├── state.js               # Centralized state management
│   ├── api.js                 # Server communication
│   ├── chat.js                # Chat UI & messaging
│   ├── brand.js               # Brand guidelines management
│   ├── library.js             # Component library
│   └── uiManager.js           # Main UI coordinator
├── src/code.ts                # Figma plugin sandbox code
├── manifest.json              # Plugin configuration
├── MODULAR_UI_GUIDE.md        # Complete architecture docs
├── INTEGRATION_CHECKLIST.md   # Testing procedures
├── FIXES_APPLIED.md           # What was fixed
└── QUICK_START.md             # This file
```

---

## 🎯 Key Features

### 1. Progressive Disclosure
- **Simple Mode**: Clean chat interface only
- **Advanced Mode**: Chat + Operations Log + JSON Preview
- **Toggle**: Click "Avançado" checkbox in header
- **Persistent**: Preference saved to localStorage

### 2. Chat Interface
- Type messages to describe designs
- Get AI-generated operations
- See operations applied in real-time
- Chat history persists per session

### 3. Brand Guidelines
- Save logos, fonts, colors
- Create brand presets
- Apply brand to all generated designs
- Stored in Figma document (syncs across team)

### 4. Component Library
- Browse all components in file
- Organize by folder (toggle view)
- Search and filter
- View thumbnails

### 5. Advanced Features (Mode Toggle)
- See all operations generated
- View full JSON response
- Debug AI decisions
- Understand what's being applied

---

## 🔌 How It Works

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│  Plugin UI (Iframe)                   Figma Sandbox (Main)   │
│  ┌─────────────────────────────┐      ┌────────────────────┐│
│  │  ui.html + modules          │      │  code.ts           ││
│  │  - EventEmitter (event bus) │◄────►│  - Operations      ││
│  │  - state.js (centralized)   │      │  - Selection       ││
│  │  - api.js (server comm)     │      │  - Components      ││
│  │  - chat.js (UI)             │      │  - Serialization   ││
│  │  - brand.js (settings)      │      │  - Thumbnails      ││
│  │  - library.js (components)  │      │                    ││
│  │  - uiManager.js (coordinator)│     │                    ││
│  └─────────────────────────────┘      └────────────────────┘│
│         ▲                                       ▲               │
│         │      postMessage API                 │               │
│         └───────────────────────────────────────┘               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         │
         │ fetch() / POST requests
         │
    ┌────▼────────────────────────────────┐
    │  Server (/api/plugin)                │
    │  - Claude Opus 4.6 (complex tasks)   │
    │  - Gemini 2.5 Flash (fast queries)   │
    │  - Intelligent routing               │
    │  - MongoDB session storage           │
    │  - Chat history (24h TTL)            │
    └─────────────────────────────────────┘
```

### Data Flow
1. **User types message** → ChatModule
2. **Message sent** → api.js → generateDesign()
3. **generateDesign()** → Sends context to server
4. **Server** → Chooses AI provider → Generates operations
5. **Response** → api.js emits event
6. **uiManager listens** → Shows operations in advanced mode
7. **Operations applied** → Figma sandbox processes them
8. **Result shown** → UI updates, chat history saved

---

## 🧪 Testing Checklist

Quick tests to verify everything works:

### 1. Initialization ✅
- [ ] Console shows no errors
- [ ] All 4 initialization log messages appear
- [ ] Mode defaults to "simple"

### 2. Mode Toggle ✅
- [ ] Click "Avançado" checkbox
- [ ] Advanced panel appears (Operações + JSON)
- [ ] Click again, panel disappears
- [ ] Refresh page, mode preference restored

### 3. Chat ✅
- [ ] Type a message in chat input
- [ ] Click send (or press Enter)
- [ ] Message appears, input clears
- [ ] Loading indicator shows
- [ ] Assistant response appears

### 4. Brand Settings ✅
- [ ] Click 🎨 Brand pill
- [ ] Settings view opens
- [ ] Can select colors/fonts
- [ ] Can save guideline
- [ ] Can reload guideline

### 5. Component Library ✅
- [ ] See component list in settings
- [ ] Can search components
- [ ] Can toggle folder view
- [ ] Thumbnails load

### 6. Advanced Mode ✅
- [ ] In advanced mode, send a message
- [ ] Operations appear in Operations Log
- [ ] JSON preview shows full response
- [ ] Operations are numbered and typed

---

## 🎮 User Workflows

### Workflow 1: Generate Design with Brand
1. Click 🎨 Brand → Select colors, font, logo
2. Type in chat: "Create a landing page header with the brand colors"
3. See operations generated
4. Design appears in Figma
5. Adjust if needed, regenerate

### Workflow 2: Debug Operations
1. Click "Avançado" (enable advanced mode)
2. Generate a design
3. See exact operations in Operations Log
4. View JSON to understand structure
5. Useful for understanding AI decisions

### Workflow 3: Create Component Variants
1. Select a component in library
2. Type: "Create 3 variants of this component"
3. See CREATE_COMPONENT and COMBINE_AS_VARIANTS operations
4. Variants appear in Figma

### Workflow 4: Brand Guidelines Presets
1. Set up colors, fonts, logo
2. Click save guideline
3. Name it (e.g., "Summer Campaign")
4. Next time, just select from dropdown
5. All brand settings instantly applied

---

## 🔧 Configuration

### Environment Variables
```bash
# Server side (.env.local)
DATABASE_URL=mongodb://...        # For chat history
CLAUDE_API_KEY=sk-...             # For Claude Opus
GEMINI_API_KEY=AIza...            # For Gemini Flash
```

### Plugin Settings (plugin/manifest.json)
```json
{
  "name": "Visant Copilot",
  "ui": "ui.html",
  "permissions": [
    "currentuser",
    "fileLibrary"
  ],
  "networkAccess": {
    "domains": [
      "https://api.anthropic.com",    // Claude API
      "https://generativelanguage.googleapis.com"  // Gemini API
    ]
  }
}
```

---

## 🐛 Troubleshooting

### Issue: Plugin shows errors on startup
**Solution**:
1. Check browser console (F12)
2. Look for "[Plugin]" log messages
3. If missing, modules didn't load
4. Verify all script tags in ui.html

### Issue: Mode toggle doesn't work
**Solution**:
1. Check localStorage: `localStorage.getItem('copilot_mode')`
2. Should be 'simple' or 'advanced'
3. Check that #modeToggle element exists in HTML

### Issue: Chat messages don't send
**Solution**:
1. Check if server is running
2. Check API endpoint: /api/plugin should exist
3. Check browser console for fetch errors
4. Verify API key is set (if required)

### Issue: Advanced panel is empty
**Solution**:
1. Make sure "Avançado" is checked
2. Generate a design first
3. Operations only appear after generation
4. Check that api.js emits events correctly

---

## 📚 Additional Resources

- **MODULAR_UI_GUIDE.md** - Complete architecture documentation
- **INTEGRATION_CHECKLIST.md** - Detailed testing procedures
- **FIXES_APPLIED.md** - What was fixed and why
- **PLUGIN_DOCS.md** - Figma plugin-specific documentation
- **plugin/src/code.ts** - Full sandbox implementation (1367 lines)

---

## 🎓 Learning Path

If you want to understand the codebase:

1. **Start Here**: Read MODULAR_UI_GUIDE.md
2. **Then**: Read ui-refactored.js (entry point)
3. **Then**: Read modules in order:
   - EventEmitter.js (how events work)
   - state.js (how state works)
   - api.js (how server communication works)
   - chat.js (how UI updates)
4. **Advanced**: Read plugin/src/code.ts (sandbox operations)

---

## 🚀 Next Steps

### To Deploy
```bash
# 1. Build everything
npm run build

# 2. Start server
npm start

# 3. Test in Figma
# Go to Plugins → Development → Import plugin from manifest

# 4. Verify all tests pass
# See INTEGRATION_CHECKLIST.md for full test suite
```

### To Extend
1. Add new modules to `plugin/modules/`
2. Use EventBus for communication
3. Use setState/getState for state
4. Follow the pattern in existing modules
5. Update MODULAR_UI_GUIDE.md

### To Debug
```javascript
// In browser console
eventBus.on('state:changed', (data) => console.log('State:', data));
eventBus.on('api:design-generated', (result) => console.log('Operations:', result.operations));
```

---

## 📞 Support

- Check console logs (start with [Plugin])
- Review INTEGRATION_CHECKLIST.md for testing
- Check MODULAR_UI_GUIDE.md for architecture
- Read plugin/src/code.ts for detailed implementation

---

**Last Updated**: March 3, 2026
**Version**: 1.0 - Complete Modular System
**Status**: 🟢 Ready for Testing & Deployment
