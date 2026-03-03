# Implementation Checklist — Agent-First Plugin v2

Use this checklist to track progress through implementation_plan_v2.md

---

## Pre-Flight Checklist

- [ ] Review implementation_plan_v2.md end-to-end
- [ ] Review plan_v1_vs_v2_improvements.md to understand what changed
- [ ] Decide on authentication strategy (JWT, session token, or custom)
- [ ] Decide on error logging strategy (console, file, Sentry, etc.)
- [ ] Create `server/lib/pluginBridge.ts` stub

---

## Phase 1: WebSocket Bridge (Server)

### 1.1 Create pluginBridge.ts

- [ ] Create `server/lib/pluginBridge.ts`
- [ ] Implement `PluginSession` interface
- [ ] Implement `PluginBridge` class with:
  - [ ] `register(fileId, ws, userId): PluginSession`
  - [ ] `push(fileId, operations[]): Promise<{success, appliedCount, errors}>`
  - [ ] `onMessage(sessionId, message): void`
  - [ ] `unregister(fileId): void`
  - [ ] `getSession(fileId): PluginSession | null`
  - [ ] `startHeartbeat(session): void` (30s interval)
- [ ] Export singleton `pluginBridge`

**Testing**:
```bash
npm test server/lib/pluginBridge.test.ts
```

### 1.2 Create operationValidator.ts

- [ ] Create `server/lib/operationValidator.ts`
- [ ] Implement `OperationValidator` class with:
  - [ ] `validate(op: Operation): {valid, errors[]}`
  - [ ] Add validation for each of 37 operation types
  - [ ] Type-specific validation (bounds, string lengths, hex colors, etc.)
  - [ ] `validateBatch(ops[]): {valid[], invalid[]}`
- [ ] Export singleton `operationValidator`

**Validation rules to add**:
- [ ] CREATE_FRAME: name required, x/y/width/height numeric & positive
- [ ] SET_FILL: nodeId required, fill must be hex or gradient
- [ ] CREATE_TEXT: text required, min 1 char, max 10000
- [ ] SET_STROKE: width > 0, color valid hex
- [ ] MOVE_NODE: x/y numeric
- [ ] RESIZE_NODE: width/height > 0
- [ ] ... (repeat for all 37 operations)

**Testing**:
```bash
npm test server/lib/operationValidator.test.ts
```

### 1.3 Modify plugin.ts for WebSocket server

- [ ] Add `import { WebSocketServer } from 'ws'`
- [ ] Add `import { pluginBridge } from '@/lib/pluginBridge'`
- [ ] Add `import { operationValidator } from '@/lib/operationValidator'`
- [ ] Implement `initPluginWebSocket(server)` function:
  - [ ] Create WebSocketServer instance
  - [ ] Attach to server upgrade event for `/api/plugin/ws`
- [ ] Implement `handlePluginConnection(ws, req)`:
  - [ ] Extract token and fileId from query params
  - [ ] Call `validatePluginToken(token)` → userId
  - [ ] Return 401 if unauthorized
  - [ ] Call `pluginBridge.register(fileId, ws, userId)`
  - [ ] Setup `ws.onmessage`, `ws.onclose`, `ws.onerror` handlers
  - [ ] Send `PLUGIN_READY` message
- [ ] Implement `handlePluginMessage(session, message)`:
  - [ ] Handle `OPERATION_ACK` (resolve pending operation)
  - [ ] Handle `OPERATION_ERROR` (reject pending operation)
  - [ ] Handle `SELECTION_CHANGED` (log or broadcast)

### 1.4 Add agent-command endpoint to plugin.ts

- [ ] Add `POST /api/plugin/agent-command` route:
  - [ ] Extract fileId, operations from request body
  - [ ] Validate input (400 if missing/invalid)
  - [ ] Call `operationValidator.validateBatch(operations)`
  - [ ] Return 400 if validation fails + errors list
  - [ ] Call `pluginBridge.push(fileId, valid_ops)`
  - [ ] Return 200 with `{success, appliedCount}` on success
  - [ ] Return 500 with errors if push fails
  - [ ] Return 503 if plugin not connected

### 1.5 Update app startup

- [ ] In `server/index.ts`:
  - [ ] Call `initPluginWebSocket(server)` after creating Express server

---

## Phase 2: WebSocket Bridge (Plugin)

### 2.1 Modify plugin/src/code.ts

- [ ] Add message type union type for WebSocket messages:
  ```typescript
  type PluginMessage =
    | { type: 'INIT_WS'; token: string; fileId: string }
    | { type: 'AGENT_OPS'; operations: Operation[]; opId: string }
    | { type: 'SELECTION_CHANGED'; nodes: any[] }
  ```

- [ ] Update `figma.ui.onmessage` handler to:
  - [ ] Handle `INIT_WS` → forward to UI via postMessage
  - [ ] Handle `AGENT_OPS`:
    - [ ] Validate operations (type check)
    - [ ] Call existing `applyOperations(ops)`
    - [ ] Catch errors
    - [ ] Send back `OPERATION_ACK` with opId + success + appliedCount
    - [ ] Send back `OPERATION_ERROR` with opId + error message on failure
  - [ ] Handle `SELECTION_CHANGED` → forward to UI

- [ ] Test locally:
  ```bash
  # In plugin manifest, set command to point to built code.ts
  npm run build:plugin
  ```

### 2.2 Modify plugin/modules/uiManager.js

- [ ] Create `UIManager` class:
  - [ ] Constructor: call `init()`
  - [ ] `init()`: get auth token, fileId, call `openWebSocket()`

- [ ] Implement `openWebSocket(token, fileId)`:
  - [ ] Build WebSocket URL: `ws://localhost:3001/api/plugin/ws?token=...&fileId=...`
  - [ ] Create `new WebSocket(wsUrl)`
  - [ ] Setup handlers:
    - [ ] `onopen`: log, send `postToPlugin({type: 'WS_OPEN'})`
    - [ ] `onmessage`: call `handleWSMessage(message)`
    - [ ] `onerror`: log, send error to plugin
    - [ ] `onclose`: log, setup 5s reconnect timeout, call `openWebSocket()` again

- [ ] Implement `handleWSMessage(message)`:
  - [ ] If type === `PLUGIN_READY`: log
  - [ ] If type === `AGENT_OPS`: send `postToPlugin({type: 'AGENT_OPS', ...})`
  - [ ] Otherwise: warn unknown type

- [ ] Implement `sendToServer(message)`:
  - [ ] If WS open: `ws.send(JSON.stringify(message))`
  - [ ] Otherwise: log warning + queue message (optional)

- [ ] Setup parent message handlers for:
  - [ ] `OPERATION_ACK`: send to server via `sendToServer()`
  - [ ] `OPERATION_ERROR`: send to server via `sendToServer()`
  - [ ] `SELECTION_CHANGED`: send to server via `sendToServer()`

- [ ] Export singleton `uiManager`

- [ ] Update `plugin/ui.html`:
  - [ ] Load `uiManager.js` (already done if following modular UI)

---

## Phase 3: MCP Server

### 3.1 Create figma-mcp.ts

- [ ] Create `server/mcp/figma-mcp.ts`
- [ ] Import MCP SDK and utils:
  ```typescript
  import { Server, Tool } from '@modelcontextprotocol/sdk/server/index.js';
  import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
  import { pluginBridge } from '@/lib/pluginBridge';
  import { operationValidator } from '@/lib/operationValidator';
  ```

- [ ] Create Server instance with metadata:
  ```typescript
  const server = new Server({
    name: 'figma-mcp',
    version: '1.0.0',
    capabilities: { tools: {} }
  });
  ```

- [ ] Implement tools (at minimum):
  - [ ] `get_selection(fileId)` → return selected nodes
  - [ ] `get_page(fileId)` → return page nodes
  - [ ] `create_frame(fileId, name, x, y, width, height, backgroundColor)`
  - [ ] `create_text(fileId, name, text, x, y, ...)`
  - [ ] `create_rectangle(fileId, name, x, y, width, height, fill)`
  - [ ] `create_ellipse(fileId, name, ...)`
  - [ ] `set_fill(fileId, nodeId, fill)`
  - [ ] `set_text_content(fileId, nodeId, text)`
  - [ ] `set_stroke(fileId, nodeId, ...)`
  - [ ] `rename_node(fileId, nodeId, name)`
  - [ ] `move_node(fileId, nodeId, x, y)`
  - [ ] `resize_node(fileId, nodeId, width, height)`
  - [ ] `delete_node(fileId, nodeId)`
  - [ ] `group_nodes(fileId, nodeIds)`
  - [ ] `chat(fileId, message)` → route to existing AI pipeline

- [ ] For each tool:
  - [ ] Validate inputs
  - [ ] Create Operation object(s)
  - [ ] Call `operationValidator.validateBatch()`
  - [ ] Call `pluginBridge.push(fileId, valid_ops)`
  - [ ] Return result as MCP TextContent

- [ ] Connect transport:
  ```typescript
  const transport = new StdioServerTransport();
  server.connect(transport);
  ```

### 3.2 Update package.json

- [ ] Add dependencies:
  ```json
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.6.0",
    "ws": "^8.16.0"
  }
  ```

- [ ] Add script:
  ```json
  "scripts": {
    "mcp:figma": "node --loader ts-node/esm server/mcp/figma-mcp.ts"
  }
  ```

- [ ] Install: `npm install`

### 3.3 Test MCP server

```bash
# Terminal 1: Start dev server
npm run dev:server

# Terminal 2: Start MCP server
npm run mcp:figma

# Terminal 3: Test with curl
curl -X POST http://localhost:3001/api/plugin/agent-command \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "12345:67890",
    "operations": [
      {
        "type": "CREATE_RECTANGLE",
        "name": "test-rect",
        "x": 0, "y": 0, "width": 100, "height": 100,
        "fill": "#FF0000"
      }
    ]
  }'
```

---

## Phase 4: Testing & Documentation

### 4.1 Create unit tests

- [ ] Create `server/lib/pluginBridge.test.ts`:
  - [ ] Test register/unregister
  - [ ] Test FIFO queue ordering
  - [ ] Test timeout on no ACK
  - [ ] Test concurrent pushes
  - [ ] Test heartbeat

- [ ] Create `server/lib/operationValidator.test.ts`:
  - [ ] Test invalid operation type (400)
  - [ ] Test missing required fields (400)
  - [ ] Test valid operations (200)
  - [ ] Test boundary validation (bounds, string lengths)

- [ ] Create `server/routes/plugin.test.ts`:
  - [ ] Test POST /api/plugin/agent-command success
  - [ ] Test 400 validation errors
  - [ ] Test 503 plugin not connected
  - [ ] Test 504 timeout

### 4.2 Create documentation

- [ ] Create `plugin/AGENT.md`:
  - [ ] Quick Start (MCP config example)
  - [ ] Quick Start (HTTP example with curl)
  - [ ] Operation Types (all 37 with schemas)
  - [ ] Message Flow (numbered steps)
  - [ ] Error Handling (status codes)
  - [ ] Adding New Operation (step-by-step)

- [ ] Create/update `AGENT.md` (root):
  - [ ] Link to `plugin/AGENT.md`
  - [ ] Link to server components
  - [ ] Dev commands
  - [ ] Troubleshooting

### 4.3 Create integration test guide

- [ ] Document in `docs/INTEGRATION_TESTING.md`:
  - [ ] How to test WebSocket bridge locally
  - [ ] How to test MCP via Claude Desktop
  - [ ] How to test HTTP agent-command endpoint
  - [ ] Debugging tips (server logs, network inspector)

---

## Manual Verification

### Test A: WebSocket Connection

```bash
# Terminal 1
npm run dev:server

# Terminal 2
npm run dev  # Figma plugin dev

# In Figma
1. Load plugin (dev manifest)
2. Check server logs for "PluginWS Connected"
3. Select any layer
4. Verify "SELECTION_CHANGED" in logs
```

- [ ] Plugin connects successfully
- [ ] Selection changes appear in logs
- [ ] No connection errors

### Test B: Agent Command via HTTP

```bash
curl -X POST http://localhost:3001/api/plugin/agent-command \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "12345:67890",
    "operations": [{
      "type": "CREATE_RECTANGLE",
      "name": "agent-rect",
      "x": 100, "y": 100,
      "width": 200, "height": 200,
      "fill": "#0000FF"
    }]
  }'
```

- [ ] Blue rectangle appears in Figma
- [ ] No UI interaction needed
- [ ] Server returns `{success: true, appliedCount: 1}`

### Test C: Agent Command via MCP (Claude Desktop)

```bash
# 1. Update ~/.config/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "figma": {
      "command": "npm",
      "args": ["run", "mcp:figma"],
      "cwd": "/path/to/project"
    }
  }
}

# 2. Restart Claude

# 3. Ask Claude:
# "Create a 1440×900 frame with name 'Hero' and dark background"
```

- [ ] Frame appears in Figma
- [ ] Claude can see Figma tools in its interface
- [ ] No errors in Claude console

---

## Backwards Compatibility Verification

- [ ] Old HTTP polling still works: `POST /api/plugin` via UI
- [ ] UI and agent can run simultaneously without conflicts
- [ ] Existing file operations unchanged
- [ ] No breaking changes to plugin message format

---

## Deployment Checklist

- [ ] All tests passing: `npm test`
- [ ] No TypeScript errors: `npm run type-check`
- [ ] Environment variables documented in `.env.example`
- [ ] Logs are appropriate (debug, info, warn, error levels)
- [ ] No hardcoded tokens/secrets
- [ ] Rate limiting considered (future enhancement OK)
- [ ] Documentation complete
- [ ] Review security checklist in implementation_plan_v2.md

---

## Optional Enhancements (Post-MVP)

- [ ] Add rate limiting on `/api/plugin/agent-command`
- [ ] Add operation cost model (for credit tracking)
- [ ] Add operation audit trail (logging to MongoDB)
- [ ] Add SSE transport for cloud agents
- [ ] Add real-time collaboration (broadcast to multiple agents)
- [ ] Add operation rollback endpoint

---

**Estimated Time**: ~5 days for a team of 1-2 engineers
**Current Status**: ⏳ Not started
**Last Updated**: 2026-03-03
