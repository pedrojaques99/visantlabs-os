/**
 * MCP Tools Specification Generator
 * Extracts and structures MCP tools for documentation
 *
 * @module mcp-gen
 * @description Generates MCP (Model Context Protocol) specifications for AI agent integration.
 *              Documents all 9 available tools for Claude, Cursor, and other agents.
 */

import { SpecGenerationError, ValidationError } from './docs-errors.js';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  examples?: Array<{
    name: string;
    description?: string;
    input: Record<string, any>;
    expectedOutput?: string;
  }>;
}

interface MCPSpec {
  name: string;
  version: string;
  description: string;
  tools: MCPTool[];
}

/**
 * Generate MCP specification from tool definitions
 *
 * Generates a complete Model Context Protocol (MCP) specification
 * documenting all 9 available tools for AI agent integration:
 * - get_selection, create_frame, create_rectangle, create_text,
 * - set_fill, rename_node, delete_node, chat, generate_mockup
 *
 * @returns Complete MCP specification object with all 9 tools
 * @throws {SpecGenerationError} If spec generation fails
 *
 * @example
 * const mcpSpec = generateMCPSpec();
 * console.log(mcpSpec.tools.length); // 9
 */
export function generateMCPSpec(): MCPSpec {
  try {
  const tools: MCPTool[] = [
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
      examples: [
        {
          name: 'Get selection from file',
          input: {
            fileId: 'abc123def456',
          },
          expectedOutput: '{"message": "Current selection retrieved", "fileId": "abc123def456"}',
        },
      ],
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
            description: 'Frame name (default: "Frame")',
          },
          x: {
            type: 'number',
            description: 'X position in pixels',
          },
          y: {
            type: 'number',
            description: 'Y position in pixels',
          },
          width: {
            type: 'number',
            description: 'Width in pixels (default: 1440)',
          },
          height: {
            type: 'number',
            description: 'Height in pixels (default: 900)',
          },
          backgroundColor: {
            type: 'string',
            description: 'Background color in hex format (e.g., #FFFFFF)',
          },
        },
        required: ['fileId'],
      },
      examples: [
        {
          name: 'Create frame with custom size',
          input: {
            fileId: 'abc123',
            name: 'Mobile Screen',
            width: 375,
            height: 812,
            backgroundColor: '#F5F5F5',
          },
          expectedOutput: '✓ Created frame "Mobile Screen"',
        },
      ],
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
            description: 'Rectangle name (default: "Rectangle")',
          },
          x: {
            type: 'number',
            description: 'X position in pixels',
          },
          y: {
            type: 'number',
            description: 'Y position in pixels',
          },
          width: {
            type: 'number',
            description: 'Width in pixels (default: 200)',
          },
          height: {
            type: 'number',
            description: 'Height in pixels (default: 200)',
          },
          fill: {
            type: 'string',
            description: 'Fill color in hex format (e.g., #FF0000)',
          },
        },
        required: ['fileId'],
      },
      examples: [
        {
          name: 'Create blue square',
          input: {
            fileId: 'abc123',
            name: 'Button',
            width: 100,
            height: 40,
            fill: '#0000FF',
          },
          expectedOutput: '✓ Created rectangle "Button"',
        },
      ],
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
            description: 'Text content (default: "Hello")',
          },
          name: {
            type: 'string',
            description: 'Text element name (default: "Text")',
          },
          fontSize: {
            type: 'number',
            description: 'Font size in pixels (default: 16)',
          },
          fontFamily: {
            type: 'string',
            description: 'Font family name (default: "Inter")',
          },
        },
        required: ['fileId', 'text'],
      },
      examples: [
        {
          name: 'Create heading text',
          input: {
            fileId: 'abc123',
            text: 'Welcome to Visant',
            name: 'Main Title',
            fontSize: 32,
            fontFamily: 'Inter',
          },
          expectedOutput: '✓ Created text "Main Title"',
        },
      ],
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
            description: 'Fill color in hex format (e.g., #0000FF)',
          },
        },
        required: ['fileId', 'nodeId', 'fill'],
      },
      examples: [
        {
          name: 'Change element color to red',
          input: {
            fileId: 'abc123',
            nodeId: 'rect:123',
            fill: '#FF0000',
          },
          expectedOutput: '✓ Set fill color to #FF0000',
        },
      ],
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
            description: 'New name for the node',
          },
        },
        required: ['fileId', 'nodeId', 'name'],
      },
      examples: [
        {
          name: 'Rename node',
          input: {
            fileId: 'abc123',
            nodeId: 'rect:456',
            name: 'Primary Button',
          },
          expectedOutput: '✓ Renamed node to "Primary Button"',
        },
      ],
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
      examples: [
        {
          name: 'Delete unwanted element',
          input: {
            fileId: 'abc123',
            nodeId: 'text:789',
          },
          expectedOutput: '✓ Deleted node',
        },
      ],
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
            description: 'Natural language command or question',
          },
        },
        required: ['fileId', 'message'],
      },
      examples: [
        {
          name: 'Ask for design help',
          input: {
            fileId: 'abc123',
            message: 'Create a button with rounded corners and blue background',
          },
          expectedOutput: 'AI response with actions taken',
        },
      ],
    },
    {
      name: 'generate_mockup',
      description: 'Generate a mockup image using AI. Can optionally paste the result directly into a Figma node.',
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
              base64: {
                type: 'string',
                description: 'Base64-encoded image data',
              },
              mimeType: {
                type: 'string',
                description: 'Image MIME type (e.g., image/png, image/jpeg)',
              },
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
            enum: ['hd', '1k', '2k', '4k'],
            description: 'Optional: Resolution level',
          },
          model: {
            type: 'string',
            enum: ['gemini-2.5-flash-image', 'claude-opus-4.6'],
            description: 'Optional: AI model to use (default: gemini-2.5-flash-image)',
          },
          targetNodeId: {
            type: 'string',
            description: 'Optional: Figma node ID to paste the image into. Required with fileId for auto-paste.',
          },
        },
        required: ['promptText', 'baseImage'],
      },
      examples: [
        {
          name: 'Generate iPhone mockup',
          input: {
            fileId: 'abc123',
            targetNodeId: 'rect:999',
            promptText: 'iPhone 15 Pro mockup with landscape view',
            baseImage: {
              base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              mimeType: 'image/png',
            },
            resolution: '2k',
            model: 'gemini-2.5-flash-image',
          },
          expectedOutput: '✓ Mockup generated and pasted into Figma',
        },
      ],
    },
  ];

    return {
      name: 'figma-mcp',
      version: '1.0.0',
      description: 'MCP tools for interacting with Figma via Claude, Cursor, and other agents',
      tools,
    };
  } catch (error) {
    throw new SpecGenerationError(
      `Failed to generate MCP spec: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}

/**
 * Count available MCP tools
 *
 * @param spec - MCP specification object
 * @returns Number of available tools
 * @throws {ValidationError} If spec is invalid
 *
 * @example
 * const spec = generateMCPSpec();
 * const count = countMCPTools(spec); // 9
 */
export function countMCPTools(spec: MCPSpec): number {
  if (!spec || typeof spec !== 'object') {
    throw new ValidationError('spec must be a valid MCP specification object', { spec });
  }

  if (!Array.isArray(spec.tools)) {
    throw new ValidationError('spec.tools must be an array', { tools: spec.tools });
  }

  return spec.tools.length;
}

/**
 * Get MCP tool by name
 *
 * @param spec - MCP specification object
 * @param toolName - Name of the tool to retrieve
 * @returns Tool definition or undefined if not found
 * @throws {ValidationError} If parameters are invalid
 *
 * @example
 * const spec = generateMCPSpec();
 * const tool = getMCPTool(spec, 'create_frame');
 * console.log(tool.description); // "Create a new frame in Figma"
 */
export function getMCPTool(spec: MCPSpec, toolName: string): MCPTool | undefined {
  if (!spec || typeof spec !== 'object') {
    throw new ValidationError('spec must be a valid MCP specification object', { spec });
  }

  if (!toolName || typeof toolName !== 'string') {
    throw new ValidationError('toolName must be a non-empty string', { toolName });
  }

  if (!Array.isArray(spec.tools)) {
    throw new ValidationError('spec.tools must be an array', { tools: spec.tools });
  }

  return spec.tools.find((t) => t.name === toolName);
}
