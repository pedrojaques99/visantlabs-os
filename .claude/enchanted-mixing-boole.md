# Visant Copilot — Figma Plugin Implementation Plan

## Context

The PRD describes "Aesthetron AI" — a Figma plugin that acts as a "remote control" for the existing web app. The Figma sandbox (`code.ts`) reads/writes to the canvas, while the plugin's iframe loads a route from our deployed app, reusing all existing auth, BYOK, and LLM infrastructure.

**Critical adaptation**: The PRD assumes Next.js App Router, but our stack is **React 19 + Vite + Express.js**. All file paths and patterns must be adapted accordingly.

**User requirement**: The plugin UI must use **Figma native components** (CSS variables, compact Figma-style UI) — NOT shadcn/ui or Tailwind.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                FIGMA DESKTOP APP                      │
│                                                       │
│  ┌─────────────┐  postMessage  ┌──────────────────┐  │
│  │ Sandbox     │ ◄───────────► │ iframe            │  │
│  │ code.ts     │               │ app.vercel/plugin │  │
│  │ QuickJS     │               │                   │  │
│  │ Figma API   │               │ React (no Layout) │  │
│  │ Canvas R/W  │               │ Auth (reuse)      │  │
│  └─────────────┘               └─────────┬─────────┘  │
│                                          │ fetch       │
└──────────────────────────────────────────┼─────────────┘
                                           │
                          ┌────────────────▼────────────────┐
                          │   Express Backend (Vercel)       │
                          │                                  │
                          │  /api/ai/figma-generate  [NEW]   │
                          │  /api/auth/*             [REUSE] │
                          │  /api/users/settings/*   [REUSE] │
                          └──────────────────────────────────┘
```

---

## File Plan

| # | Action | File | Status |
|---|--------|------|--------|
| 1 | Shared types (FigmaOperation, messages) | `src/lib/figma-types.ts` | NEW |
| 2 | postMessage bridge hook | `src/hooks/useFigmaBridge.ts` | NEW |
| 3 | Figma native CSS (CSS variables) | `src/styles/figma-plugin.css` | NEW |
| 4 | Plugin page (standalone, no Layout) | `src/pages/PluginPage.tsx` | NEW |
| 5 | Register /plugin route outside Layout | `src/index.tsx` | MODIFY |
| 6 | Gemini service: figma generation fn | `server/services/geminiService.ts` | MODIFY |
| 7 | New Express route for figma AI | `server/routes/figma.ts` | NEW |
| 8 | Mount figma routes | `server/index.ts` | MODIFY |
| 9 | Client API: figma generate method | `src/services/aiApi.ts` | MODIFY |
| 10 | Plugin manifest.json | `plugin/manifest.json` | NEW |
| 11 | Plugin sandbox code.ts | `plugin/src/code.ts` | NEW |
| 12 | Plugin build config | `plugin/package.json` + `plugin/tsconfig.json` | NEW |
| 13 | Dev script (ngrok manifest) | `plugin/scripts/dev.js` | NEW |

---

## Step-by-Step Implementation

### Step 1: Shared Types — `src/lib/figma-types.ts`

Create the protocol contract shared between sandbox, UI, and backend.

```typescript
// Discriminated union for canvas operations
export type FigmaOperation =
  | { type: 'CREATE_FRAME'; props: { name: string; width: number; height: number; direction: 'HORIZONTAL' | 'VERTICAL'; gap: number; padding: number } }
  | { type: 'CREATE_TEXT'; props: { content: string; styleId?: string; fontSize?: number; color?: RGBA } }
  | { type: 'CREATE_COMPONENT'; componentKey: string; x: number; y: number; name: string }
  | { type: 'SET_FILL'; nodeId: string; color: RGBA }
  | { type: 'APPLY_STYLE'; nodeId: string; styleId: string; styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID' }
  | { type: 'APPLY_VARIABLE'; nodeId: string; variableId: string; property: string }
  | { type: 'GROUP_NODES'; nodeIds: string[]; name: string }
  | { type: 'DELETE_NODE'; nodeId: string };

export type RGBA = { r: number; g: number; b: number; a: number };

// UI → Sandbox messages
export type UIMessage =
  | { type: 'GET_CONTEXT' }
  | { type: 'APPLY_OPERATIONS'; payload: FigmaOperation[] };

// Sandbox → UI messages
export type PluginMessage =
  | { type: 'CONTEXT'; payload: SerializedContext }
  | { type: 'OPERATIONS_DONE' }
  | { type: 'ERROR'; message: string };

export type SerializedContext = {
  nodes: SerializedNode[];
  styles: Record<string, string>;
};

export type SerializedNode = {
  id: string; type: string; name: string; width: number; height: number;
};
```

---

### Step 2: Bridge Hook — `src/hooks/useFigmaBridge.ts`

Typed postMessage bridge between iframe and Figma sandbox.

- `send(msg: UIMessage)` → calls `parent.postMessage({ pluginMessage: msg }, '*')`
- `onMessage` callback receives `PluginMessage` from `event.data.pluginMessage`
- useEffect with addEventListener + cleanup
- Reuse pattern from existing hooks (useCallback, useEffect)

---

### Step 3: Figma Native CSS — `src/styles/figma-plugin.css`

Standalone CSS file using Figma's CSS variables (enabled via `themeColors: true` in showUI). **No Tailwind, no shadcn** — plain CSS that matches Figma's native UI.

Key CSS variables from Figma:
- `--figma-color-bg` / `--figma-color-bg-secondary`
- `--figma-color-text` / `--figma-color-text-secondary`
- `--figma-color-border`
- `--figma-color-bg-brand` / `--figma-color-text-onbrand`

Component classes: `.fp-container`, `.fp-input`, `.fp-button`, `.fp-button--primary`, `.fp-textarea`, `.fp-label`, `.fp-section`, `.fp-divider`, `.fp-spinner`, `.fp-badge`

Design principles:
- 11px font size (Figma standard)
- 4px/8px spacing grid
- 5px border radius
- Compact layout for 400×640 iframe

---

### Step 4: Plugin Page — `src/pages/PluginPage.tsx`

**CRITICAL**: This page renders OUTSIDE of `<Layout>` — no Header, no Footer, no LayoutContext.

It must handle auth independently:
- Read token from `localStorage` directly (same domain = shared storage)
- Call `authService.verifyToken()` on mount
- Show inline login prompt if not authenticated (link to open main app in browser via `figma.openExternal()`)

Flow:
1. On mount: verify auth, send `GET_CONTEXT` to sandbox
2. User types prompt in textarea
3. On "Generate": call `POST /api/ai/figma-generate` with `{ prompt, context }`
4. Receive `FigmaOperation[]` from backend
5. Send `APPLY_OPERATIONS` to sandbox
6. Show success/error state

Reuses:
- `authService.getToken()` / `authService.verifyToken()` from `src/services/authService.ts`
- New `figmaApi.generate()` method (see Step 9)
- `useFigmaBridge` hook (Step 2)

Does NOT import:
- `useLayout()` (depends on LayoutContext which doesn't exist outside Layout)
- `useAuthGuard()` (depends on useLayout)
- Any shadcn/ui components
- Tailwind classes (uses figma-plugin.css instead)

---

### Step 5: Route Registration — `src/index.tsx` (MODIFY)

Add `/plugin` as a **separate top-level route** in `createBrowserRouter`, BEFORE the `/*` catch-all, so it bypasses `<App>` and `<Layout>`:

```typescript
const router = createBrowserRouter([
  {
    path: '/plugin',
    element: <PluginPage />,  // Standalone — no App/Layout wrapper
  },
  {
    path: '/*',
    element: <App />,
    errorElement: (/* existing error UI */),
  },
]);
```

This ensures the plugin page has zero dependency on the main app's layout, context providers, or global styles.

---

### Step 6: Gemini Service — `server/services/geminiService.ts` (MODIFY)

Add a new exported function `generateFigmaOperations`:

```typescript
export async function generateFigmaOperations(
  prompt: string,
  context: SerializedContext,
  userApiKey?: string
): Promise<{ operations: FigmaOperation[]; inputTokens?: number; outputTokens?: number }>
```

- Uses `gemini-2.5-flash` model (text-only, fast, cheap)
- System prompt instructs JSON-only output with `{ "operations": FigmaOperation[] }`
- Includes canvas context in system prompt
- Uses `withRetry` pattern from existing service
- Returns parsed JSON operations array
- Reuses `getAI(apiKey)` pattern for BYOK support

---

### Step 7: Express Route — `server/routes/figma.ts` (NEW)

```
POST /api/figma/generate
  - Auth: authenticate middleware (reuse from server/middleware/auth.ts)
  - Rate limit: apiRateLimiter (reuse pattern from server/routes/ai.ts)
  - Body: { prompt: string, context: SerializedContext }
  - Calls: generateFigmaOperations(prompt, context, userApiKey)
  - Returns: { operations: FigmaOperation[] }
  - Usage tracking: reuse createUsageRecord pattern
```

Follow exact patterns from `server/routes/ai.ts`:
- Import `authenticate`, `AuthRequest` from middleware
- Import `getGeminiApiKey` from utils
- Import `createUsageRecord`, `incrementUserGenerations` from utils
- Async usage tracking (fire-and-forget)

---

### Step 8: Mount Routes — `server/index.ts` (MODIFY)

Add after existing route registrations:

```typescript
import figmaRoutes from './routes/figma.js';
app.use(`${routePrefix}/figma`, figmaRoutes);
```

---

### Step 9: Client API — `src/services/aiApi.ts` (MODIFY)

Add new method to the `aiApi` object:

```typescript
async generateFigmaOperations(prompt: string, context: SerializedContext): Promise<FigmaOperation[]> {
  const response = await fetch(`${API_BASE_URL}/figma/generate`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ prompt, context }),
  });
  // ... error handling following existing pattern
  const data = await response.json();
  return data.operations;
}
```

Import `FigmaOperation`, `SerializedContext` from `@/lib/figma-types`.

---

### Step 10: Plugin Manifest — `plugin/manifest.json` (NEW)

```json
{
  "name": "Visant Copilot",
  "id": "",
  "api": "1.0.0",
  "main": "dist/code.js",
  "ui": "https://www.visantlabs.com/plugin",
  "documentAccess": "dynamic-page",
  "editorType": ["figma"],
  "networkAccess": {
    "allowedDomains": ["www.visantlabs.com"],
    "reasoning": "Plugin communicates with Visant backend for AI-powered design generation"
  }
}
```

The `id` field will be assigned by Figma on first publish. Leave empty for dev.

---

### Step 11: Plugin Sandbox — `plugin/src/code.ts` (NEW)

Runs in QuickJS. ZERO browser APIs.

Responsibilities:
1. `figma.showUI(__html__, { width: 400, height: 640, themeColors: true, title: 'Visant Copilot' })`
2. Listen to `figma.ui.onmessage` for `GET_CONTEXT` and `APPLY_OPERATIONS`
3. `serializeSelection()` — extract up to 20 selected nodes (id, type, name, width, height) + active paint/text styles
4. `applyOperations(ops)` — iterate and execute each FigmaOperation on the canvas
5. Post `OPERATIONS_DONE` or `ERROR` back to UI

Implemented operations:
- `CREATE_FRAME` → `figma.createFrame()` with auto-layout props
- `CREATE_TEXT` → `figma.createText()` with `figma.loadFontAsync()` (REQUIRED before text manipulation)
- `SET_FILL` → set `node.fills` to solid paint
- `DELETE_NODE` → `figma.getNodeById(id)?.remove()`
- `GROUP_NODES` → `figma.group()`
- `APPLY_STYLE` → `node.fillStyleId`, `node.textStyleId`, etc.

**QuickJS constraints**: No import/require at runtime — esbuild bundles everything. Types from `figma-types.ts` used via relative path import (resolved at build time).

---

### Step 12: Plugin Build Config (NEW)

**`plugin/package.json`**:
```json
{
  "name": "visant-copilot-figma-plugin",
  "scripts": {
    "build": "esbuild src/code.ts --bundle --outfile=dist/code.js --target=es2020",
    "watch": "esbuild src/code.ts --bundle --outfile=dist/code.js --target=es2020 --watch",
    "dev": "node scripts/dev.js"
  },
  "devDependencies": {
    "@figma/plugin-typings": "^1.100.0",
    "esbuild": "^0.24.0",
    "typescript": "^5.7.0"
  }
}
```

**`plugin/tsconfig.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "strict": true,
    "typeRoots": ["./node_modules/@figma/plugin-typings", "../node_modules/@types"]
  },
  "include": ["src/**/*.ts", "../src/lib/figma-types.ts"]
}
```

---

### Step 13: Dev Script — `plugin/scripts/dev.js` (NEW)

Generates `manifest.dev.json` with ngrok URL for local development:

```javascript
const fs = require('fs');
const manifest = require('../manifest.json');
const url = process.env.NGROK_URL;
if (!url) { console.error('Set NGROK_URL env var'); process.exit(1); }
manifest.ui = `${url}/plugin`;
manifest.networkAccess.allowedDomains = [new URL(url).hostname];
if (!manifest.networkAccess.devAllowedDomains) manifest.networkAccess.devAllowedDomains = [];
manifest.networkAccess.devAllowedDomains.push(url);
fs.writeFileSync('./manifest.dev.json', JSON.stringify(manifest, null, 2));
console.log('✅ manifest.dev.json generated — import it in Figma Desktop');
```

---

## Files Reused (NO CHANGES)

| File | What's reused |
|------|---------------|
| `src/services/authService.ts` | `getToken()`, `verifyToken()`, `User` interface |
| `src/services/userSettingsService.ts` | BYOK key management (called server-side) |
| `server/middleware/auth.ts` | `authenticate` middleware, `AuthRequest` type |
| `server/utils/geminiApiKey.ts` | `getGeminiApiKey(userId)` for BYOK |
| `server/utils/usageTracking.ts` | `createUsageRecord` for analytics |
| `server/db/mongodb.ts` | DB connection for usage tracking |

---

## Key Design Decisions

1. **Plugin route outside Layout**: `/plugin` is a separate top-level route in `createBrowserRouter`, bypassing `<App>` entirely. No LayoutContext, no Header/Footer, no global providers except what the page imports directly.

2. **Auth in iframe**: Same domain (`www.visantlabs.com`) = shared `localStorage` = token is available. The plugin page reads the token directly via `authService.getToken()`. If not logged in, shows a compact message with a "Login" button that opens `https://www.visantlabs.com` in the browser (via `window.open()`). User logs in on the main app, then re-opens the Figma plugin.

3. **Figma native styling**: A standalone CSS file using Figma's `--figma-color-*` variables. No Tailwind, no shadcn. 11px base font, 4px grid, matches Figma's compact UI language.

4. **Separate Express route** (not modifying existing AI routes): Cleaner separation, no risk of breaking existing AI endpoints. New `server/routes/figma.ts` with its own endpoint.

5. **Gemini 2.5 Flash** for text generation: Fast, cheap, good at structured JSON output. No image model needed — the canvas context is serialized as JSON, not as a screenshot.

6. **esbuild for sandbox**: Bundles `code.ts` + imported types into a single `dist/code.js`. No runtime imports (QuickJS doesn't support them).

---

## CORS Consideration

The plugin iframe loads from our Vercel domain, so CORS for API calls is already handled (same-origin). For ngrok dev, we need to add the ngrok URL to the allowed CORS origins — the existing CORS config already allows all origins in production and localhost in dev. For ngrok, either add it to `FRONTEND_URL` env var or rely on the production mode `callback(null, true)` behavior.

---

## Verification Plan

1. **Build sandbox**: `cd plugin && npm install && npm run build` → verify `dist/code.js` exists
2. **Dev server**: Run the app normally (`npm run dev:all`) + ngrok tunnel
3. **Generate dev manifest**: `NGROK_URL=https://xxx.ngrok-free.app node plugin/scripts/dev.js`
4. **Load in Figma**: Plugins → Development → Import manifest → select `manifest.dev.json`
5. **Test auth**: Open plugin in Figma → verify auth state loads from localStorage
6. **Test bridge**: Select nodes in Figma → click "Get Context" → verify serialized nodes appear in UI
7. **Test generation**: Type a prompt → click "Generate" → verify API call succeeds and operations are applied to canvas
8. **Test dark mode**: Toggle Figma theme → verify plugin UI adapts via CSS variables
