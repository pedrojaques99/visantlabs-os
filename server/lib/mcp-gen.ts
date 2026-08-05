/**
 * MCP Tools Specification Generator
 * Extracts and structures MCP tools for documentation
 *
 * @module mcp-gen
 * @description Generates MCP (Model Context Protocol) specifications for AI agent integration.
 *              Nada aqui é escrito à mão: os tools do plugin vêm do registry
 *              FIGMA_TOOLS e os da plataforma do próprio servidor MCP, via
 *              `mcp-tools.generated.json` (`npm run mcp:sync`).
 */

import { SpecGenerationError, ValidationError } from './docs-errors.js';
import { FIGMA_TOOLS, FigmaTool } from './tools/registry.js';
// Gerado a partir de server/mcp/platform-mcp.ts — ver `npm run mcp:sync`.
import generated from './mcp-tools.generated.json' with { type: 'json' };
import {
  IMAGE_MODEL_IDS,
  IMAGE_PROVIDERS,
  DEFAULT_IMAGE_MODEL_ID,
} from '../../src/constants/imageModelRegistry.js';

type ToolCost = 'free' | 'credits';
type ToolCategory =
  | 'account'
  | 'mockups'
  | 'ai'
  | 'branding'
  | 'brand-guidelines'
  | 'canvas'
  | 'budget'
  | 'community'
  | 'auth'
  | 'moodboard'
  | 'references';

interface PlatformToolDef {
  name: string;
  description: string;
  required: string[];
  properties: Record<string, any>;
  cost: ToolCost;
  /**
   * Derivada do prefixo do nome em `scripts/sync-mcp-registry.ts`. Tipada como
   * `string` (e não como a união `ToolCategory`) porque o valor vem de um JSON
   * gerado: apertar aqui só faria o build quebrar quando alguém registrasse uma
   * tool com prefixo novo, em vez de a doc simplesmente ganhar a categoria.
   * A união continua servindo de referência do que já existe.
   */
  category: ToolCategory | string;
  auth: boolean;
}

/**
 * Todos os tools do platform MCP — DERIVADOS do servidor real.
 *
 * Servido via GET /api/docs/platform/mcp.json.
 *
 * Este array era escrito a mao ao lado de `server/mcp/platform-mcp.ts`: a mesma
 * lista, duas vezes, sem nada garantindo a sincronia. Tinha divergido em 45
 * tools ausentes aqui, 3 obsoletas e 17 descricoes diferentes — 45 tools que
 * existem e a documentacao publica (e o llms.txt) nao mencionavam, incluindo
 * health-check e compile. Doc mentindo por omissao.
 *
 * Agora o runtime e a unica fonte. O JSON e gerado por
 * `npm run mcp:sync` (scripts/sync-mcp-registry.ts) e `npm run mcp:sync:check`
 * falha se ele sair de sincronia — o mesmo padrao que o lado Figma ja usava com
 * FIGMA_TOOLS. Nao edite o .json a mao.
 */
const PLATFORM_TOOLS: PlatformToolDef[] = generated.tools as PlatformToolDef[];

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
      name: t.name.toLowerCase(),
      description: t.description,
      inputSchema: {
        type: t.schema.type,
        properties: t.schema.properties,
        required: t.schema.required,
      },
      examples: [{ name: `Example for ${t.name}`, input: t.example }],
    }));

    return {
      name: 'figma-mcp',
      version: '1.0.0',
      description: 'MCP tools for interacting with Figma via Claude, Cursor, and other agents.',
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
 * Generate Platform MCP specification for Claude.ai Connectors.
 *
 * A contagem vem do registry derivado — não escreva um número aqui: o comentário
 * anterior dizia "66 tools" enquanto o servidor registrava 131.
 */
export function generatePlatformMCPSpec(): MCPSpec {
  try {
    const tools: MCPTool[] = PLATFORM_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: {
        type: 'object',
        properties: t.properties,
        required: t.required,
      },
      // Extended fields for UI rendering — not part of MCP spec but included in our doc endpoint
      'x-cost': t.cost,
      'x-category': t.category,
      'x-auth': t.auth,
    }));

    return {
      name: 'visant-platform',
      version: '1.0.0',
      description:
        'Visant Labs platform MCP server. Connect via POST /api/mcp with Bearer visant_sk_xxx.',
      tools,
    };
  } catch (error) {
    throw new SpecGenerationError(
      `Failed to generate platform MCP spec: ${
        error instanceof Error ? error.message : String(error)
      }`,
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
