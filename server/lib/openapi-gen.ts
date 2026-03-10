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
                  enum: ['gemini-2.5-flash-image', 'claude-opus-4.6'],
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
      { name: 'plugin', description: 'Figma plugin integration' },
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
