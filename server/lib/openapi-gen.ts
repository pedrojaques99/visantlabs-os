/**
 * OpenAPI 3.0 Specification Generator
 * Automatically generates OpenAPI spec from routes with JSDoc annotations
 *
 * @module openapi-gen
 * @description Generates OpenAPI 3.0 compliant specifications for REST API documentation.
 *              Covers MVP endpoints for Auth, Mockups, and Plugin operations.
 */

import { SpecGenerationError, ValidationError } from './docs-errors.js';

interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'body';
  required: boolean;
  schema: {
    type: string;
    description?: string;
    example?: any;
  };
}

interface ResponseSchema {
  description: string;
  schema: {
    type: string;
    properties?: Record<string, any>;
    example?: any;
  };
}

interface DocEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  summary: string;
  description?: string;
  tags: string[];
  security?: { type: string; scheme: string }[];
  parameters: Parameter[];
  requestBody?: {
    required: boolean;
    content: {
      'application/json': {
        schema: any;
        example?: any;
      };
    };
  };
  responses: Record<number, ResponseSchema>;
  examples?: Array<{
    name: string;
    description?: string;
    request?: any;
    response?: any;
  }>;
  rateLimit?: {
    limit: number;
    window: string;
  };
}

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description?: string;
    version: string;
  };
  servers: Array<{ url: string; description?: string }>;
  paths: Record<
    string,
    Record<string, any>
  >;
  components?: {
    securitySchemes?: Record<string, any>;
    schemas?: Record<string, any>;
  };
  tags?: Array<{ name: string; description?: string }>;
}

/**
 * Generate OpenAPI 3.0 specification for MVP endpoints
 *
 * Generates a complete OpenAPI 3.0 spec covering:
 * - Auth endpoints (6): signup, login, logout, profile, refresh, verify-email
 * - Mockups endpoints (7): list, generate, get, update, delete
 * - Plugin endpoints (3): execute command, get docs, get MCP spec
 *
 * @param version - API version (from package.json)
 * @param serverUrl - Base server URL (e.g., http://localhost:3001)
 * @returns Complete OpenAPI 3.0 specification object
 * @throws {ValidationError} If parameters are invalid
 * @throws {SpecGenerationError} If spec generation fails
 *
 * @example
 * const spec = generateOpenAPISpec('1.0.0', 'https://api.example.com');
 * console.log(spec.info.title); // "Visant Copilot API"
 */
export function generateOpenAPISpec(
  version: string = '1.0.0',
  serverUrl: string = 'http://localhost:3001'
): OpenAPISpec {
  // Validate parameters
  if (!version || typeof version !== 'string') {
    throw new ValidationError('version must be a non-empty string', { version });
  }

  if (!serverUrl || typeof serverUrl !== 'string') {
    throw new ValidationError('serverUrl must be a non-empty string', { serverUrl });
  }

  if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
    throw new ValidationError(
      'serverUrl must start with http:// or https://',
      { serverUrl }
    );
  }

  try {
    const endpoints: DocEndpoint[] = [
    // ============ AUTH (12) ============
    {
      path: '/auth/signup',
      method: 'POST',
      summary: 'Sign up a new user',
      description: 'Create a new account with email and password',
      tags: ['auth'],
      parameters: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 8 },
                username: { type: 'string' },
              },
              required: ['email', 'password'],
            },
          },
        },
      },
      responses: {
        201: {
          description: 'User created successfully',
          schema: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              token: { type: 'string' },
            },
          },
        },
        400: {
          description: 'Validation error',
          schema: { type: 'object' },
        },
      },
    },
    {
      path: '/auth/login',
      method: 'POST',
      summary: 'User login',
      description: 'Authenticate user and return JWT token',
      tags: ['auth'],
      parameters: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string' },
              },
              required: ['email', 'password'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Login successful',
          schema: { type: 'object' },
        },
        401: {
          description: 'Invalid credentials',
          schema: { type: 'object' },
        },
      },
    },
    {
      path: '/auth/logout',
      method: 'POST',
      summary: 'User logout',
      tags: ['auth'],
      parameters: [],
      security: [{ type: 'http', scheme: 'bearer' }],
      responses: {
        200: {
          description: 'Logged out successfully',
          schema: { type: 'object' },
        },
      },
    },
    {
      path: '/auth/profile',
      method: 'GET',
      summary: 'Get current user profile',
      tags: ['auth'],
      parameters: [],
      security: [{ type: 'http', scheme: 'bearer' }],
      responses: {
        200: {
          description: 'User profile',
          schema: { type: 'object' },
        },
      },
    },
    {
      path: '/auth/profile',
      method: 'PUT',
      summary: 'Update user profile',
      tags: ['auth'],
      parameters: [],
      security: [{ type: 'http', scheme: 'bearer' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object' },
          },
        },
      },
      responses: {
        200: {
          description: 'Profile updated',
          schema: { type: 'object' },
        },
      },
    },
    {
      path: '/auth/refresh',
      method: 'POST',
      summary: 'Refresh JWT token',
      tags: ['auth'],
      parameters: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                refreshToken: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'New token generated',
          schema: { type: 'object' },
        },
      },
    },
    {
      path: '/auth/verify-email',
      method: 'POST',
      summary: 'Verify email address',
      tags: ['auth'],
      parameters: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                token: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Email verified',
          schema: { type: 'object' },
        },
      },
    },
    // ============ MOCKUPS (7) ============
    {
      path: '/mockups',
      method: 'GET',
      summary: 'List mockups',
      tags: ['mockups'],
      parameters: [
        {
          name: 'limit',
          in: 'query',
          required: false,
          schema: { type: 'integer', example: 20 },
        },
        {
          name: 'skip',
          in: 'query',
          required: false,
          schema: { type: 'integer', example: 0 },
        },
      ],
      security: [{ type: 'http', scheme: 'bearer' }],
      responses: {
        200: {
          description: 'List of mockups',
          schema: { type: 'array' },
        },
      },
    },
    {
      path: '/mockups/generate',
      method: 'POST',
      summary: 'Generate mockup using AI',
      description: 'Generate product mockup from image using Gemini or Claude AI',
      tags: ['mockups'],
      parameters: [],
      security: [{ type: 'http', scheme: 'bearer' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                promptText: { type: 'string' },
                baseImage: { type: 'string' },
                width: { type: 'integer', default: 800 },
                height: { type: 'integer', default: 450 },
                resolution: { type: 'string', enum: ['hd', '1k', '2k', '4k'] },
                model: {
                  type: 'string',
                  enum: ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview', 'seedream-4.5', 'seedream-4.0', 'gpt-image-2'],
                },
                provider: {
                  type: 'string',
                  enum: ['gemini', 'seedream', 'openai'],
                  description: 'Image generation provider. Defaults to gemini.',
                },
              },
              required: ['promptText', 'baseImage'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Mockup generated successfully',
          schema: { type: 'object' },
        },
        400: {
          description: 'Invalid request parameters',
          schema: { type: 'object' },
        },
      },
      rateLimit: { limit: 10, window: '1h' },
    },
    {
      path: '/mockups/{id}',
      method: 'GET',
      summary: 'Get mockup by ID',
      tags: ['mockups'],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Mockup details',
          schema: { type: 'object' },
        },
        404: {
          description: 'Mockup not found',
          schema: { type: 'object' },
        },
      },
    },
    {
      path: '/mockups/{id}',
      method: 'PUT',
      summary: 'Update mockup',
      tags: ['mockups'],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      security: [{ type: 'http', scheme: 'bearer' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object' },
          },
        },
      },
      responses: {
        200: {
          description: 'Mockup updated',
          schema: { type: 'object' },
        },
      },
    },
    {
      path: '/mockups/{id}',
      method: 'DELETE',
      summary: 'Delete mockup',
      tags: ['mockups'],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      security: [{ type: 'http', scheme: 'bearer' }],
      responses: {
        200: {
          description: 'Mockup deleted',
          schema: { type: 'object' },
        },
      },
    },
    // ============ BRAND GUIDELINES - PUBLIC (2) ============
    {
      path: '/brand-guidelines/public/{slug}',
      method: 'GET',
      summary: 'Get public brand guideline',
      description: 'Returns full brand guideline data for a public slug. No authentication required.',
      tags: ['brand-guidelines'],
      parameters: [
        {
          name: 'slug',
          in: 'path',
          required: true,
          schema: { type: 'string', description: 'Public slug of the brand guideline', example: 'acme-corp' },
        },
      ],
      responses: {
        200: {
          description: 'Brand guideline data',
          schema: {
            type: 'object',
            properties: {
              guideline: {
                type: 'object',
                properties: {
                  _id: { type: 'string' },
                  name: { type: 'string' },
                  isPublic: { type: 'boolean' },
                  publicSlug: { type: 'string' },
                  identity: { type: 'object' },
                  colors: { type: 'object' },
                  typography: { type: 'object' },
                  logos: { type: 'array' },
                  guidelines: { type: 'array' },
                },
              },
            },
          },
        },
        404: {
          description: 'Brand guideline not found or not public',
          schema: { type: 'object' },
        },
      },
    },
    {
      path: '/brand-guidelines/public/{slug}/context',
      method: 'GET',
      summary: 'Get brand context for LLMs',
      description: 'Returns LLM-ready formatted brand context. Perfect for AI agents and MCP integrations. No authentication required.',
      tags: ['brand-guidelines'],
      parameters: [
        {
          name: 'slug',
          in: 'path',
          required: true,
          schema: { type: 'string', description: 'Public slug of the brand guideline', example: 'acme-corp' },
        },
        {
          name: 'format',
          in: 'query',
          required: false,
          schema: { type: 'string', description: 'Output format: full (default) or compact (optimized for image gen)', example: 'compact' },
        },
        {
          name: 'output',
          in: 'query',
          required: false,
          schema: { type: 'string', description: 'Response type: text (default) or json', example: 'json' },
        },
      ],
      responses: {
        200: {
          description: 'Brand context',
          schema: {
            type: 'object',
            properties: {
              slug: { type: 'string' },
              brandName: { type: 'string' },
              format: { type: 'string' },
              context: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  colors: { type: 'object' },
                  typography: { type: 'object' },
                  guidelines: { type: 'array' },
                  tokens: { type: 'object' },
                },
              },
            },
          },
        },
        404: {
          description: 'Brand guideline not found or not public',
          schema: { type: 'object' },
        },
      },
    },
    // ============ AI / PROMPT TOOLS (7) ============
    {
      path: '/ai/improve-prompt',
      method: 'POST',
      summary: 'Improve an image generation prompt',
      description: 'Refine and enhance a prompt to produce better AI image generation results.',
      tags: ['ai'],
      security: [{ type: 'http', scheme: 'bearer' }],
      parameters: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { prompt: { type: 'string', description: 'The prompt to improve' } },
              required: ['prompt'],
            },
          },
        },
      },
      responses: {
        200: { description: 'Improved prompt text', schema: { type: 'object', properties: { improved: { type: 'string' } } } },
      },
    },
    {
      path: '/ai/generate-smart-prompt',
      method: 'POST',
      summary: 'Generate an optimized image prompt from structured inputs',
      description: 'Build a high-quality image generation prompt from design type, style tags, colors, and optional brand context.',
      tags: ['ai'],
      security: [{ type: 'http', scheme: 'bearer' }],
      parameters: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                designType: { type: 'string', description: 'Type of design (e.g. product mockup, social media post)' },
                additionalPrompt: { type: 'string' },
                aspectRatio: { type: 'string', enum: ['1:1', '9:16', '16:9', '4:5'] },
                brandingTags: { type: 'array', items: { type: 'string' } },
                brandGuidelineId: { type: 'string' },
                negativePrompt: { type: 'string' },
              },
              required: ['designType'],
            },
          },
        },
      },
      responses: {
        200: { description: 'Generated prompt', schema: { type: 'object', properties: { prompt: { type: 'string' } } } },
      },
    },
    {
      path: '/ai/suggest-prompt-variations',
      method: 'POST',
      summary: 'Generate variations of an existing prompt',
      tags: ['ai'],
      security: [{ type: 'http', scheme: 'bearer' }],
      parameters: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: { prompt: { type: 'string' } },
              required: ['prompt'],
            },
          },
        },
      },
      responses: {
        200: { description: 'Array of prompt variations', schema: { type: 'object', properties: { variations: { type: 'array', items: { type: 'string' } } } } },
      },
    },
    {
      path: '/ai/describe-image',
      method: 'POST',
      summary: 'Describe / extract prompt from an image',
      description: 'Analyze an image and return a detailed description suitable for use as a generation prompt.',
      tags: ['ai'],
      security: [{ type: 'http', scheme: 'bearer' }],
      parameters: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                image: {
                  type: 'object',
                  properties: {
                    url: { type: 'string', format: 'uri' },
                    base64: { type: 'string' },
                    mimeType: { type: 'string' },
                  },
                },
              },
              required: ['image'],
            },
          },
        },
      },
      responses: {
        200: { description: 'Image description / extracted prompt', schema: { type: 'object', properties: { description: { type: 'string' } } } },
      },
    },
    {
      path: '/ai/extract-colors',
      method: 'POST',
      summary: 'Extract dominant color palette from an image',
      description: 'Analyze an image and return hex codes, color names, semantic roles (primary/accent/background/neutral), and frequency.',
      tags: ['ai'],
      security: [{ type: 'http', scheme: 'bearer' }],
      parameters: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                image: {
                  type: 'object',
                  properties: {
                    url: { type: 'string', format: 'uri' },
                    base64: { type: 'string' },
                    mimeType: { type: 'string' },
                  },
                },
              },
              required: ['image'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Extracted color palette',
          schema: {
            type: 'object',
            properties: {
              colors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    hex: { type: 'string' },
                    name: { type: 'string' },
                    role: { type: 'string', enum: ['primary', 'secondary', 'accent', 'background', 'neutral'] },
                    frequency: { type: 'string', enum: ['dominant', 'common', 'rare'] },
                  },
                },
              },
            },
          },
        },
      },
    },
    {
      path: '/ai/generate-naming',
      method: 'POST',
      summary: 'Generate brand or product name suggestions',
      description: 'Generate creative and memorable name suggestions from a brief. Optionally biased by a brand guideline.',
      tags: ['ai'],
      security: [{ type: 'http', scheme: 'bearer' }],
      parameters: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                brief: { type: 'string', description: 'Brand or product description' },
                count: { type: 'integer', default: 10, description: 'Number of name suggestions' },
                style: { type: 'string', description: 'Naming style (invented word, metaphor, compound, real word)' },
                brandGuidelineId: { type: 'string' },
              },
              required: ['brief'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Name suggestions with rationale',
          schema: {
            type: 'object',
            properties: {
              names: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    rationale: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    // ============ BRANDING GENERATION (7) ============
    {
      path: '/branding/generate-step',
      method: 'POST',
      summary: 'Generate a branding step (persona, archetype, SWOT, colors, moodboard, etc.)',
      description: `Multi-step branding generation engine. Each step generates a specific brand asset using AI.
Step values:
- 1: Market Research — benchmarking paragraph
- 5: Competitors — competitive landscape
- 6: References — visual design inspirations
- 7: SWOT — strengths/weaknesses/opportunities/threats
- 8: Color Palettes — AI color recommendations with hex codes
- 9: Visual Elements — icons, patterns, textures
- 10: Persona — audience persona (demographics, psychographics, pain points)
- 11: Concept Ideas — product mockup and usage scenarios
- 12: Moodboard — mood and aesthetic direction
- 13: Archetypes — brand archetype analysis (Hero, Sage, Lover, Caregiver, etc.)`,
      tags: ['branding'],
      security: [{ type: 'http', scheme: 'bearer' }],
      parameters: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                step: { type: 'integer', enum: [1, 5, 6, 7, 8, 9, 10, 11, 12, 13], description: 'Branding step to generate' },
                prompt: { type: 'string', description: 'Brand or product brief' },
                previousData: { type: 'object', description: 'Prior branding data for context-aware generation (e.g. { marketResearch, swot, colors })' },
              },
              required: ['step', 'prompt'],
            },
          },
        },
      },
      responses: {
        200: { description: 'Generated branding step result', schema: { type: 'object', properties: { result: { type: 'object' } } } },
        402: { description: 'Insufficient credits', schema: { type: 'object' } },
      },
    },
    // ============ MOCKUP BATCH (1) ============
    {
      path: '/mockups/batch-generate',
      method: 'POST',
      summary: 'Generate multiple mockup images in parallel',
      description: 'Generate up to 20 mockup images in parallel from an array of prompts. All images share the same model and output settings.',
      tags: ['mockups'],
      security: [{ type: 'http', scheme: 'bearer' }],
      parameters: [],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                prompts: { type: 'array', items: { type: 'string' }, description: 'Array of prompts (max 20)' },
                provider: { type: 'string', enum: ['gemini', 'openai', 'seedream'], default: 'openai' },
                model: { type: 'string', default: 'gpt-image-2' },
                aspectRatio: { type: 'string', enum: ['1:1', '9:16', '16:9', '4:5'], default: '1:1' },
                resolution: { type: 'string', enum: ['1K', '2K', '4K'], default: '1K' },
                brandGuidelineId: { type: 'string' },
                baseImage: { type: 'object', properties: { url: { type: 'string', format: 'uri' }, base64: { type: 'string' } } },
              },
              required: ['prompts'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Batch generation results',
          schema: {
            type: 'object',
            properties: {
              total: { type: 'integer' },
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    index: { type: 'integer' },
                    success: { type: 'boolean' },
                    data: { type: 'object' },
                    error: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    // ============ PLUGIN (7) ============
    {
      path: '/plugin',
      method: 'POST',
      summary: 'Execute plugin command',
      description: 'Send a command to the Figma plugin for processing',
      tags: ['plugin'],
      parameters: [],
      security: [{ type: 'http', scheme: 'bearer' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                command: { type: 'string' },
                fileId: { type: 'string' },
              },
              required: ['command', 'fileId'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Command executed',
          schema: { type: 'object' },
        },
      },
    },
    {
      path: '/plugin/docs',
      method: 'GET',
      summary: 'Get plugin documentation',
      tags: ['plugin'],
      parameters: [],
      responses: {
        200: {
          description: 'Plugin documentation (redirects to /docs/plugin)',
          schema: { type: 'object' },
        },
      },
    },
    {
      path: '/plugin/mcp',
      method: 'GET',
      summary: 'Get MCP specification',
      tags: ['plugin'],
      parameters: [],
      responses: {
        200: {
          description: 'MCP tool specifications',
          schema: { type: 'object' },
        },
      },
    },
  ];

  // Build OpenAPI paths object
  const paths: Record<string, Record<string, any>> = {};

  for (const endpoint of endpoints) {
    const pathKey = endpoint.path.replace('{id}', '{id}');
    if (!paths[pathKey]) {
      paths[pathKey] = {};
    }

    const methodKey = endpoint.method.toLowerCase();
    paths[pathKey][methodKey] = {
      summary: endpoint.summary,
      description: endpoint.description || endpoint.summary,
      tags: endpoint.tags,
      operationId: `${methodKey}_${endpoint.path.replace(/[{}\/]/g, '_')}`,
      parameters: endpoint.parameters.map((p) => ({
        name: p.name,
        in: p.in,
        required: p.required,
        schema: p.schema,
      })),
      requestBody: endpoint.requestBody,
      responses: Object.entries(endpoint.responses).reduce(
        (acc, [code, schema]) => {
          acc[code] = {
            description: schema.description,
            content: {
              'application/json': {
                schema: schema.schema,
              },
            },
          };
          return acc;
        },
        {} as Record<string, any>
      ),
      security: endpoint.security
        ? [
            {
              bearerAuth: [],
            },
          ]
        : undefined,
      'x-rateLimit': endpoint.rateLimit,
    };
  }

  const spec: OpenAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'Visant Copilot API',
      description: 'REST API for Visant design copilot platform. Supports JWT and API key authentication. AI agents can also connect via MCP (Model Context Protocol) at /api/mcp for direct tool invocation. See /llms.txt for agent discovery.',
      version,
    },
    servers: [
      {
        url: serverUrl,
        description: 'API server',
      },
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for authentication',
        },
        apiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API key authentication for agents. Format: visant_sk_xxxxxxxxxxxx. Get your key from Settings → API Keys.',
        },
      },
    },
    tags: [
      { name: 'auth', description: 'Authentication endpoints' },
      { name: 'mockups', description: 'Mockup generation' },
      { name: 'brand-guidelines', description: 'Brand guidelines API - public endpoints require no auth' },
      { name: 'plugin', description: 'Figma plugin integration' },
      { name: 'ai', description: 'AI tools — prompt generation, image analysis, color extraction, naming' },
      { name: 'branding', description: 'Brand identity generation — persona, archetype, SWOT, colors, moodboard' },
      { name: 'canvas', description: 'Canvas management' },
      { name: 'api-keys', description: 'API key management for agent access' },
      { name: 'mcp', description: 'MCP (Model Context Protocol) server — connect at /api/mcp via SSE' },
    ],
  };

    return spec;
  } catch (error) {
    throw new SpecGenerationError(
      `Failed to generate OpenAPI spec: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}

/**
 * Count available endpoints in OpenAPI spec
 *
 * @param spec - OpenAPI 3.0 specification object
 * @returns Number of HTTP endpoints (GET, POST, PUT, DELETE, PATCH)
 * @throws {ValidationError} If spec is invalid
 *
 * @example
 * const spec = generateOpenAPISpec('1.0.0');
 * const count = countEndpoints(spec); // Returns 42
 */
export function countEndpoints(spec: OpenAPISpec): number {
  if (!spec || typeof spec !== 'object') {
    throw new ValidationError('spec must be a valid OpenAPI specification object', { spec });
  }

  if (!spec.paths || typeof spec.paths !== 'object') {
    throw new ValidationError('spec.paths is required and must be an object', { paths: spec.paths });
  }

  try {
    let count = 0;
    for (const path of Object.values(spec.paths)) {
      for (const method of Object.keys(path)) {
        if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
          count++;
        }
      }
    }
    return count;
  } catch (error) {
    throw new SpecGenerationError(
      `Failed to count endpoints: ${error instanceof Error ? error.message : String(error)}`,
      { originalError: error }
    );
  }
}
