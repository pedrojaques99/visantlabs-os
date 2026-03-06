# Agent-First Figma Plugin

Make the plugin fully operable by both **human users** (current UI) and **external LLM agents** — without a separate plugin, without breaking anything today.

## Background

The plugin today: [ui.html](file:///z:/Cursor/visantlabs-os/plugin/ui.html) + `modules/*.js` (UI) ←→ [plugin/src/code.ts](file:///z:/Cursor/visantlabs-os/plugin/src/code.ts) (Figma sandbox) ←→ [server/routes/plugin.ts](file:///z:/Cursor/visantlabs-os/server/routes/plugin.ts) (backend via HTTP polling).

The agent-first upgrade: add a **WebSocket bridge** so the backend can *push* commands into the plugin in real time, and expose a **MCP server** so any agent (Claude, GPT, Cursor, etc.) can call Figma operations as native tools.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    External Agents                           │
│         (Claude Desktop, Cursor, any MCP client)            │
└────────────────────────┬────────────────────────────────────┘
                         │  MCP (stdio / SSE)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              server/mcp/figma-mcp.ts  [NEW]                 │
│  Tools: create_frame, set_fill, get_selection, chat, …      │
└────────────────────────┬────────────────────────────────────┘
                         │  calls existing server routes
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              server/routes/plugin.ts  [MODIFY]              │
│  Existing AI/design logic lives here                        │
│  + new WebSocket server (ws://)                             │
└────────────────────────┬────────────────────────────────────┘
                         │  WebSocket (persistent, bidirectional)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           plugin/src/code.ts  [MODIFY]                      │
│  Open WS connection on plugin open                          │
│  Receive operations from server → apply to Figma            │
│  Send selection changes / events → server                   │
└─────────────────────────────────────────────────────────────┘
                         │  postMessage (unchanged)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           plugin/modules/*.js  (UI)  [MINIMAL CHANGE]       │
│  Humans interact here exactly as today                      │
└─────────────────────────────────────────────────────────────┘
```

---

## User Review Required

> [!IMPORTANT]
> **MCP transport choice** — two options:
> - **stdio**: Agents run `node server/mcp/figma-mcp.ts` locally. Best for Cursor/Claude Desktop. Simple.
> - **SSE (HTTP)**: MCP server exposed over HTTP, reachable remotely. Best for cloud agents.
> I recommend **stdio first** (cheaper, zero auth needed), then SSE as a follow-up.

> [!WARNING]
> **WebSocket in Figma sandbox** — Figma's QuickJS sandbox does NOT support `new WebSocket()`. The WS connection must be initiated from the **UI iframe** ([code.ts](file:///z:/Cursor/visantlabs-os/plugin/src/code.ts) ↔ `ui iframe` via `postMessage`, then `ui iframe` ↔ server via WebSocket). This is a well-known pattern and doesn't require a 2nd plugin.

> [!NOTE]
> **No breaking changes** — the current HTTP polling flow ([api.js](file:///z:/Cursor/visantlabs-os/plugin/modules/api.js) → `/api/plugin`) stays intact. WebSocket is additive, used only when an agent is connected.

---

## Proposed Changes

### 1 — WebSocket Bridge (Server Side)

#### [MODIFY] [plugin.ts](file:///z:/Cursor/visantlabs-os/server/routes/plugin.ts)
- Add a `ws` WebSocket server (using the `ws` npm package, already likely installed).
- On WS connection: register the session by `fileId`.
- Expose a `pushToPlugin(fileId, operations[])` helper used by MCP tools.
- On WS message from plugin: forward selection/events to any listening agent.

#### [NEW] server/lib/pluginBridge.ts
- Singleton map of `fileId → WebSocket` for active plugin connections.
- `push(fileId, payload)` — sends ops to the right plugin instance.
- `broadcast(event)` — for future multi-agent scenarios.

---

### 2 — WebSocket Bridge (Plugin Side)

#### [MODIFY] [code.ts](file:///z:/Cursor/visantlabs-os/plugin/src/code.ts)
- Add new message type `INIT_WS` — tells the UI iframe to open a WebSocket.
- Handle incoming `AGENT_OPS` message type → calls existing [applyOperations()](file:///z:/Cursor/visantlabs-os/plugin/src/code.ts#185-999).
- On selection change → send `SELECTION_CHANGED` back through UI iframe → WS → server.

#### [MODIFY] [uiManager.js](file:///z:/Cursor/visantlabs-os/plugin/modules/uiManager.js)
- On `INIT_WS` message from sandbox: open `new WebSocket('ws://localhost:3001/agent')`.
- Forward incoming WS messages → `parent.postMessage({ pluginMessage: { type: 'AGENT_OPS', ... } })`.
- Forward `SELECTION_CHANGED` events from sandbox → WS.

---

### 3 — MCP Server

#### [NEW] server/mcp/figma-mcp.ts
Full MCP server using the `@modelcontextprotocol/sdk` package. Exposes these tools:

| Tool | Description |
|------|-------------|
| `get_selection` | Returns serialized current Figma selection |
| `get_page` | Returns all top-level nodes on current page |
| `create_frame` | Creates a frame with given props |
| `create_text` | Creates a text node |
| `create_rectangle` | Creates a rectangle |
| `set_fill` | Sets fill color on a node |
| `set_text_content` | Updates text content |
| `apply_style` | Applies a Figma style by ID |
| `rename_node` | Renames a node |
| `move_node` | Moves a node to x, y |
| `resize_node` | Resizes a node |
| `delete_node` | Deletes a node |
| `group_nodes` | Groups node IDs |
| `chat` | Sends a natural language command (routes through existing AI pipeline) |
| `get_brand_guidelines` | Returns current brand settings |
| `set_brand_guidelines` | Updates brand settings |

Each tool calls `pluginBridge.push(fileId, operations)` and waits for an ACK (with a 10s timeout).

#### [MODIFY] package.json (root)
- Add script: `"mcp:figma": "node --loader ts-node/esm server/mcp/figma-mcp.ts"`

---

### 4 — Agent Documentation

#### [NEW] plugin/AGENT.md
Machine-readable docs for agents working with the plugin codebase:
- Module map ([code.ts](file:///z:/Cursor/visantlabs-os/plugin/src/code.ts), [api.js](file:///z:/Cursor/visantlabs-os/plugin/modules/api.js), etc.) and what each does
- All 21+ operation types with typed schemas
- Message flow diagram (text)
- How to add a new operation type
- How to connect via MCP

#### [NEW] AGENT.md (root)
Top-level entry point for agents working on the whole monorepo:
- Points to `plugin/AGENT.md`, `server/AGENT.md` (future), skills, workflows
- Common dev commands (`npm run dev:all`)

---

## Verification Plan

### Automated Tests
No existing unit tests found in the codebase. I'll add:

1. **pluginBridge unit test** (`server/lib/pluginBridge.test.ts`):
   ```
   npx vitest run server/lib/pluginBridge.test.ts
   ```
   Tests: push to registered session, push to unknown session (no-op), broadcast.

2. **MCP tool smoke test** (`server/mcp/figma-mcp.test.ts`):
   ```
   npx vitest run server/mcp/figma-mcp.test.ts
   ```
   Tests: tool schemas are valid, `get_selection` returns correct shape, `chat` routes correctly.

### Manual Verification

**Test A — WebSocket bridge (Plugin → Server)**
1. Open Figma, load the plugin (dev manifest).
2. Select any layer on canvas.
3. Check server logs for a `SELECTION_CHANGED` event containing the node name.

**Test B — Agent push (Server → Plugin)**
1. With plugin open, run in terminal:
   ```
   curl -X POST http://localhost:3001/api/plugin -H "Content-Type: application/json" \
     -d '{"command":"create a blue 200x200 rectangle","fileId":"local_file"}'
   ```
2. A blue rectangle should appear in Figma without touching the plugin UI.

**Test C — MCP via Claude Desktop / Cursor**
1. Add to `claude_desktop_config.json`:
   ```json
   { "mcpServers": { "figma": { "command": "npm", "args": ["run","mcp:figma"] } } }
   ```
2. Ask Claude: *"Create a frame called Hero Section, 1440×900, with a dark background"*
3. Verify the frame appears in Figma.
