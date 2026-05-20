#!/usr/bin/env node

/**
 * Figma MCP Server
 * Exposes Figma operations as tools for Claude, Cursor, and other agents
 * Run with: npm run mcp:figma
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { pluginBridge } from '../lib/pluginBridge.js';
import { operationValidator } from '../lib/operationValidator.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

type Args = Record<string, unknown>;
type McpResponse = { content: { type: string; text: string }[] };
type ToolHandler = (args: Args) => Promise<McpResponse>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.substring(0, 2), 16) / 255,
    g: parseInt(cleaned.substring(2, 4), 16) / 255,
    b: parseInt(cleaned.substring(4, 6), 16) / 255,
  };
}

function jsonResponse(data: unknown): McpResponse {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResponse(msg: string): McpResponse {
  return { content: [{ type: 'text', text: `Error: ${msg}` }] };
}

function successResponse(msg: string): McpResponse {
  return { content: [{ type: 'text', text: msg }] };
}

function getBaseUrl(): string {
  return `http://localhost:${process.env.PORT || 3001}`;
}

async function pushValidated(fileId: string, operations: any[], successMsg: string): Promise<McpResponse> {
  const validation = operationValidator.validateBatch(operations);
  if (validation.invalid.length > 0) {
    return errorResponse(`Validation: ${validation.invalid[0].errors.join(', ')}`);
  }
  const result = await pluginBridge.push(fileId, validation.valid);
  return successResponse(result.success ? `✓ ${successMsg}` : `✗ Failed: ${result.errors?.join(', ')}`);
}

// ─── Tool Handlers ───────────────────────────────────────────────────────────

const handlers: Record<string, ToolHandler> = {
  async get_selection(args) {
    const { fileId } = args;
    const session = pluginBridge.getSession(fileId as string);
    if (!session) return errorResponse(`Plugin not connected for fileId: ${fileId}`);
    return jsonResponse({
      message: 'Current selection retrieved',
      fileId,
      sessionConnectedAt: session.connectedAt.toISOString(),
    });
  },

  async create_frame(args) {
    const { fileId, name, x, y, width, height, backgroundColor } = args;
    return pushValidated(fileId as string, [{
      type: 'CREATE_FRAME',
      props: {
        name: name || 'Frame',
        width: width || 1440,
        height: height || 900,
        fills: backgroundColor ? [{ type: 'SOLID', color: parseHexColor(backgroundColor as string) }] : [],
      },
      ...(x !== undefined && { x }),
      ...(y !== undefined && { y }),
    }], `Created frame "${name}"`);
  },

  async create_rectangle(args) {
    const { fileId, name, x, y, width, height, fill } = args;
    return pushValidated(fileId as string, [{
      type: 'CREATE_RECTANGLE',
      props: {
        name: name || 'Rectangle',
        width: width || 200,
        height: height || 200,
        fills: fill ? [{ type: 'SOLID', color: parseHexColor(fill as string) }] : [],
      },
      ...(x !== undefined && { x }),
      ...(y !== undefined && { y }),
    }], `Created rectangle "${name}"`);
  },

  async create_text(args) {
    const { fileId, text, name, fontSize, fontFamily } = args;
    return pushValidated(fileId as string, [{
      type: 'CREATE_TEXT',
      props: {
        name: name || 'Text',
        content: text || 'Hello',
        fontSize: fontSize || 16,
        fontFamily: fontFamily || 'Inter',
        fontStyle: 'Regular',
        fills: [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.07 } }],
        textAutoResize: 'WIDTH_AND_HEIGHT',
      },
    }], `Created text "${name}"`);
  },

  async set_fill(args) {
    const { fileId, nodeId, fill } = args;
    return pushValidated(fileId as string, [{
      type: 'SET_FILL',
      nodeId,
      fills: [{ type: 'SOLID', color: parseHexColor(fill as string) }],
    }], `Set fill color to ${fill}`);
  },

  async rename_node(args) {
    const { fileId, nodeId, name } = args;
    return pushValidated(fileId as string, [{
      type: 'RENAME', nodeId, name,
    }], `Renamed node to "${name}"`);
  },

  async delete_node(args) {
    const { fileId, nodeId } = args;
    return pushValidated(fileId as string, [{
      type: 'DELETE_NODE', nodeId,
    }], 'Deleted node');
  },

  async chat(args) {
    const { fileId, message } = args;
    const response = await fetch(`${getBaseUrl()}/api/plugin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: message, fileId }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    const result = await response.json();
    return successResponse(result.summary || JSON.stringify(result, null, 2));
  },

  async generate_mockup(args) {
    const {
      fileId, promptText, baseImage, width, height, resolution,
      model = GEMINI_MODELS.IMAGE_FLASH, targetNodeId,
    } = args;

    if (!promptText) throw new Error('promptText is required');
    if (!baseImage) throw new Error('baseImage is required');

    const generateResponse = await fetch(`${getBaseUrl()}/api/mockups/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptText, baseImage, width, height, resolution, model, feature: 'agent' }),
    });

    if (!generateResponse.ok) {
      throw new Error(`Mockup generation failed: ${await generateResponse.text()}`);
    }

    const mockupResult = await generateResponse.json();
    if (!mockupResult.imageUrl) throw new Error('No image URL in response');

    let pasteResult: any = null;
    if (fileId && targetNodeId) {
      const ops = [{ type: 'SET_IMAGE_FILL', nodeId: targetNodeId, imageUrl: mockupResult.imageUrl }];
      const validation = operationValidator.validateBatch(ops);
      if (validation.invalid.length === 0) {
        pasteResult = await pluginBridge.push(fileId as string, validation.valid);
      }
    }

    return jsonResponse({
      success: true,
      imageUrl: mockupResult.imageUrl,
      pasted: pasteResult?.success || false,
      message: pasteResult?.success
        ? '✓ Mockup generated and pasted into Figma'
        : '✓ Mockup generated (not pasted)',
    });
  },

  async get_design_context(args) {
    const { fileId, nodeId, depth } = args;
    const result = await pluginBridge.push(fileId as string, [
      { type: 'GET_DESIGN_CONTEXT', nodeId: nodeId as string, depth: depth as number },
    ]);
    return jsonResponse(result);
  },

  async get_variable_defs(args) {
    const { fileId, nodeId } = args;
    const result = await pluginBridge.push(fileId as string, [
      { type: 'GET_VARIABLE_DEFS', nodeId: nodeId as string },
    ]);
    return jsonResponse(result);
  },

  async get_screenshot(args) {
    const { fileId, nodeId } = args;
    const result = await pluginBridge.push(fileId as string, [
      { type: 'GET_SCREENSHOT', nodeId: nodeId as string },
    ]);
    return jsonResponse({ base64: result });
  },

  async search_design_system(args) {
    const { fileId, query } = args;
    const result = await pluginBridge.push(fileId as string, [
      { type: 'SEARCH_DESIGN_SYSTEM', query: query as string },
    ]);
    return jsonResponse({ results: result });
  },

  async get_code_connect_map(args) {
    const { fileId } = args;
    const result = await pluginBridge.push(fileId as string, [
      { type: 'GET_CODE_CONNECT_MAP' },
    ]);
    return jsonResponse({ mappings: result });
  },

  async add_code_connect_map(args) {
    const { fileId, nodeId, componentName, filePath } = args;
    const result = await pluginBridge.push(fileId as string, [{
      type: 'ADD_CODE_CONNECT_MAP',
      nodeId: nodeId as string,
      componentName: componentName as string,
      filePath: filePath as string,
    }]);
    return jsonResponse(result);
  },
};

// ─── Tool Definitions ────────────────────────────────────────────────────────

const tools: Tool[] = [
  {
    name: 'get_selection',
    description: 'Get currently selected nodes in Figma. Use to inspect what the user has selected before performing operations.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID (from the URL: figma.com/design/:fileId/...)' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'create_frame',
    description: 'Create a new frame (artboard) in Figma. Defaults to 1440x900 if no size given.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        name: { type: 'string', description: 'Frame name (default: "Frame")' },
        x: { type: 'number', description: 'X position on canvas' },
        y: { type: 'number', description: 'Y position on canvas' },
        width: { type: 'number', description: 'Width in pixels (default: 1440)' },
        height: { type: 'number', description: 'Height in pixels (default: 900)' },
        backgroundColor: { type: 'string', description: 'Background hex color, e.g. #FFFFFF' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'create_rectangle',
    description: 'Create a rectangle shape in Figma. Defaults to 200x200.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        name: { type: 'string', description: 'Rectangle name (default: "Rectangle")' },
        x: { type: 'number', description: 'X position on canvas' },
        y: { type: 'number', description: 'Y position on canvas' },
        width: { type: 'number', description: 'Width in pixels (default: 200)' },
        height: { type: 'number', description: 'Height in pixels (default: 200)' },
        fill: { type: 'string', description: 'Fill hex color, e.g. #FF0000' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'create_text',
    description: 'Create a text element in Figma. Auto-sizes to content.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        text: { type: 'string', description: 'Text content to display' },
        name: { type: 'string', description: 'Layer name (default: "Text")' },
        fontSize: { type: 'number', description: 'Font size in pixels (default: 16)' },
        fontFamily: { type: 'string', description: 'Font family (default: Inter). Must be available in the Figma file.' },
      },
      required: ['fileId', 'text'],
    },
  },
  {
    name: 'set_fill',
    description: 'Set the fill color of an existing node. Only solid colors supported.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        nodeId: { type: 'string', description: 'Target node ID (from get_selection or get_design_context)' },
        fill: { type: 'string', description: 'Hex color, e.g. #0000FF' },
      },
      required: ['fileId', 'nodeId', 'fill'],
    },
  },
  {
    name: 'rename_node',
    description: 'Rename a node in the Figma layers panel.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        nodeId: { type: 'string', description: 'Target node ID' },
        name: { type: 'string', description: 'New layer name' },
      },
      required: ['fileId', 'nodeId', 'name'],
    },
  },
  {
    name: 'delete_node',
    description: 'Delete a node from Figma. This cannot be undone via MCP — confirm with the user first.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        nodeId: { type: 'string', description: 'Node ID to delete' },
      },
      required: ['fileId', 'nodeId'],
    },
  },
  {
    name: 'chat',
    description: 'Send a natural language design command to the Figma AI pipeline. Use for complex operations that combine multiple steps (e.g. "create a card component with title, subtitle, and image").',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        message: { type: 'string', description: 'Natural language design instruction' },
      },
      required: ['fileId', 'message'],
    },
  },
  {
    name: 'generate_mockup',
    description: 'Generate a mockup image using AI. Describe ONLY the scene (surface, lighting, angle) — do NOT describe the design content. Can auto-paste the result into a Figma node if fileId + targetNodeId are provided.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID (optional — required for auto-paste into a node)' },
        promptText: { type: 'string', description: 'Scene description ONLY: surface material, lighting, camera angle, background. Do NOT describe the design artwork.' },
        baseImage: {
          type: 'object',
          description: 'The design artwork to place in the scene',
          properties: {
            base64: { type: 'string', description: 'Base64-encoded image data' },
            mimeType: { type: 'string', description: 'MIME type (image/png, image/jpeg, etc.)' },
          },
          required: ['base64', 'mimeType'],
        },
        width: { type: 'number', description: 'Output width in pixels (default: 800)' },
        height: { type: 'number', description: 'Output height in pixels (default: 450)' },
        resolution: { type: 'string', description: 'Resolution: hd, 1k, 2k, or 4k' },
        model: { type: 'string', description: `AI model (default: ${GEMINI_MODELS.IMAGE_FLASH})` },
        targetNodeId: { type: 'string', description: 'Figma node ID to paste the generated image into' },
      },
      required: ['promptText', 'baseImage'],
    },
  },
  {
    name: 'get_design_context',
    description: 'Extract recursive node tree with properties (fills, strokes, effects, auto-layout, constraints). Use for architecture analysis or design-to-code workflows.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        nodeId: { type: 'string', description: 'Start node ID (defaults to current selection)' },
        depth: { type: 'number', description: 'Max traversal depth (default: 5)' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'get_variable_defs',
    description: 'Find all design token variables bound to a node and its children, including their mode values.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        nodeId: { type: 'string', description: 'Start node ID (defaults to current selection)' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'get_screenshot',
    description: 'Export a node or the current selection as a high-quality base64 PNG screenshot.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        nodeId: { type: 'string', description: 'Node ID to screenshot (defaults to current selection)' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'search_design_system',
    description: 'Search for components, styles, and variables in the Figma file by name or keyword.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        query: { type: 'string', description: 'Search term (component name, style name, or keyword)' },
      },
      required: ['fileId', 'query'],
    },
  },
  {
    name: 'get_code_connect_map',
    description: 'Retrieve all Figma-to-code mappings (which Figma components map to which React components).',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'add_code_connect_map',
    description: 'Map a Figma component to a code file so design-to-code workflows know which React component to use.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Figma file ID' },
        nodeId: { type: 'string', description: 'Figma component node ID' },
        componentName: { type: 'string', description: 'React component name (e.g. "Button", "Card")' },
        filePath: { type: 'string', description: 'Source file path (e.g. "src/components/ui/Button.tsx")' },
      },
      required: ['fileId', 'nodeId', 'componentName', 'filePath'],
    },
  },
];

// ─── Server Setup ────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'figma-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(
  CallToolRequestSchema,
  async (request): Promise<McpResponse> => {
    const { name, arguments: rawArgs } = request.params;
    const args = (rawArgs ?? {}) as Args;

    const handler = handlers[name];
    if (!handler) return errorResponse(`Unknown tool: ${name}`);

    try {
      return await handler(args);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Figma MCP] ${name} error:`, err);
      return errorResponse(msg);
    }
  }
);

async function start() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Figma MCP] Server started and listening');
}

start().catch((err) => {
  console.error('[Figma MCP] Error:', err);
  process.exit(1);
});
