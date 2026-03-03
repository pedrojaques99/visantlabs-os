# Figma Plugin Agent Documentation

Complete guide for external agents (Claude, Cursor, etc.) to interact with the Figma plugin via MCP or HTTP.

## Quick Start

### Setup: MCP (Claude Desktop / Cursor)

1. Update your Claude Desktop config:
   ```json
   // ~/.config/Claude/claude_desktop_config.json
   {
     "mcpServers": {
       "figma": {
         "command": "npm",
         "args": ["run", "mcp:figma"],
         "cwd": "/path/to/visantlabs-os"
       }
     }
   }
   ```

2. Restart Claude Desktop

3. Test in Claude:
   ```
   Ask Claude: "Create a frame called 'Hero' with 1440×900 dimensions"
   ```

Expected result: A frame appears in Figma automatically.

### Setup: HTTP (Programmatic)

```bash
# Start the dev server
npm run dev:server

# In another terminal, test with curl
curl -X POST http://localhost:3001/api/plugin/agent-command \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "12345:67890",
    "operations": [{
      "type": "CREATE_RECTANGLE",
      "props": {
        "name": "Blue Box",
        "width": 200,
        "height": 200,
        "fills": [{
          "type": "SOLID",
          "color": {"r": 0, "g": 0, "b": 1}
        }]
      }
    }]
  }'
```

Expected response:
```json
{
  "success": true,
  "appliedCount": 1
}
```

---

## Architecture Overview

```
Agent (Claude, Cursor, etc.)
    ↓
MCP Server (server/mcp/figma-mcp.ts)
    ↓ HTTP
Operation Validator (server/lib/operationValidator.ts)
    ↓ WebSocket
Plugin Bridge (server/lib/pluginBridge.ts)
    ↓ WebSocket
Figma Plugin UI (plugin/modules/uiManager.js)
    ↓ postMessage
Plugin Sandbox (plugin/src/code.ts)
    ↓
Figma API
```

---

## MCP Tools

### Tool: get_selection

Get currently selected nodes in Figma.

**Parameters:**
- `fileId` (required): Figma file ID

**Example (Claude):**
```
"What's currently selected in my Figma file?"
```

**Response:**
```json
{
  "message": "Current selection retrieved",
  "fileId": "12345:67890",
  "sessionConnectedAt": "2026-03-03T12:00:00.000Z"
}
```

---

### Tool: create_frame

Create a new frame.

**Parameters:**
- `fileId` (required): Figma file ID
- `name` (optional): Frame name, default "Frame"
- `x` (optional): X position
- `y` (optional): Y position
- `width` (optional): Width in pixels, default 1440
- `height` (optional): Height in pixels, default 900
- `backgroundColor` (optional): Hex color (e.g., #FFFFFF)

**Example (Claude):**
```
"Create a 1440×900 frame with a dark blue background"
```

**HTTP:**
```bash
curl -X POST http://localhost:3001/api/plugin/agent-command \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "12345:67890",
    "operations": [{
      "type": "CREATE_FRAME",
      "props": {
        "name": "Hero Section",
        "width": 1440,
        "height": 900,
        "fills": [{
          "type": "SOLID",
          "color": {"r": 0.1, "g": 0.2, "b": 0.3}
        }]
      }
    }]
  }'
```

---

### Tool: create_rectangle

Create a rectangle shape.

**Parameters:**
- `fileId` (required)
- `name` (optional): Rectangle name
- `x`, `y` (optional): Position
- `width`, `height` (optional): Dimensions, default 200×200
- `fill` (optional): Hex color

**Example:**
```
"Create a red 100×100 square at position 50,50"
```

---

### Tool: create_text

Create a text element.

**Parameters:**
- `fileId` (required)
- `text` (required): Text content
- `name` (optional): Element name
- `fontSize` (optional): Font size, default 16
- `fontFamily` (optional): Font name, default "Inter"

**Example:**
```
"Add text 'Hello World' with size 24"
```

---

### Tool: set_fill

Change a node's fill color.

**Parameters:**
- `fileId` (required)
- `nodeId` (required): Target node ID
- `fill` (required): Hex color

**Example:**
```
"Change the selected element to green (#00FF00)"
```

---

### Tool: rename_node

Rename a node.

**Parameters:**
- `fileId` (required)
- `nodeId` (required): Target node ID
- `name` (required): New name

**Example:**
```
"Rename this to 'Button/Primary'"
```

---

### Tool: delete_node

Delete a node.

**Parameters:**
- `fileId` (required)
- `nodeId` (required): Target node ID

**Example:**
```
"Delete the selected element"
```

---

### Tool: chat

Send a natural language command (routes through AI pipeline).

**Parameters:**
- `fileId` (required)
- `message` (required): Natural language command

**Example:**
```
"Create a card design with avatar, name, and description"
```

**Response:**
Generated operations will be applied to Figma.

---

## File ID Determination

The `fileId` parameter is required for all operations. Here's how to get it:

### Option 1: Use Plugin Command

Ask Claude to extract the file ID:
```
"What's my Figma file ID? Tell me so I can use it for operations."
```

The plugin will respond with the current file ID.

### Option 2: Manual from URL

In Figma, the URL is:
```
https://www.figma.com/design/12345ABC/MyFile
                               ^^^^^^^
                               fileId
```

Extract the part after `/design/` and before `/`.

### Option 3: In Code

```typescript
// From Claude API context
const fileId = "12345:67890"; // Example format
```

---

## Operation Validation

All operations are validated **before** being pushed to the plugin. Invalid operations return a 400 error:

```json
{
  "error": "Operation validation failed",
  "invalid": [
    {
      "type": "CREATE_RECTANGLE",
      "errors": ["CREATE_RECTANGLE width must be positive"]
    }
  ]
}
```

Common validation errors:
- **Missing required fields**: nodeId, fills, strokes, etc.
- **Invalid types**: width must be number, name must be string
- **Boundary violations**: width/height must be > 0, opacity must be 0-1
- **Logical errors**: BOOLEAN_OPERATION with < 2 nodes, GROUP_NODES with < 2 nodes

---

## Error Handling

### WebSocket Not Connected (503)

**Cause:** Plugin is not connected to server.

**Fix:**
1. Make sure plugin is open in Figma
2. Check server logs for connection issues
3. Restart the dev server: `npm run dev:server`

### Timeout (504)

**Cause:** Plugin didn't acknowledge operation within 10 seconds.

**Fix:**
1. Check if plugin is frozen or unresponsive
2. Try a simpler operation first
3. Check browser console in Figma plugin UI

### Validation Error (400)

**Cause:** Operation schema is invalid.

**Fix:**
1. Review error message for which field is invalid
2. Check operation type documentation above
3. Ensure all required fields are present

---

## Message Flow

1. **Agent** calls MCP tool (or HTTP POST)
2. **Server** receives and validates operations
3. **PluginBridge** queues operations and waits for ACK
4. **UI iframe** receives WebSocket message
5. **Plugin Sandbox** applies operation to Figma
6. **Plugin Sandbox** sends ACK back through UI iframe
7. **PluginBridge** receives ACK, resolves promise
8. **Server** returns success to agent

Total time: ~100-500ms per operation (depending on operation complexity).

---

## Adding a New Operation Type

To support a new Figma operation:

### 1. Update Types (src/lib/figma-types.ts)

```typescript
export type FigmaOperation =
  | ... existing types ...
  | {
      type: 'YOUR_NEW_OPERATION';
      nodeId: string;
      yourField: string;
      // ... other fields
    };
```

### 2. Add Validation (server/lib/operationValidator.ts)

```typescript
case 'YOUR_NEW_OPERATION': {
  if (!op.nodeId) errors.push('YOUR_NEW_OPERATION requires nodeId');
  if (!op.yourField) errors.push('YOUR_NEW_OPERATION requires yourField');
  // ... validation rules
  break;
}
```

### 3. Add Handler (plugin/src/code.ts)

```typescript
case 'YOUR_NEW_OPERATION': {
  const node = figma.getNodeById(op.nodeId);
  if (!node) throw new Error('Node not found');

  // Apply operation
  (node as any).yourField = op.yourField;
  console.log(`Applied YOUR_NEW_OPERATION`);
  break;
}
```

### 4. Expose via MCP (server/mcp/figma-mcp.ts)

```typescript
case 'your_new_tool': {
  const { fileId, nodeId, yourField } = args;
  const operations = [{
    type: 'YOUR_NEW_OPERATION',
    nodeId,
    yourField,
  }];

  const validation = operationValidator.validateBatch(operations);
  // ... push and handle
  break;
}
```

Add to tools list:
```typescript
{
  name: 'your_new_tool',
  description: 'Description of what it does',
  inputSchema: { ... }
}
```

---

## Debugging

### Enable Debug Mode

```bash
# Check active plugin sessions
curl http://localhost:3001/api/plugin/debug/sessions

# Response:
{
  "sessions": [
    {
      "fileId": "12345:67890",
      "userId": "plugin-user",
      "connectedAt": "2026-03-03T12:00:00.000Z",
      "queueSize": 0,
      "pendingAcks": 0
    }
  ],
  "count": 1
}
```

### View Server Logs

```bash
# Terminal where dev server is running
npm run dev:server

# Look for:
# [PluginWS] Connected: fileId=12345...
# [PluginBridge] Operation CREATE_FRAME (opId=op-1) applied successfully
# [PluginBridge] Timeout waiting for ACK on opId=op-2
```

### Check Plugin UI Logs

1. Open Figma plugin
2. Open browser DevTools (F12)
3. Console tab shows plugin UI messages
4. Look for: `[UIManager] WebSocket connected`

---

## Rate Limiting & Best Practices

**Recommended practices:**
- Send operations in batches (5-20 ops per request)
- Wait for ACK before sending next batch
- Keep operation timeout in mind (10 seconds default)
- Avoid generating >100 operations per request

**Future rate limits (planned):**
- 100 operations/minute per user
- 10 concurrent WebSocket connections per user
- Operation cost model (text ops cheaper than cloning)

---

## Examples

### Example 1: Create a Simple Card

```typescript
const fileId = "12345:67890";

const operations = [
  {
    type: "CREATE_FRAME",
    ref: "card",
    props: {
      name: "Card",
      width: 360,
      height: 200,
      layoutMode: "VERTICAL",
      itemSpacing: 16,
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
      fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
      cornerRadius: 12,
    },
  },
  {
    type: "CREATE_TEXT",
    parentRef: "card",
    props: {
      name: "Title",
      content: "Card Title",
      fontFamily: "Inter",
      fontStyle: "Semi Bold",
      fontSize: 18,
      fills: [{ type: "SOLID", color: { r: 0.07, g: 0.07, b: 0.07 } }],
      layoutSizingHorizontal: "FILL",
    },
  },
];

// POST to /api/plugin/agent-command with fileId and operations
```

### Example 2: Modify Selected Element

```typescript
// Via MCP (Claude)
Agent: "Change the selected element's color to #FF5733"

// Via HTTP
{
  "fileId": "12345:67890",
  "operations": [{
    "type": "SET_FILL",
    "nodeId": "<previously selected node ID>",
    "fills": [{
      "type": "SOLID",
      "color": { "r": 1, "g": 0.34, "b": 0.2 }
    }]
  }]
}
```

### Example 3: Complex Design Generation

```typescript
Agent: "Create a marketing landing page design with hero section, features, and CTA"

// Plugin will generate 20+ operations covering:
// - Hero frame with background color and gradient
// - Feature cards with icons, titles, descriptions
// - CTA button with hover state
// - All using auto-layout and design tokens
```

---

## Support & Troubleshooting

### Plugin Doesn't Show Figma Tools?

1. Confirm `mcp:figma` is running: `npm run mcp:figma`
2. Check Claude/Cursor logs for MCP connection errors
3. Restart Claude/Cursor
4. Verify server is running: `npm run dev:server`

### Operations Not Applying?

1. Check plugin UI WebSocket connection (DevTools Console)
2. Verify fileId matches actual open file
3. Try a simple operation first: `CREATE_RECTANGLE`
4. Check server debug endpoint: `curl http://localhost:3001/api/plugin/debug/sessions`

### Timeout Errors?

1. Check if plugin UI is responsive (no frozen state)
2. Try smaller batch (5 ops instead of 50)
3. Increase timeout: set `FIGMA_WS_OP_TIMEOUT=20000` env var
4. Check if Figma app is under heavy load

---

**Last updated:** 2026-03-03
**Status:** Production Ready
**Support:** https://github.com/pedrojaques99/visantlabs-os/discussions
