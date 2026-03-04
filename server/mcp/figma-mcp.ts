#!/usr/bin/env node

/**
 * Figma MCP Server
 * Exposes Figma operations as tools for Claude, Cursor, and other agents
 * Run with: npm run mcp:figma
 */

import {
  Server,
  Tool,
} from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { pluginBridge } from '../lib/pluginBridge.js';
import { operationValidator } from '../lib/operationValidator.js';

const server = new Server(
  {
    name: 'figma-mcp',
    version: '1.0.0',
    capabilities: {
      tools: {},
    },
  },
  {
    capabilities: {},
  }
);

// ═══ Tool: get_selection ═══
server.setRequestHandler(
  { method: 'tools/call' },
  async (request: any): Promise<{ content: any[] }> => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'get_selection': {
        const { fileId } = args;
        const session = pluginBridge.getSession(fileId);

        if (!session) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: Plugin not connected for fileId: ${fileId}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  message: 'Current selection retrieved',
                  fileId,
                  sessionConnectedAt: session.connectedAt.toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'create_frame': {
        const { fileId, name, x, y, width, height, backgroundColor } = args;

        const operations = [
          {
            type: 'CREATE_FRAME',
            props: {
              name: name || 'Frame',
              width: width || 1440,
              height: height || 900,
              fills: backgroundColor
                ? [
                    {
                      type: 'SOLID',
                      color: parseHexColor(backgroundColor),
                    },
                  ]
                : [],
            },
            ...(x !== undefined && { x }),
            ...(y !== undefined && { y }),
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
                ? `✓ Created frame "${name}"`
                : `✗ Failed: ${result.errors?.join(', ')}`,
            },
          ],
        };
      }

      case 'create_rectangle': {
        const { fileId, name, x, y, width, height, fill } = args;

        const operations = [
          {
            type: 'CREATE_RECTANGLE',
            props: {
              name: name || 'Rectangle',
              width: width || 200,
              height: height || 200,
              fills: fill
                ? [
                    {
                      type: 'SOLID',
                      color: parseHexColor(fill),
                    },
                  ]
                : [],
            },
            ...(x !== undefined && { x }),
            ...(y !== undefined && { y }),
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
                ? `✓ Created rectangle "${name}"`
                : `✗ Failed: ${result.errors?.join(', ')}`,
            },
          ],
        };
      }

      case 'create_text': {
        const { fileId, text, name, fontSize, fontFamily } = args;

        const operations = [
          {
            type: 'CREATE_TEXT',
            props: {
              name: name || 'Text',
              content: text || 'Hello',
              fontSize: fontSize || 16,
              fontFamily: fontFamily || 'Inter',
              fontStyle: 'Regular',
              fills: [
                {
                  type: 'SOLID',
                  color: { r: 0.07, g: 0.07, b: 0.07 },
                },
              ],
              textAutoResize: 'WIDTH_AND_HEIGHT',
            },
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
                ? `✓ Created text "${name}"`
                : `✗ Failed: ${result.errors?.join(', ')}`,
            },
          ],
        };
      }

      case 'set_fill': {
        const { fileId, nodeId, fill } = args;

        const operations = [
          {
            type: 'SET_FILL',
            nodeId,
            fills: [
              {
                type: 'SOLID',
                color: parseHexColor(fill),
              },
            ],
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
                ? `✓ Set fill color to ${fill}`
                : `✗ Failed: ${result.errors?.join(', ')}`,
            },
          ],
        };
      }

      case 'rename_node': {
        const { fileId, nodeId, name } = args;

        const operations = [
          {
            type: 'RENAME',
            nodeId,
            name,
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
                ? `✓ Renamed node to "${name}"`
                : `✗ Failed: ${result.errors?.join(', ')}`,
            },
          ],
        };
      }

      case 'delete_node': {
        const { fileId, nodeId } = args;

        const operations = [
          {
            type: 'DELETE_NODE',
            nodeId,
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
                ? `✓ Deleted node`
                : `✗ Failed: ${result.errors?.join(', ')}`,
            },
          ],
        };
      }

      case 'chat': {
        const { fileId, message } = args;

        // Route to existing AI pipeline
        try {
          const response = await fetch('http://localhost:3001/api/plugin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              command: message,
              fileId,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const result = await response.json();
          return {
            content: [
              {
                type: 'text',
                text: result.summary || JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
          };
        }
      }

      case 'generate_mockup': {
        const {
          fileId,
          promptText,
          baseImage,
          width,
          height,
          resolution,
          model = 'gemini-2.5-flash-image',
          targetNodeId,
        } = args;

        try {
          // Validate required fields
          if (!promptText) {
            throw new Error('promptText is required');
          }

          if (!baseImage) {
            throw new Error('baseImage is required');
          }

          // Generate mockup via existing API
          const generateResponse = await fetch('http://localhost:3001/api/mockups/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              promptText,
              baseImage,
              width,
              height,
              resolution,
              model,
              feature: 'agent', // Identify as agent-generated
            }),
          });

          if (!generateResponse.ok) {
            const errorText = await generateResponse.text();
            throw new Error(`Mockup generation failed: ${errorText}`);
          }

          const mockupResult = await generateResponse.json();

          if (!mockupResult.imageUrl) {
            throw new Error('No image URL in response');
          }

          // ✨ OPTIONAL: If fileId and targetNodeId provided, paste into Figma automatically
          let pasteResult: any = null;
          if (fileId && targetNodeId) {
            const operations = [
              {
                type: 'SET_IMAGE_FILL',
                nodeId: targetNodeId,
                imageUrl: mockupResult.imageUrl,
              },
            ];

            const validation = operationValidator.validateBatch(operations);
            if (validation.invalid.length === 0) {
              pasteResult = await pluginBridge.push(fileId, validation.valid);
            } else {
              console.warn('[Figma MCP] SET_IMAGE_FILL validation failed:', validation.invalid);
            }
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    imageUrl: mockupResult.imageUrl,
                    pasted: pasteResult?.success || false,
                    message: pasteResult?.success
                      ? '✓ Mockup generated and pasted into Figma'
                      : '✓ Mockup generated (not pasted)',
                  },
                  null,
                  2
                ),
              },
            ],
          };
        } catch (err) {
          console.error('[Figma MCP] Mockup generation error:', err);
          return {
            content: [
              {
                type: 'text',
                text: `Error generating mockup: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
          };
        }
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
        };
    }
  }
);

// Define available tools
const tools: Tool[] = [
  {
    name: 'get_selection',
    description: 'Get currently selected nodes in Figma',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'Figma file ID',
        },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'create_frame',
    description: 'Create a new frame in Figma',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'Figma file ID',
        },
        name: {
          type: 'string',
          description: 'Frame name',
        },
        x: {
          type: 'number',
          description: 'X position',
        },
        y: {
          type: 'number',
          description: 'Y position',
        },
        width: {
          type: 'number',
          description: 'Width in pixels',
        },
        height: {
          type: 'number',
          description: 'Height in pixels',
        },
        backgroundColor: {
          type: 'string',
          description: 'Hex color (e.g., #FFFFFF)',
        },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'create_rectangle',
    description: 'Create a rectangle shape in Figma',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'Figma file ID',
        },
        name: {
          type: 'string',
          description: 'Rectangle name',
        },
        x: {
          type: 'number',
          description: 'X position',
        },
        y: {
          type: 'number',
          description: 'Y position',
        },
        width: {
          type: 'number',
          description: 'Width in pixels',
        },
        height: {
          type: 'number',
          description: 'Height in pixels',
        },
        fill: {
          type: 'string',
          description: 'Hex color (e.g., #FF0000)',
        },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'create_text',
    description: 'Create a text element in Figma',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'Figma file ID',
        },
        text: {
          type: 'string',
          description: 'Text content',
        },
        name: {
          type: 'string',
          description: 'Text element name',
        },
        fontSize: {
          type: 'number',
          description: 'Font size in pixels',
        },
        fontFamily: {
          type: 'string',
          description: 'Font family name (e.g., Inter, Helvetica)',
        },
      },
      required: ['fileId', 'text'],
    },
  },
  {
    name: 'set_fill',
    description: 'Set the fill color of a node',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'Figma file ID',
        },
        nodeId: {
          type: 'string',
          description: 'Node ID to modify',
        },
        fill: {
          type: 'string',
          description: 'Hex color (e.g., #0000FF)',
        },
      },
      required: ['fileId', 'nodeId', 'fill'],
    },
  },
  {
    name: 'rename_node',
    description: 'Rename a node in Figma',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'Figma file ID',
        },
        nodeId: {
          type: 'string',
          description: 'Node ID to rename',
        },
        name: {
          type: 'string',
          description: 'New name',
        },
      },
      required: ['fileId', 'nodeId', 'name'],
    },
  },
  {
    name: 'delete_node',
    description: 'Delete a node from Figma',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'Figma file ID',
        },
        nodeId: {
          type: 'string',
          description: 'Node ID to delete',
        },
      },
      required: ['fileId', 'nodeId'],
    },
  },
  {
    name: 'chat',
    description: 'Send a natural language command to Figma (via AI)',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'Figma file ID',
        },
        message: {
          type: 'string',
          description: 'Natural language command',
        },
      },
      required: ['fileId', 'message'],
    },
  },
  {
    name: 'generate_mockup',
    description:
      'Generate a mockup image using AI. Can optionally paste the result directly into a Figma node.',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'Figma file ID (optional, required if you want to auto-paste into a node)',
        },
        promptText: {
          type: 'string',
          description: 'Text description of the mockup to generate (e.g., "iPhone 15 mockup showing login screen")',
        },
        baseImage: {
          type: 'object',
          description: 'Base image as {base64: string, mimeType: string}',
          properties: {
            base64: { type: 'string', description: 'Base64-encoded image data' },
            mimeType: { type: 'string', description: 'Image MIME type (e.g., image/png)' },
          },
        },
        width: {
          type: 'number',
          description: 'Optional: Output width in pixels (default: 800)',
        },
        height: {
          type: 'number',
          description: 'Optional: Output height in pixels (default: 450)',
        },
        resolution: {
          type: 'string',
          description: 'Optional: Resolution level (hd, 1k, 2k, 4k)',
        },
        model: {
          type: 'string',
          description: 'Optional: AI model to use (default: gemini-2.5-flash-image)',
        },
        targetNodeId: {
          type: 'string',
          description: 'Optional: Figma node ID to paste the image into. Required with fileId for auto-paste.',
        },
      },
      required: ['promptText', 'baseImage'],
    },
  },
];

// Register tools
server.setRequestHandler({ method: 'tools/list' }, async () => ({
  tools,
}));

/**
 * Parse hex color to RGB components (0-1 range)
 */
function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = parseInt(cleaned.substring(4, 6), 16) / 255;
  return { r, g, b };
}

/**
 * Start the MCP server
 */
async function start() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Figma MCP] Server started and listening');
}

start().catch((err) => {
  console.error('[Figma MCP] Error:', err);
  process.exit(1);
});
