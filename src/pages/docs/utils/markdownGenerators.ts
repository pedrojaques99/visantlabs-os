/**
 * Markdown Generators for DocsPage
 * Generates clean markdown for "Copy as Markdown" feature
 * Optimized for LLM context injection
 */

import type { OpenAPISpec, MCPSpec } from '../hooks/useDocsData';
import { PLATFORM_MCP_TOOLS, generateMcpToolsMarkdown } from '../data/platformMcpTools';

type TabId = 'overview' | 'api' | 'mcp' | 'plugin' | 'figma-nodes' | 'canvas-api' | 'brand-guidelines' | 'agents';

export function generateTabMarkdown(
  tab: TabId,
  mcpSpec: MCPSpec | null,
  openApiSpec: OpenAPISpec | null
): string {
  const lines: string[] = [];

  switch (tab) {
    case 'canvas-api':
      return generateCanvasApiMarkdown();

    case 'mcp':
      return generateMcpMarkdown(mcpSpec);

    case 'api':
      return generateRestApiMarkdown(openApiSpec);

    case 'figma-nodes':
      return generateFigmaNodesMarkdown();

    case 'brand-guidelines':
      return generateBrandGuidelinesMarkdown();

    case 'agents':
      return generateAgentsMarkdown();

    case 'plugin':
      return generatePluginMarkdown();

    case 'overview':
    default:
      return generateOverviewMarkdown();
  }
}

function generateOverviewMarkdown(): string {
  return `# Visant Copilot Documentation

## Sections
- **REST API** — HTTP endpoints for auth, mockups, and canvas manipulation.
- **Canvas API** — Create and manipulate canvas projects and nodes programmatically.
- **MCP Tools** — Model Context Protocol tools for Claude and AI agent integration.
- **Figma Plugin** — Design automation inside Figma.
- **Figma Node JSON** — Data-driven node creation spec for the plugin renderer.

## Authentication
All endpoints: \`Authorization: Bearer <jwt_token>\`
Obtain token: \`POST /api/auth/login\` → \`{ "email": "...", "password": "..." }\`

## Base URL
\`https://your-domain.com/api\``;
}

function generatePluginMarkdown(): string {
  return `# Figma Plugin Guide

## Installation
1. Open any file in Figma.
2. Go to Resources > Plugins.
3. Search for "Visant Copilot" and click Run.
4. Follow the on-screen prompts to connect your account.

## Capabilities
- **Mockups** — select frames and convert them to 3D device mockups instantly.
- **Chat with AI** — describe what to build; nodes are created automatically.
- **Brand identity extraction** — upload logo + identity PDF to generate brand-aware prompts.
- **Image generation** — text-to-image, edit, merge, upscale inside Figma.

## Plugin API (for developers)
The plugin communicates with the server via WebSocket (pluginBridge). Agents can send commands via the \`/api/plugin/agent-command\` endpoint which validates and queues operations for execution inside Figma.`;
}

function generateAgentsMarkdown(): string {
  const lines = [
    '# AI Agent Integration Guide',
    '',
    'Visant Labs provides three main ways for AI agents to interact with the platform: Discovery, MCP Tools, and REST API.',
    '',
    '## Discovery (LLM Discovery)',
    '- `/llms.txt` — Concise platform overview',
    '- `/llms-full.txt` — Comprehensive platform reference',
    '- `/api/docs/api/spec` — OpenAPI JSON Spec',
    '',
    '## Authentication',
    'Agents authenticate using API keys. Create them in **Settings → API Keys**.',
    'Header: `Authorization: Bearer visant_sk_xxxxxxxxxxxx`',
    '',
    '## MCP Connection',
    'Server: Platform MCP',
    'Transport: HTTP/SSE',
    'Endpoint: `/api/mcp`',
    'Session: `sessionId` required for message correlation',
    '',
    '## Available MCP Tools (22 total)',
    '',
    generateMcpToolsMarkdown(PLATFORM_MCP_TOOLS),
    '',
    '## Credits & Limits',
    '- Read operations (**list**, **get**) are always Free.',
    '- Generation operations cost **1 credit**.',
    '- Every tool response includes `_meta: { credits_remaining, plan }`.',
    '',
    '## Example Flow',
    '1. Get an API key from Settings → API Keys',
    '2. Connect to MCP via SSE at `/api/mcp`',
    '3. Call `account-usage` to check balance',
    '4. Call `mockup-generate` and check `_meta.credits_remaining`',
  ];
  return lines.join('\n');
}

function generateBrandGuidelinesMarkdown(): string {
  return `# Brand Guidelines API Reference

Base URL: \`/api/brand-guidelines\`
Auth: \`Authorization: Bearer <jwt_token>\` or \`Bearer visant_sk_xxx\`

## Overview
Brand Guidelines (Identity Vaults) are structured brand data used as context for AI generation. They maintain visual consistency across mockups, branding projects, and canvas elements.

## REST Endpoints
- \`GET /api/brand-guidelines\` — List all guidelines
- \`GET /api/brand-guidelines/:id\` — Get details by ID
- \`GET /api/brand-guidelines/public/:slug\` — Public read access (no auth)
- \`POST /api/brand-guidelines\` — Create new guideline
- \`PUT /api/brand-guidelines/:id\` — Update guideline
- \`DELETE /api/brand-guidelines/:id\` — Delete guideline
- \`GET /api/brand-guidelines/:id/context\` — Get LLM-ready context (query: \`format=prompt|structured\`, \`output=text|json\`)

## Schema
\`\`\`json
{
  "identity": { "name": "...", "tagline": "...", "description": "..." },
  "colors": [{ "hex": "#...", "name": "...", "role": "primary" }],
  "typography": [{ "family": "...", "role": "heading", "size": 32 }],
  "strategy": { "manifesto": "...", "archetypes": [], "personas": [], "voiceValues": [] },
  "guidelines": { "voice": "...", "dos": [], "donts": [] }
}
\`\`\`

## LLM Context Usage
Agents should fetch the context in \`prompt\` format to inject directly into system prompts:
\`\`\`js
const context = await fetch(\`/api/brand-guidelines/\${id}/context?format=prompt&output=text\`, { headers }).then(r => r.text());
// Inject context into LLM prompt
\`\`\``;
}

function generateFigmaNodesMarkdown(): string {
  return `# Figma Node JSON Spec

Data-driven pattern for creating Figma nodes via Plugin API. Define JSON → execute with render.ts.

**Flow:** JSON spec → collectFonts() → figma.loadFontAsync() → buildNode() recursively

## Supported Node Types
- FRAME — container with auto-layout, padding, fills, children
- RECTANGLE — solid or gradient-filled box
- ELLIPSE — circle or oval shape
- TEXT — text with full typography control

## NodeSpec Properties
| property | type | notes |
|----------|------|-------|
| type | string | 'FRAME' \\| 'RECTANGLE' \\| 'ELLIPSE' \\| 'TEXT' — required |
| name | string | Layer name — required |
| width / height | number | Applied via resize() internally |
| fills | FillSpec[] | Array of solid or gradient fills. Empty array = transparent |
| strokes | FillSpec[] | Stroke paints (same format as fills) |
| strokeWeight | number | Stroke width in pixels |
| cornerRadius | number | Rounded corners in pixels |
| opacity | number | 0–1 |
| effects | EffectSpec[] | DROP_SHADOW, INNER_SHADOW, LAYER_BLUR, BACKGROUND_BLUR |
| layoutMode | string | 'NONE' \\| 'HORIZONTAL' \\| 'VERTICAL' — FRAME only |
| primaryAxisAlignItems | string | 'MIN' \\| 'MAX' \\| 'CENTER' \\| 'SPACE_BETWEEN' |
| counterAxisAlignItems | string | 'MIN' \\| 'MAX' \\| 'CENTER' \\| 'BASELINE' |
| paddingTop/Bottom/Left/Right | number | Inner spacing — auto-layout frames only |
| itemSpacing | number | Gap between children |
| layoutSizingHorizontal | string | 'FIXED' \\| 'FILL' \\| 'HUG' — set AFTER appendChild |
| layoutSizingVertical | string | 'FIXED' \\| 'FILL' \\| 'HUG' — set AFTER appendChild |
| characters | string | Text content — TEXT only |
| fontSize | number | Font size in px — TEXT only |
| fontName | object | { family: string, style: string } — must be loaded first |
| textAlignHorizontal | string | 'LEFT' \\| 'CENTER' \\| 'RIGHT' \\| 'JUSTIFIED' |
| children | NodeSpec[] | Nested nodes — FRAME only |

## Critical Rules
- **Colors are 0–1 floats** — { r: 1, g: 0, b: 0 } = red. Never 0–255.
- **Use resize(), not width=** — width/height are read-only.
- **Load fonts before text** — figma.loadFontAsync() must complete first.
- **appendChild before layoutSizing** — FILL/HUG only works after node is in auto-layout parent.
- **fontName.style must be exact** — 'SemiBold' not 'Semi Bold'.
- **lineHeight AUTO has no value** — { unit: 'AUTO' } — omit value field.
- **Empty fills = transparent** — fills: [] removes all background.

## Fill Examples
\`\`\`json
// Solid fill
{ "type": "SOLID", "color": { "r": 0.98, "g": 0.35, "b": 0.35 }, "opacity": 1 }

// Linear gradient
{
  "type": "GRADIENT_LINEAR",
  "gradientTransform": [[0.7, 0.7, -0.1], [-0.7, 0.7, 0.7]],
  "gradientStops": [
    { "color": { "r": 0.06, "g": 0.09, "b": 0.22, "a": 1 }, "position": 0 },
    { "color": { "r": 0.40, "g": 0.06, "b": 0.20, "a": 1 }, "position": 1 }
  ]
}
\`\`\``;
}

function generateMcpMarkdown(mcpSpec: MCPSpec | null): string {
  if (!mcpSpec) return '# MCP Tools\n\nSpec not loaded yet.';

  const lines = [
    '# MCP Tools Reference',
    '',
    'Integrate Visant Labs directly into AI agents via the Model Context Protocol.',
    '',
    '## Two MCP Servers',
    '',
    '| Server | Transport | Endpoint | Tools |',
    '|--------|-----------|----------|-------|',
    '| Platform MCP | HTTP/SSE | `/api/mcp` | 22 (mockups, canvas, branding, AI) |',
    '| Figma MCP | stdio | `npm run mcp:figma` | 9 (Figma node manipulation) |',
    '',
    '## Setup — Claude Desktop',
    '',
    '```json',
    '{',
    '  "mcpServers": {',
    '    "visant-platform": {',
    '      "url": "https://your-domain.com/api/mcp",',
    '      "transport": "sse",',
    '      "headers": { "Authorization": "Bearer visant_sk_xxx" }',
    '    }',
    '  }',
    '}',
    '```',
    '',
    '## Authentication',
    '',
    'Pass your API key in every request:',
    '`Authorization: Bearer visant_sk_xxxxxxxxxxxx`',
    '',
    'Create keys at Settings → API Keys. Scopes: read, write, generate.',
    '',
    '## Figma MCP — Tool Reference',
    '',
  ];

  mcpSpec.tools.forEach(tool => {
    lines.push(`### ${tool.name}`);
    lines.push('');
    lines.push(tool.description);
    lines.push('');

    const props = Object.entries(tool.inputSchema?.properties || {});
    if (props.length > 0) {
      lines.push('**Parameters:**');
      lines.push('');
      lines.push('| name | type | required | description |');
      lines.push('|------|------|----------|-------------|');
      props.forEach(([name, prop]: [string, any]) => {
        const req = tool.inputSchema.required?.includes(name) ? 'yes' : 'no';
        lines.push(`| \`${name}\` | ${prop.type || 'string'} | ${req} | ${prop.description || '-'} |`);
      });
      lines.push('');
    }

    if (tool.examples?.[0]) {
      lines.push('**Example input:**');
      lines.push('```json');
      lines.push(JSON.stringify(tool.examples[0].input, null, 2));
      lines.push('```');
      lines.push('');
    }
  });

  return lines.join('\n');
}

function generateRestApiMarkdown(openApiSpec: OpenAPISpec | null): string {
  if (!openApiSpec) return '# REST API\n\nSpec not loaded yet.';

  const lines = [
    `# ${openApiSpec.info.title} — REST API Reference`,
    '',
    `Version: ${openApiSpec.info.version}`,
    'Auth: `Authorization: Bearer <jwt_token>`',
    '',
  ];

  const paths = openApiSpec.paths || {};
  Object.entries(paths).forEach(([path, methods]) => {
    Object.entries(methods as Record<string, any>).forEach(([method, details]) => {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) return;

      lines.push(`## ${method.toUpperCase()} ${path}`);
      lines.push('');
      if (details.summary) lines.push(details.summary);
      if (details.description) lines.push('', details.description);

      if (details.parameters?.length > 0) {
        lines.push('');
        lines.push('**Parameters:**');
        lines.push('');
        lines.push('| name | in | type | description |');
        lines.push('|------|----|------|-------------|');
        details.parameters.forEach((p: any) => {
          lines.push(`| \`${p.name}\` | ${p.in} | ${p.schema?.type || 'string'} | ${p.schema?.description || '-'} |`);
        });
      }
      lines.push('');
    });
  });

  return lines.join('\n');
}

function generateCanvasApiMarkdown(): string {
  return `# Canvas API Reference

Base URL: \`/api/canvas\`
Auth: \`Authorization: Bearer <jwt_token>\`
Content-Type: \`application/json\`

## Overview
The canvas is a React Flow graph stored as a project with \`nodes[]\` and \`edges[]\` arrays.
There is no individual node CRUD — to add/update/remove a node: GET the project, mutate the array, PUT the full array back.

**Workflow:**
1. \`POST /api/canvas\` — create project
2. \`GET /api/canvas/:id\` — fetch current nodes
3. Mutate locally
4. \`PUT /api/canvas/:id\` — persist the full nodes array

## Projects CRUD

### GET /api/canvas
List all projects for the authenticated user.
\`\`\`json
{ "projects": [{ "_id": "...", "name": "...", "nodes": [...], "edges": [...], "createdAt": "...", "updatedAt": "..." }] }
\`\`\`

### GET /api/canvas/:id
Get a single project by ID.
\`\`\`json
{ "project": { "_id": "...", "name": "...", "nodes": [...], "edges": [...] } }
\`\`\`

### POST /api/canvas
Create a new canvas project.
**Body:**
\`\`\`json
{
  "name": "My Canvas",
  "nodes": [
    {
      "id": "prompt-1",
      "type": "prompt",
      "position": { "x": 100, "y": 100 },
      "data": { "type": "prompt", "prompt": "A product photo on white background", "model": "gemini-2.5-flash" }
    }
  ],
  "edges": []
}
\`\`\`
**Response:** \`{ "project": { "_id": "abc123", ... } }\`

### PUT /api/canvas/:id
Update a project. Send only fields to change; nodes/edges require the full array.
**Body:** \`{ "name"?: string, "nodes"?: Node[], "edges"?: Edge[], "drawings"?: any[] }\`
**Limits:** max 10 000 nodes, 15 MB payload after R2 offload.

### DELETE /api/canvas/:id
Delete a project permanently.
**Response:** \`{ "success": true }\`

## Node Types
| type | description | key data fields |
|------|-------------|----------------|
| prompt | Text-to-image generation | prompt, model, aspectRatio, resolution, resultImageUrl |
| image | Display a mockup/image | mockup: { imageUrl, ... } |
| output | Result viewer | resultImageUrl, resultVideoUrl, sourceNodeId |
| merge | Combine 2+ images with AI | prompt, model, resultImageUrl |
| edit | Edit image with Mockup Machine | uploadedImage, referenceImage, tags[], model, designType |
| upscale | AI upscaling | targetResolution, resultImageUrl, connectedImage |
| mockup | AI mockup from presets | selectedPreset, selectedColors[], withHuman, customPrompt |
| text | Editable text block | text: string |
| logo | Logo upload node | logoImageUrl, logoBase64 |
| chat | Conversational AI | messages[], model, systemPrompt, connectedImage1..4 |

## Edges
\`\`\`json
{ "id": "e1", "source": "prompt-1", "target": "output-1", "sourceHandle": "output", "targetHandle": "input" }
\`\`\`

## Media Upload
- \`POST /api/canvas/image/upload\` — Upload image (base64) to R2
- \`GET /api/canvas/image/upload-url\` — Presigned URL for large images
- \`POST /api/canvas/video/upload\` — Upload video
- \`POST /api/canvas/pdf/upload\` — Upload PDF
- \`DELETE /api/canvas/image?url=<encoded>\` — Delete image

## Key Patterns for Agents
- **Node IDs must be unique** — use UUID or timestamp suffix
- **Always PUT the full nodes array** — no PATCH for individual nodes
- **Prefer R2 URLs over base64** — base64 expires after 7 days
- **Max 10,000 nodes** per project, 15 MB payload`;
}
