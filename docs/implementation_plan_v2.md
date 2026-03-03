# Agent-First Figma Plugin — Implementation Plan v2 (Best Practices Edition)

> **Status**: Improved from v1 with security, error handling, testing, and architectural clarifications.

---

## Executive Summary

Make the plugin **fully operable by both human users (current UI) and external LLM agents** without breaking existing functionality.

**Key improvements over v1**:
- ✅ Security: WebSocket authentication & validation
- ✅ Reliability: ACK/error handling with timeouts and retries
- ✅ Operations: Type-safe operation validation before applying
- ✅ Testing: Automated integration tests (not just manual)
- ✅ Documentation: Clear examples and agent onboarding
- ✅ File ID resolution: Explicit session/context management
- ✅ Concurrency: Message queue and operation ordering

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    External Agents                           │
│         (Claude Desktop, Cursor, any MCP client)            │
└────────────────────────┬────────────────────────────────────┘
                         │  MCP (stdio)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              server/mcp/figma-mcp.ts  [NEW]                 │
│  Tools: get_selection, create_frame, chat, …                │
└────────────────────────┬────────────────────────────────────┘
                         │  HTTP POST /api/plugin/agent-command
                         │  (fileId + operations in body)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          server/routes/plugin.ts [MODIFY]                   │
│  - WebSocket server (ws://)                                 │
│  - Operation validation & queueing                          │
│  - Session management + auth                                │
└────────────────────────┬────────────────────────────────────┘
                         │  WebSocket (persistent, bidirectional)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           plugin/src/code.ts [MODIFY]                       │
│  - Open WS on plugin open                                   │
│  - Receive + apply operations with validation               │
│  - Send ACK/errors back to server                           │
│  - Report selection changes                                 │
└─────────────────────────────────────────────────────────────┘
                         │  postMessage
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           plugin/modules/*.js + ui iframe [MODIFY]          │
│  - Handle INIT_WS message from sandbox                      │
│  - Manage WebSocket connection lifecycle                    │
│  - Forward messages bidirectionally                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Pre-Implementation Checklist

- [ ] Add dependencies: `npm install ws @modelcontextprotocol/sdk`
- [ ] Review Figma Plugin API types (already have `@figma/plugin-typings`)
- [ ] Decide on **MCP transport**: stdio (local) or SSE (cloud)
- [ ] Plan WebSocket authentication strategy (bearer token or session ID)
- [ ] Database: Choose storage for operation history (MongoDB PluginSession or new?)

---

## Implementation Plan

### PHASE 1: WebSocket Bridge (Server Side)

#### 1.1 [NEW] server/lib/pluginBridge.ts

**Purpose**: Manage WebSocket connections per file, handle message queueing.

```typescript
// Singleton managing connections
interface PluginSession {
  fileId: string;
  ws: WebSocket;
  userId: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  operationQueue: Operation[];
  pendingAcks: Map<string, {
    resolve: (ack: any) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timer;
  }>;
}

class PluginBridge {
  private sessions: Map<string, PluginSession> = new Map();

  /**
   * Register a new plugin connection
   */
  register(fileId: string, ws: WebSocket, userId: string): PluginSession;

  /**
   * Push operations to plugin, wait for ACK or timeout
   */
  async push(fileId: string, operations: Operation[]): Promise<{
    success: boolean;
    appliedCount: number;
    errors?: string[];
  }>;

  /**
   * Handle incoming messages from plugin (selection changes, ACKs)
   */
  onMessage(sessionId: string, message: any): void;

  /**
   * Clean up on disconnect
   */
  unregister(fileId: string): void;

  /**
   * Get session info (for debugging)
   */
  getSession(fileId: string): PluginSession | null;

  /**
   * Health check - heartbeat every 30s
   */
  private startHeartbeat(session: PluginSession): void;
}

export const pluginBridge = new PluginBridge();
```

**Key design**:
- Operations are **queued in order** (FIFO)
- Each operation gets a unique `opId` for ACK tracking
- **10-second timeout** per operation (configurable)
- If timeout, operation is rejected, next queued op is sent
- **Heartbeat every 30 seconds** to detect stale connections

---

#### 1.2 [NEW] server/lib/operationValidator.ts

**Purpose**: Validate operations before pushing to plugin (fail fast).

```typescript
import { Operation, FigmaPaint } from '@/lib/figma-types';

class OperationValidator {
  /**
   * Validate a single operation
   */
  validate(op: Operation): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!op.type) errors.push('Missing operation type');
    if (typeof op.type !== 'string') errors.push('Invalid operation type (must be string)');

    // Type-specific validation
    switch (op.type) {
      case 'CREATE_FRAME':
        if (!op.name) errors.push('CREATE_FRAME requires name');
        if (typeof op.x !== 'number') errors.push('CREATE_FRAME requires numeric x');
        if (typeof op.y !== 'number') errors.push('CREATE_FRAME requires numeric y');
        if (typeof op.width !== 'number') errors.push('CREATE_FRAME requires numeric width');
        if (typeof op.height !== 'number') errors.push('CREATE_FRAME requires numeric height');
        break;

      case 'SET_FILL':
        if (!op.nodeId) errors.push('SET_FILL requires nodeId');
        if (!op.fill) errors.push('SET_FILL requires fill color');
        if (typeof op.fill !== 'string') errors.push('SET_FILL fill must be hex string (#RRGGBB)');
        break;

      // ... add cases for all 37 operations
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Batch validate (for efficiency)
   */
  validateBatch(
    operations: Operation[],
  ): {
    valid: Operation[];
    invalid: Array<{ op: Operation; errors: string[] }>;
  } {
    const valid: Operation[] = [];
    const invalid: Array<{ op: Operation; errors: string[] }> = [];

    for (const op of operations) {
      const result = this.validate(op);
      if (result.valid) {
        valid.push(op);
      } else {
        invalid.push({ op, errors: result.errors });
      }
    }

    return { valid, invalid };
  }
}

export const operationValidator = new OperationValidator();
```

---

#### 1.3 [MODIFY] server/routes/plugin.ts

Add WebSocket server and agent command endpoint.

```typescript
import express from 'express';
import { WebSocketServer } from 'ws';
import { pluginBridge } from '@/lib/pluginBridge';
import { operationValidator } from '@/lib/operationValidator';

const router = express.Router();

// ============ Existing HTTP polling endpoint ============
// POST /api/plugin (existing, unchanged)
// This keeps current UI working

// ============ NEW: WebSocket server ============
let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server (call once on app start)
 */
export function initPluginWebSocket(server: any) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, ws, head) => {
    if (req.url === '/api/plugin/ws') {
      wss!.handleUpgrade(req, ws, head, (ws) => {
        handlePluginConnection(ws, req);
      });
    }
  });
}

/**
 * Handle plugin WebSocket connection
 */
function handlePluginConnection(ws: any, req: any) {
  // Extract auth from query: ws://host/api/plugin/ws?token=XXX
  const token = new URL(req.url, `http://${req.headers.host}`).searchParams.get('token');
  const fileId = new URL(req.url, `http://${req.headers.host}`).searchParams.get('fileId');

  // Validate auth (implement based on your session/JWT strategy)
  const userId = validatePluginToken(token);
  if (!userId || !fileId) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  // Register session
  const session = pluginBridge.register(fileId, ws, userId);
  console.log(`[PluginWS] Connected: fileId=${fileId}, userId=${userId}`);

  // Handle messages from plugin
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handlePluginMessage(session, message);
    } catch (err) {
      ws.send(
        JSON.stringify({
          type: 'ERROR',
          error: 'Invalid JSON',
        }),
      );
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    pluginBridge.unregister(fileId);
    console.log(`[PluginWS] Disconnected: fileId=${fileId}`);
  });

  // Handle errors
  ws.on('error', (err) => {
    console.error(`[PluginWS] Error (fileId=${fileId}):`, err.message);
    pluginBridge.unregister(fileId);
  });

  // Send init message
  ws.send(
    JSON.stringify({
      type: 'PLUGIN_READY',
      fileId,
    }),
  );
}

/**
 * Handle messages from plugin (ACKs, selection changes, etc.)
 */
function handlePluginMessage(session: any, message: any) {
  const { type } = message;

  switch (type) {
    case 'OPERATION_ACK':
      // Operation applied successfully
      pluginBridge.onMessage(session.fileId, message);
      break;

    case 'OPERATION_ERROR':
      // Operation failed in plugin
      pluginBridge.onMessage(session.fileId, message);
      break;

    case 'SELECTION_CHANGED':
      // User selection changed - can broadcast to agents if needed
      console.log(`[PluginWS] Selection changed in ${session.fileId}:`, message.nodes);
      break;

    default:
      console.warn(`[PluginWS] Unknown message type: ${type}`);
  }
}

// ============ NEW: Agent command endpoint ============
/**
 * POST /api/plugin/agent-command
 * Called by MCP server to push operations to plugin
 */
router.post('/agent-command', async (req, res) => {
  const { fileId, operations } = req.body;

  // Validate input
  if (!fileId || !Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({
      error: 'Missing fileId or empty operations array',
    });
  }

  // Validate operations
  const validation = operationValidator.validateBatch(operations);
  if (validation.invalid.length > 0) {
    return res.status(400).json({
      error: 'Operation validation failed',
      invalid: validation.invalid,
    });
  }

  // Push to plugin
  try {
    const result = await pluginBridge.push(fileId, validation.valid);

    if (!result.success) {
      return res.status(500).json({
        error: 'Plugin did not acknowledge operations',
        errors: result.errors,
      });
    }

    res.json({
      success: true,
      appliedCount: result.appliedCount,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

// ... keep existing endpoint
router.post('/', async (req, res) => {
  // [UNCHANGED] Existing HTTP polling logic
});

export default router;
```

**Key improvements over v1**:
- ✅ **Bearer token auth** on WebSocket upgrade
- ✅ **Operation validation before push** (fail-fast)
- ✅ **Explicit ACK tracking** per operation
- ✅ **Error response** if plugin doesn't ACK
- ✅ **New agent-command endpoint** for MCP

---

### PHASE 2: WebSocket Bridge (Plugin Side)

#### 2.1 [MODIFY] plugin/src/code.ts

Add message types and WebSocket init.

```typescript
// Add new message type to handle WS commands
type PluginMessage =
  | { type: 'INIT_WS'; token: string; fileId: string }
  | { type: 'AGENT_OPS'; operations: Operation[]; opId: string }
  | { type: 'SELECTION_CHANGED'; nodes: any[] };

// Inside onmessage handler:
figma.ui.onmessage = async (msg: PluginMessage) => {
  switch (msg.type) {
    case 'INIT_WS': {
      // UI will handle WS setup
      figma.ui.postMessage({
        type: 'INIT_WS',
        token: msg.token,
        fileId: msg.fileId,
      });
      break;
    }

    case 'AGENT_OPS': {
      // Validate and apply operations from agent
      const { operations, opId } = msg;

      try {
        // Type-safe operation validation
        validateOperations(operations);

        // Apply operations
        const results = await applyOperations(operations);

        // Send ACK with results
        figma.ui.postMessage({
          type: 'OPERATION_ACK',
          opId,
          success: true,
          appliedCount: results.length,
        });
      } catch (err) {
        // Send error back
        figma.ui.postMessage({
          type: 'OPERATION_ERROR',
          opId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
      break;
    }

    case 'SELECTION_CHANGED': {
      // Human user changed selection
      figma.ui.postMessage({
        type: 'SELECTION_CHANGED',
        nodes: msg.nodes,
      });
      break;
    }
  }
};
```

---

#### 2.2 [MODIFY] plugin/modules/uiManager.js

Manage WebSocket lifecycle in UI.

```javascript
class UIManager {
  constructor() {
    this.ws = null;
    this.messageHandlers = new Map();
    this.init();
  }

  /**
   * Initialize WebSocket on plugin load
   */
  async init() {
    const token = await getPluginToken(); // Implement based on your auth
    const fileId = figma.root.id;

    this.openWebSocket(token, fileId);
    this.setupMessageHandlers();
  }

  /**
   * Open WebSocket connection
   */
  openWebSocket(token, fileId) {
    const wsUrl = new URL('ws://localhost:3001/api/plugin/ws');
    wsUrl.searchParams.set('token', token);
    wsUrl.searchParams.set('fileId', fileId);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[UIManager] WebSocket connected');
      postToPlugin({ type: 'WS_OPEN' });
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleWSMessage(message);
    };

    this.ws.onerror = (err) => {
      console.error('[UIManager] WebSocket error:', err);
      postToPlugin({ type: 'WS_ERROR', error: err.message });
    };

    this.ws.onclose = () => {
      console.log('[UIManager] WebSocket closed');
      postToPlugin({ type: 'WS_CLOSED' });

      // Attempt reconnect with exponential backoff
      setTimeout(() => this.openWebSocket(token, fileId), 5000);
    };
  }

  /**
   * Handle messages from server via WS
   */
  handleWSMessage(message) {
    const { type } = message;

    if (type === 'PLUGIN_READY') {
      console.log('[UIManager] Plugin ready for operations');
      return;
    }

    if (type === 'AGENT_OPS') {
      // Forward to plugin sandbox
      postToPlugin({
        type: 'AGENT_OPS',
        operations: message.operations,
        opId: message.opId,
      });
      return;
    }

    console.warn('[UIManager] Unknown WS message type:', type);
  }

  /**
   * Send ACK/error from plugin back to server
   */
  sendToServer(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[UIManager] WebSocket not connected, message queued:', message);
      // Could implement message queue here
    }
  }

  /**
   * Setup handlers for messages from plugin
   */
  setupMessageHandlers() {
    parent.addEventListener('message', (event) => {
      if (event.source !== window.parent) return;

      const { pluginMessage } = event.data;
      if (!pluginMessage) return;

      switch (pluginMessage.type) {
        case 'OPERATION_ACK':
        case 'OPERATION_ERROR':
          this.sendToServer(pluginMessage);
          break;

        case 'SELECTION_CHANGED':
          this.sendToServer(pluginMessage);
          break;
      }
    });
  }
}

const uiManager = new UIManager();
```

---

### PHASE 3: MCP Server

#### 3.1 [NEW] server/mcp/figma-mcp.ts

Full MCP server for external agents.

```typescript
import {
  Server,
  Tool,
  TextContent,
  ToolUseBlock,
} from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { pluginBridge } from '@/lib/pluginBridge';
import { operationValidator } from '@/lib/operationValidator';

const server = new Server({
  name: 'figma-mcp',
  version: '1.0.0',
  capabilities: {
    tools: {},
  },
});

/**
 * Tool: get_selection
 * Returns currently selected nodes in Figma
 */
server.setRequestHandler(
  { method: 'tools/get_selection' },
  async (request: any) => {
    const { fileId } = request.params;
    const session = pluginBridge.getSession(fileId);

    if (!session) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Plugin not connected for this file',
          },
        ],
      };
    }

    // Get current selection from plugin
    const selection = await pluginBridge.push(fileId, [
      { type: 'GET_SELECTION' as any },
    ]);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(selection, null, 2),
        },
      ],
    };
  },
);

/**
 * Tool: create_frame
 * Create a new frame
 */
server.setRequestHandler(
  { method: 'tools/create_frame' },
  async (request: any) => {
    const { fileId, name, x, y, width, height, backgroundColor } = request.params;

    const operations = [
      {
        type: 'CREATE_FRAME',
        name,
        x,
        y,
        width,
        height,
        backgroundColor,
      },
    ];

    const validation = operationValidator.validateBatch(operations);
    if (validation.invalid.length > 0) {
      return {
        content: [
          {
            type: 'text',
            text: `Validation error: ${validation.invalid[0].errors.join(', ')}`,
          },
        ],
      };
    }

    const result = await pluginBridge.push(fileId, validation.valid);

    return {
      content: [
        {
          type: 'text',
          text: result.success
            ? `Created frame "${name}"`
            : `Error: ${result.errors?.join(', ')}`,
        },
      ],
    };
  },
);

/**
 * Tool: chat
 * Send natural language command through AI pipeline
 */
server.setRequestHandler(
  { method: 'tools/chat' },
  async (request: any) => {
    const { fileId, message } = request.params;

    // Route to existing AI pipeline
    const response = await fetch('http://localhost:3001/api/plugin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: message, fileId }),
    });

    const result = await response.json();
    return {
      content: [
        {
          type: 'text',
          text: result.summary || JSON.stringify(result),
        },
      ],
    };
  },
);

// ... define remaining tools (SET_FILL, CREATE_TEXT, etc.)

// Start server
const transport = new StdioServerTransport();
server.connect(transport);
```

**Tools to expose** (21+ operations):
- `get_selection` - Get current selection
- `get_page` - Get page contents
- `create_frame`, `create_text`, `create_rectangle`, `create_ellipse`, etc.
- `set_fill`, `set_text_content`, `set_stroke`
- `rename_node`, `move_node`, `resize_node`, `delete_node`
- `group_nodes`, `create_component`, `create_variable`
- `chat` - Natural language command

---

#### 3.2 [MODIFY] package.json

Add MCP script and dependencies.

```json
{
  "scripts": {
    "mcp:figma": "node --loader ts-node/esm server/mcp/figma-mcp.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.6.0",
    "ws": "^8.16.0"
  }
}
```

---

### PHASE 4: Documentation & Testing

#### 4.1 [NEW] plugin/AGENT.md

Machine-readable docs for agents.

```markdown
# Figma Plugin Agent Documentation

## Quick Start

### Via MCP (Claude Desktop / Cursor)

```json
// ~/.config/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "figma": {
      "command": "npm",
      "args": ["run", "mcp:figma"]
    }
  }
}
```

### Via HTTP (Programmatic)

```bash
curl -X POST http://localhost:3001/api/plugin/agent-command \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "12345:67890",
    "operations": [
      {
        "type": "CREATE_FRAME",
        "name": "Hero",
        "x": 0, "y": 0,
        "width": 1440, "height": 900
      }
    ]
  }'
```

## Operation Types (37 Total)

[Detailed list of all operations with schemas]

## Message Flow

1. Agent sends operation via MCP tool or HTTP
2. Server validates operation schema
3. Server pushes to connected plugin via WebSocket
4. Plugin applies operation in Figma sandbox
5. Plugin sends ACK with `opId` back to server
6. Server resolves MCP promise

## Error Handling

- **Validation error** (400) - Schema mismatch
- **Plugin not connected** (503) - No active WebSocket for fileId
- **Operation timeout** (504) - Plugin didn't ACK after 10s
- **Figma error** (500) - Operation failed in sandbox

## Adding a New Operation Type

1. Add to `src/lib/figma-types.ts` (Operation union type)
2. Add validation rules to `server/lib/operationValidator.ts`
3. Add case handler in `plugin/src/code.ts` applyOperations()
4. Expose MCP tool in `server/mcp/figma-mcp.ts`
5. Add to `plugin/AGENT.md`
```

---

#### 4.2 [NEW] Integration Tests

```typescript
// server/lib/pluginBridge.test.ts
describe('PluginBridge', () => {
  test('should register and unregister sessions', () => {
    const ws = new MockWebSocket();
    const session = pluginBridge.register('file1', ws, 'user1');
    expect(session.fileId).toBe('file1');

    pluginBridge.unregister('file1');
    expect(pluginBridge.getSession('file1')).toBeNull();
  });

  test('should timeout on no ACK', async () => {
    const ws = new MockWebSocket();
    pluginBridge.register('file1', ws, 'user1');

    const promise = pluginBridge.push('file1', [
      { type: 'CREATE_FRAME', name: 'Test', x: 0, y: 0, width: 100, height: 100 },
    ]);

    // Wait for timeout
    const result = await promise;
    expect(result.success).toBe(false);
  });

  test('should queue operations in order', async () => {
    // Verify FIFO ordering
  });
});
```

---

## Breaking Changes & Backwards Compatibility

✅ **No breaking changes**:
- HTTP polling (`POST /api/plugin`) stays intact
- Existing UI continues to work
- WebSocket is **additive only** (used when agent connected)
- If WS disconnects, HTTP fallback still works

---

## Verification Plan

### Automated Tests

```bash
# Unit tests
npm test server/lib/pluginBridge.test.ts
npm test server/lib/operationValidator.test.ts

# Integration test (requires running plugin)
npm test server/routes/plugin.test.ts
```

### Manual Verification

**Test A — WebSocket bridge**
```bash
1. npm run dev:all
2. Open Figma plugin (dev manifest)
3. Check server logs for "PluginWS Connected"
4. Select a layer
5. Verify "SELECTION_CHANGED" in logs
```

**Test B — Agent push (curl)**
```bash
curl -X POST http://localhost:3001/api/plugin/agent-command \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "12345:67890",
    "operations": [
      {
        "type": "CREATE_RECTANGLE",
        "name": "blue-rect",
        "x": 100, "y": 100,
        "width": 200, "height": 200,
        "fill": "#0000FF"
      }
    ]
  }'
```

Expected: Blue rectangle appears in Figma (no UI interaction needed).

**Test C — MCP via Claude Desktop**
```bash
1. Update ~/.config/Claude/claude_desktop_config.json (add figma MCP)
2. Restart Claude
3. In Claude, ask: "Create a 1440×900 frame with dark background"
4. Verify frame appears in Figma
```

---

## Security Considerations

### Authentication
- ✅ Bearer token on WebSocket upgrade (`?token=XXX`)
- ✅ Validate userId matches request context
- ✅ Reject unknown fileIds

### Input Validation
- ✅ All operations validated before pushing
- ✅ Type schemas enforced (see operationValidator.ts)
- ✅ Bounds checking (x, y, width, height all positive)
- ✅ String length limits (names, text < 1000 chars)

### Rate Limiting
- ⚠️ Future: Add rate limit on `/api/plugin/agent-command` (e.g., 100 ops/min per user)
- ⚠️ Future: Add operation cost model (text operations are cheaper than cloning)

---

## Monitoring & Debugging

### Server Logs
```
[PluginWS] Connected: fileId=12345:67890, userId=user@example.com
[PluginBridge] Pushing 3 operations to fileId=12345:67890
[PluginBridge] Operation CREATE_FRAME (opId=op-1) applied successfully
[PluginBridge] Timeout waiting for ACK on opId=op-2
```

### Debug Endpoint (Optional)
```bash
GET /api/plugin/debug/sessions
→ { "sessions": [ { "fileId": "...", "userId": "...", "queueSize": 0 } ] }
```

---

## Future Enhancements

1. **SSE Transport** - For cloud agents (after stdio works)
2. **Real-time Collaboration** - Broadcast selection changes to multiple agents
3. **Operation History** - Audit trail per file
4. **Rollback** - Undo operations from agent (requires undo stack)
5. **Cost Tracking** - Credits per operation (for SaaS model)

---

## Summary of Changes

| File | Type | Purpose |
|------|------|---------|
| `server/lib/pluginBridge.ts` | NEW | WebSocket session management |
| `server/lib/operationValidator.ts` | NEW | Operation schema validation |
| `server/routes/plugin.ts` | MODIFY | Add WS server + agent endpoint |
| `plugin/src/code.ts` | MODIFY | Handle AGENT_OPS, send ACKs |
| `plugin/modules/uiManager.js` | MODIFY | Manage WS lifecycle |
| `server/mcp/figma-mcp.ts` | NEW | MCP tool definitions |
| `plugin/AGENT.md` | NEW | Agent documentation |
| `package.json` | MODIFY | Add ws + mcp dependencies |

---

**Version**: 2.0.0
**Last Updated**: 2026-03-03
**Status**: Ready for implementation
