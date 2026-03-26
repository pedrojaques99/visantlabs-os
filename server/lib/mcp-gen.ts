/**
 * MCP Tools Specification Generator
 * Extracts and structures MCP tools for documentation
 *
 * @module mcp-gen
 * @description Generates MCP (Model Context Protocol) specifications for AI agent integration.
 *              Tools are dynamically synced from FIGMA_TOOLS registry.
 */

import { SpecGenerationError, ValidationError } from './docs-errors.js';
import { FIGMA_TOOLS, FigmaTool } from './tools/registry.js';

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
 * documenting all available tools from FIGMA_TOOLS registry.
 *
 * @returns Complete MCP specification object
 * @throws {SpecGenerationError} If spec generation fails
 *
 * @example
 * const mcpSpec = generateMCPSpec();
 * console.log(mcpSpec.tools.length); // 9
 */
export function generateMCPSpec(): MCPSpec {
  try {
    const tools: MCPTool[] = FIGMA_TOOLS.map((t) => ({
      name: t.name.toLowerCase(), // MCP usually uses lowercase
      description: t.description,
      inputSchema: {
        type: t.schema.type,
        properties: t.schema.properties,
        required: t.schema.required,
      },
      examples: [
        {
          name: `Example for ${t.name}`,
          input: t.example,
        },
      ],
    }));

    return {
      name: 'figma-mcp',
      version: '1.0.0',
      description: 'MCP tools for interacting with Figma via Claude, Cursor, and other agents. (Generated from Registry)',
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
