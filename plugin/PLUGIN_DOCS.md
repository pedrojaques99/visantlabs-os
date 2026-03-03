# Visant Copilot — Plugin Documentation

> Last updated: 2026-03-02. Covers `src/code.ts`, `ui.js`, `ui.html`, `ui.css`, `server/routes/plugin.ts`, `src/lib/figma-types.ts`.

---

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│  Figma Desktop                               │
│  ┌─────────────────┐   postMessage   ┌────────────────────┐
│  │  Sandbox        │◄───────────────►│  UI (iframe)       │
│  │  src/code.ts    │                 │  ui.js + ui.html   │
│  └────────┬────────┘                 └────────┬───────────┘
│           │ figma.* API                        │ fetch()
│           │                                   ▼
│           │               ┌─────────────────────────────────┐
│           │               │  visantlabs.com/api/plugin       │
│           │               │  server/routes/plugin.ts        │
│           │               │  (Gemini AI → FigmaOperation[]) │
│           │               └─────────────────────────────────┘
│           │ applyOperations()
│           ▼ figma.currentPage / nodes
└──────────────────────────────────────────────┘
```

**Message flow for a chat command:**
1. User types → `sendChat()` → `postMessage(GENERATE_WITH_CONTEXT)`
2. Sandbox serializes selection + context → `postMessage(CALL_API)`
3. UI `fetch()` → `/api/plugin` → Gemini → `FigmaOperation[]`
4. UI `postMessage(APPLY_OPERATIONS_FROM_API)` → Sandbox `applyOperations()`

---

## `src/code.ts` — Plugin Sandbox

Runs in Figma's QuickJS environment. No browser APIs.

### Entry point
```
figma.showUI(__html__, { width: 420, height: 680, themeColors: true })
figma.on('selectionchange', notifyContextChange)
figma.ui.onmessage = async (msg) => { ... }
```

### Node Serialization

| Function | Purpose |
|---|---|
| `serializeNode(node, depth=0)` | Recursively serializes a SceneNode to `SerializedNode`. Captures: type, name, size, auto-layout, fills, cornerRadius, text, componentKey. Max 3 levels deep. |
| `serializeSelection()` | Serializes up to 20 selected nodes + local styles map. Returns `SerializedContext`. |
| `getAvailableLayers()` | Collects up to 80 named layers from selection + page top-level. Used for `@"name"` syntax in prompts. |

### Operation Executor

**`applyOperations(ops: FigmaOperation[])`** — Main engine. Iterates the AI-generated operation array and applies each to the Figma document.

**`getParent(parentRef?, parentNodeId?)`** — Resolves the parent node for creation ops:
1. `parentRef` → looks up in `createdNodes` Map (same-response nodes)
2. `parentNodeId` → `figma.getNodeByIdAsync(id)` (existing nodes, e.g. selected frame)
3. Fallback → `figma.currentPage`

#### Supported Operations (21 types)

**Creation:**
| Op | What it does |
|---|---|
| `CREATE_FRAME` | Creates frame with auto-layout, fills, cornerRadius, padding |
| `CREATE_RECTANGLE` | Rectangle with fills, strokes, cornerRadius |
| `CREATE_ELLIPSE` | Ellipse with fills |
| `CREATE_TEXT` | Text node with font loading, fills, textAutoResize |
| `CREATE_COMPONENT_INSTANCE` | Imports component by key, creates instance |

**Edit existing nodes:**
| Op | What it does |
|---|---|
| `SET_FILL` | Sets fills array on a node |
| `SET_STROKE` | Sets strokes, strokeWeight, strokeAlign |
| `SET_CORNER_RADIUS` | Sets cornerRadius + cornerSmoothing |
| `SET_EFFECTS` | Sets DROP_SHADOW / INNER_SHADOW / BLUR effects |
| `SET_AUTO_LAYOUT` | Sets layoutMode + all spacing/alignment props |
| `RESIZE` | Resizes a node |
| `MOVE` | Moves a node (x, y) |
| `RENAME` | Renames a node |
| `SET_TEXT_CONTENT` | Sets text content; loads all existing fonts before editing |
| `SET_OPACITY` | Sets opacity (0–1) |

**Tokens:**
| Op | What it does |
|---|---|
| `APPLY_VARIABLE` | Binds a Figma variable to a node field (fills, strokes, or numeric) |
| `APPLY_STYLE` | Applies a paint/text/effect/grid style by ID |

**Structure:**
| Op | What it does |
|---|---|
| `GROUP_NODES` | Groups nodes sharing the same parent |
| `UNGROUP` | Ungroups a group |
| `DETACH_INSTANCE` | Detaches a component instance |
| `DELETE_NODE` | Removes a node |

After all ops: selects root-level created nodes and zooms to view.

### Data Loaders

| Function | Returns |
|---|---|
| `getComponentsInCurrentFile()` | All `COMPONENT` + `COMPONENT_SET` nodes with id/name/key/folderPath |
| `exportComponentThumbnails(components)` | Exports 64px PNG thumbnails in batches of 12, posts `COMPONENT_THUMBNAIL` |
| `getColorVariablesFromFile()` | Local color variables → local paint styles → library color variables → selection fill/strokes |
| `getFontVariablesFromFile()` | Local STRING variables whose name contains "font"/"typeface"/"typography" |
| `getAvailableFontFamilies()` | All font families via `figma.listAvailableFontsAsync()` |
| `exportThumbnail(node)` | 64px PNG → base64 data URI |
| `getComponentFromSelection()` | Returns `ComponentInfo` for selected component/instance |
| `rgbToHex(r, g, b)` | Converts 0–1 RGB floats to `#rrggbb` hex |
| `getFolderPath(node)` | Walks parent hierarchy to build folder path array |

### Context Notification

**`notifyContextChange()`** — Fires on `selectionchange`. Fetches components/colors/fonts in parallel, posts `CONTEXT_UPDATED` with counts + `selectionDetails`. Exports thumbnail for single selection.

### Message Handler (`figma.ui.onmessage`)

| Message (UI → Sandbox) | Action |
|---|---|
| `GET_CONTEXT` | Loads all context data, sends `COMPONENTS_LOADED`, `FONT_VARIABLES_LOADED`, `COLOR_VARIABLES_LOADED`, starts thumbnail export in background |
| `USE_SELECTION_AS_LOGO` | Gets component from selection → `SELECTION_AS_LOGO` |
| `GENERATE_WITH_CONTEXT` | Serializes selection + all context → sends `CALL_API` to UI |
| `APPLY_OPERATIONS` | `applyOperations(msg.payload)` |
| `APPLY_OPERATIONS_FROM_API` | `applyOperations(msg.operations)` |
| `DELETE_SELECTION` | Removes all selected nodes |
| `OPEN_EXTERNAL` | `figma.openExternal(url)` |
| `SAVE_API_KEY` | `clientStorage.setAsync('userApiKey', key)` |
| `GET_API_KEY` | `clientStorage.getAsync('userApiKey')` → `API_KEY_LOADED` |
| `GET_GUIDELINES` | `clientStorage.getAsync('brandGuidelines')` → `GUIDELINES_LOADED` |
| `SAVE_GUIDELINE` | Upserts guideline array in `clientStorage` → `GUIDELINE_SAVED` |
| `DELETE_GUIDELINE` | Filters guideline by id from array → `GUIDELINES_LOADED` |

---

## `ui.js` — Plugin UI

Runs in the plugin iframe (browser). Communicates with sandbox via `parent.postMessage`.

### State Variables

| Variable | Type | Purpose |
|---|---|---|
| `chatHistory` | `Array<{role, content, isError}>` | All chat messages for rendering |
| `selectedLogo` | `ComponentInfo \| null` | Chosen logo component |
| `selectedFont` | `{id, name} \| null` | Chosen font variable |
| `selectedColors` | `Map<id, {name, value}>` | Active brand colors |
| `allComponents` | `ComponentInfo[]` | All components from file |
| `componentThumbs` | `Record<id, dataURI>` | Cached thumbnails |
| `allFonts` | `FontVariable[]` | Library font variables |
| `allAvailableFonts` | `string[]` | All Figma font families |
| `allColors` | `ColorVariable[]` | All color variables |
| `userApiKey` | `string` | BYOK Gemini key |
| `savedGuidelines` | `BrandGuideline[]` | Persisted guideline presets |
| `activeGuidelineId` | `string \| null` | Currently selected preset |
| `openPanel` | `'logo' \| 'colors' \| 'fonts' \| null` | Which brand panel is open |
| `activeFontTab` | `'library' \| 'all'` | Font picker active tab |
| `showFolders` | `boolean` | Component library folder mode |
| `currentSelectionDetails` | `Array<{id,name,type}>` | Current Figma selection info |

### View Navigation

| Function | Action |
|---|---|
| `openSettings()` | Shows `#settingsView`, hides `#mainView` |
| `closeSettings()` | Shows `#mainView`, hides `#settingsView`, calls `updateBrandPill()` |

### Brand Guidelines Presets

| Function | Action |
|---|---|
| `saveCurrentGuideline()` | `prompt()` for name → builds `BrandGuideline` from current state → `SAVE_GUIDELINE` |
| `applyGuideline(guideline)` | Restores logo/colors/font from a preset object, refreshes all previews |
| `renderGuidelinesSelector()` | Rebuilds `<select>` options from `savedGuidelines`, toggles delete button |
| `onGuidelineSelectChange()` | On dropdown change: sets `activeGuidelineId`, calls `applyGuideline()` |
| `deleteActiveGuideline()` | `confirm()` → `DELETE_GUIDELINE` message |

### Brand Panel (Logo / Colors / Fonts)

| Function | Action |
|---|---|
| `toggleBrandPanel(panel)` | Opens/closes collapsible panel section; triggers data render |
| `selectLogo(comp)` | Sets `selectedLogo`, updates preview + pill |
| `clearLogo()` | Clears `selectedLogo` |
| `updateLogoPreview()` | Renders logo preview tag with thumbnail |
| `useSelectionAsLogo()` | Posts `USE_SELECTION_AS_LOGO` |
| `toggleColor(id, name, value)` | Toggles color in `selectedColors` Map |
| `renderColorGrid()` | Renders swatches from `allColors` with selection state |
| `updateColorsPreview()` | Shows up to 6 color dots in row preview |
| `selectFontItem(id, name)` | Toggles `selectedFont` |
| `clearFont()` | Clears `selectedFont` |
| `renderFontList()` | Renders library or all-fonts list filtered by search |
| `switchFontTab(tab)` | Switches between 'library' and 'all' tabs |
| `updateFontsPreview()` | Shows font preview tag |
| `updateBrandPill()` | Toggles `.active` class on 🎨 Brand pill |

### Component Library (Logo Picker)

| Function | Action |
|---|---|
| `renderComponentsLibrary()` | Renders flat grid or folder tree, filtered by search |
| `buildTree(components)` | Builds nested folder tree from `folderPath` arrays |
| `renderFolderNode(node, pathPrefix)` | Recursively renders folder rows + component tiles |
| `renderCompTile(comp)` | Single component tile with thumbnail |
| `toggleFolder(pathKey)` | Expands/collapses folder in `expandedFolders` Set |
| `flattenTree(node)` | Flattens tree back to component array |
| `toggleShowFolders()` | Reads checkbox → re-renders library |

### Chat

| Function | Action |
|---|---|
| `sendChat()` | Reads input, pushes user message, posts `GENERATE_WITH_CONTEXT` with logo/font/colors |
| `addChatMsg(role, content, isError)` | Pushes to `chatHistory`, calls `renderChat()` |
| `renderChat()` | Re-renders full `#chatMessages` innerHTML |
| `callPluginAPI(context)` | `fetch('/api/plugin')` with context + optional BYOK key, posts result back |
| `handleApiError(message)` | Re-enables input, shows error chat message |
| `updateSendState()` | Enables/disables send button based on input content |

### Selection Indicator

| Function | Action |
|---|---|
| `renderSelectionIndicator()` | Shows thumbnail or icon + name for current selection |
| `getNodeTypeIcon(type)` | Returns icon character for node type |
| `getNodeTypeLabel(type)` | Returns PT-BR label for node type |

### API Key (BYOK)

| Function | Action |
|---|---|
| `saveApiKey()` | Reads `#apiKeyInput` → `SAVE_API_KEY` |
| `toggleApiSection()` | Collapses/expands BYOK section |

### Message Handler (`window.onmessage`)

| Message (Sandbox → UI) | Action |
|---|---|
| `CONTEXT_UPDATED` | Updates context bar text, `currentSelectionDetails`, calls `renderSelectionIndicator()` |
| `SELECTION_THUMBNAIL` | Sets `currentSelectionThumb`, re-renders indicator |
| `COMPONENTS_LOADED` | Sets `allComponents`, renders library |
| `COMPONENT_THUMBNAIL` | Caches thumb, re-renders library + logo preview |
| `FONT_VARIABLES_LOADED` | Sets `allFonts`, renders if panel open |
| `AVAILABLE_FONTS_LOADED` | Sets `allAvailableFonts`, renders if tab active |
| `COLOR_VARIABLES_LOADED` | Sets `allColors`, renders if panel open |
| `SELECTION_AS_LOGO` | Sets `selectedLogo` from selection |
| `API_KEY_SAVED` | Shows "✅ Chave salva" status |
| `API_KEY_LOADED` | Pre-fills `#apiKeyInput`, updates status text |
| `GUIDELINES_LOADED` | Updates `savedGuidelines`, resets stale `activeGuidelineId`, re-renders selector |
| `GUIDELINE_SAVED` | Updates `savedGuidelines` + `activeGuidelineId`, re-renders selector |
| `CALL_API` | Shows connecting status → calls `callPluginAPI(msg.context)` |
| `APPLY_OPERATIONS_FROM_API` | Posts back to sandbox for execution |
| `OPERATIONS_DONE` | Re-enables input, shows success message with summary |
| `ERROR` | Re-enables input, shows error chat message |

### Init (bottom of file)
```js
chatInput.addEventListener('input', updateSendState)
chatInput.addEventListener('keydown', Enter → sendChat)
brandPill.addEventListener('click', openSettings)
renderChat()
GET_CONTEXT, GET_API_KEY, GET_GUIDELINES  // fired on load
```

---

## `server/routes/plugin.ts` — AI Endpoint

**`POST /api/plugin`** — Stateless. Accepts plugin context, calls Gemini, returns `FigmaOperation[]`.

### Request shape (`PluginRequest`)
```ts
{ command, selectedElements, selectedLogo?, selectedBrandFont?,
  selectedBrandColors?, availableComponents?, availableColorVariables?,
  availableFontVariables?, apiKey? }
```

### `buildSystemPrompt(req)` — Context sections injected into Gemini:
1. **Brand guidelines** — logo name/key, font id, brand colors
2. **FRAMES/CONTAINERS SELECIONADOS** — selected container nodes with IDs → used as `parentNodeId`
3. **ELEMENTOS SELECIONADOS** — full hierarchy with ids for editing
4. **COMPONENTES DISPONÍVEIS** — up to 30 components with keys for instantiation
5. **VARIÁVEIS DE COR** — up to 30 color variables with hex values
6. **VARIÁVEIS DE FONTE** — up to 10 font variables
7. **21 operation definitions** with `parentRef` vs `parentNodeId` distinction
8. **16 golden rules** including ⭐ auto-layout, parent resolution, font styles, edit-vs-create

### Gemini call
- Model: `gemini-2.5-flash` with `responseMimeType: 'application/json'`
- Temperature: `0.2`
- BYOK: user key takes priority over server `GEMINI_API_KEY`

### Response
```json
{ "success": true, "operations": [...], "message": "Generated N operation(s)" }
```

---

## `src/lib/figma-types.ts` — Shared Types

| Type | Purpose |
|---|---|
| `FigmaOperation` | Union of all 21 operation types sent from server to sandbox |
| `SerializedNode` | Serialized SceneNode snapshot (id, type, name, size, fills, children…) |
| `SerializedContext` | `{ nodes: SerializedNode[], styles: Record<id, string> }` |
| `ComponentInfo` | `{ id, name, key?, folderPath[] }` |
| `ColorVariable` | `{ id, name, value }` |
| `FontVariable` | `{ id, name }` |
| `AvailableLayer` | `{ id, name, type }` |
| `BrandGuideline` | `{ id, name, logo?, font?, colors[] }` — stored in clientStorage |
| `UIMessage` | Union of all UI→Sandbox message types |
| `PluginMessage` | Union of all Sandbox→UI message types |

---

## Build & Manifest

| File | Role |
|---|---|
| `plugin/package.json` | `build` → `scripts/build.js`, `watch` → `scripts/watch.js` |
| `scripts/build.js` | esbuild bundles `src/code.ts` → `dist/code.js`; inlines `ui.html` + `ui.css` + `ui.js` via `__html__` |
| `scripts/watch.js` | Same as build but with `watch: true` |
| `plugin/manifest.json` | Dev manifest — `"id": ""`, points to `dist/code.js` |
| `Visant Copilot _Beta_/manifest.json` | **Published** manifest — id `1609259957876331442`, points to `../dist/code.js` + `../ui.html` |

> ⚠️ `clientStorage` requires the published manifest (real plugin ID). The dev manifest has no ID so storage falls back to in-memory only.
