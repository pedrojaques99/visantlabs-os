/**
 * Markdown Generators for DocsPage
 * Generates clean markdown for "Copy as Markdown" feature — optimized for LLM context injection.
 * All content sourced from server — no hardcoded static data.
 */

import type { OpenAPISpec, MCPSpec, PricingData } from '../hooks/useDocsData';

type TabId = 'overview' | 'api' | 'mcp' | 'plugin' | 'figma-nodes' | 'canvas-api' | 'brand-guidelines' | 'agents' | 'pricing';

export function generateTabMarkdown(
  tab: TabId,
  mcpSpec: MCPSpec | null,
  openApiSpec: OpenAPISpec | null,
  platformMcpSpec?: MCPSpec | null,
  pricingData?: PricingData | null
): string {
  switch (tab) {
    case 'canvas-api':      return generateCanvasApiMarkdown();
    case 'mcp':             return generateMcpMarkdown(mcpSpec);
    case 'api':             return generateRestApiMarkdown(openApiSpec);
    case 'figma-nodes':     return generateFigmaNodesMarkdown();
    case 'brand-guidelines':return generateBrandGuidelinesMarkdown();
    case 'agents':          return generateAgentsMarkdown(platformMcpSpec);
    case 'plugin':          return generatePluginMarkdown();
    case 'pricing':         return generatePricingMarkdown(pricingData);
    case 'overview':
    default:                return generateOverviewMarkdown();
  }
}

function generateOverviewMarkdown(): string {
  return `# Visant Copilot API

Auth: \`Authorization: Bearer <jwt_token>\`
Token: \`POST /api/auth/login\` → \`{ "email": "...", "password": "..." }\``;
}

function generatePluginMarkdown(): string {
  return `# Figma Plugin — Visant Copilot

## Installation
1. Open any file in Figma.
2. Go to **Resources > Plugins** and search for **Visant Copilot**.
3. Click **Run** to launch the plugin panel.
4. Sign in with your Visant account to unlock brand-aware features and credit-based generation.

## AI Chat
Describe what you want in natural language — the AI creates, edits, and organizes Figma nodes automatically.

**Features:**
- **@mentions** — type \`@\` to reference layers, components, or variables by name. The AI resolves them to real node IDs.
- **Multimodal input** — drag-and-drop or paste images directly into the chat input for visual context.
- **Brand context** — select a Brand Guideline to inject colors, typography, and tone into every prompt.
- **\`/clear\` command** — type \`/clear\` to reset chat history.
- **Clickable layer refs** — operation summaries show \`@"LayerName"\` links that select and zoom to the referenced layer.
- **Copy & select** — hover any message bubble for a copy button; text is fully selectable.

## Supported Operations (42+)

### Creation
\`CREATE_PAGE\`, \`CREATE_FRAME\`, \`CREATE_RECTANGLE\`, \`CREATE_ELLIPSE\`, \`CREATE_TEXT\`, \`CREATE_COMPONENT_INSTANCE\`, \`CREATE_COMPONENT\`, \`CREATE_SVG\`, \`CREATE_ICON\`, \`CREATE_LINE\`, \`CREATE_POLYGON\`, \`CREATE_STAR\`

### Clone & Duplicate
\`CLONE_NODE\` (by name or ID), \`DUPLICATE_NODE\` — preserves all children (logos, images, components). Supports \`textOverrides\` to replace text in cloned templates.

### Edit / Style
\`SET_FILL\`, \`SET_STROKE\`, \`SET_IMAGE_FILL\`, \`SET_CORNER_RADIUS\`, \`SET_INDIVIDUAL_CORNERS\`, \`SET_EFFECTS\`, \`SET_AUTO_LAYOUT\`, \`SET_OPACITY\`, \`SET_BLEND_MODE\`, \`SET_TEXT_CONTENT\`, \`SET_TEXT_STYLE\`, \`SET_TEXT_RANGES\`, \`SET_CONSTRAINTS\`, \`SET_LAYOUT_GRID\`, \`RESIZE\`, \`MOVE\`, \`RENAME\`, \`REORDER_CHILD\`, \`RECOLOR_NODE\`

### Structure
\`GROUP_NODES\`, \`UNGROUP\`, \`DELETE_NODE\`, \`DETACH_INSTANCE\`, \`BOOLEAN_OPERATION\` (union, subtract, intersect, exclude), \`COMBINE_AS_VARIANTS\`

### Variables & Tokens
\`APPLY_VARIABLE\`, \`APPLY_STYLE\`, \`CREATE_VARIABLE\`, \`CREATE_COLOR_VARIABLES_FROM_SELECTION\`, \`BIND_NEAREST_COLOR_VARIABLES\`

### Inspection (MCP)
\`GET_DESIGN_CONTEXT\`, \`GET_VARIABLE_DEFS\`, \`GET_SCREENSHOT\`, \`SEARCH_DESIGN_SYSTEM\`, \`GET_CODE_CONNECT_MAP\`, \`ADD_CODE_CONNECT_MAP\`

All operations use JSON format: \`[{ "type": "OPERATION_TYPE", ...params }]\`

## AI Prompt System (V2 — Intent-Driven)

### Architecture
The AI prompt is assembled dynamically based on intent, not as a monolithic blob. This reduces tokens by ~70% and improves accuracy.

\`\`\`
User Prompt > classifyIntent() > assemblePrompt() > LLM > operations[]
                  |                    |
          keyword patterns      modules by intent
          + optional LLM        (only relevant ops)
            pre-pass
\`\`\`

### Intent Classification (Two-Tier)
1. **Fast keyword classifier** (~0ms) — regex-based detection of intent (\`create\`, \`edit\`, \`clone\`, \`arrange\`, \`chat\`), format (\`instagram_feed\`, \`stories\`, etc.), and complexity.
2. **LLM pre-pass** (optional, ~200ms) — when keyword confidence < 0.65, a lightweight Flash Lite call extracts structured params: \`sourceFrame\`, \`cloneCount\`, \`modifications[]\`.

### Module System
Prompt sections are injected by priority based on detected intent:

| Module | Priority | When injected |
|--------|----------|---------------|
| \`think_mode\` | 99 | Think mode enabled |
| \`feedback\` | 98 | Retrying after errors |
| \`selection\` | 95 | Frame(s) selected |
| \`history\` | 92 | Chat history exists |
| \`preset\` | 90 | Format detected (Stories, Feed...) |
| \`brand\` | 85 | Brand guideline active |
| \`template_rules\` | 85 | Clone intent |
| \`create_rules\` | 80 | Create intent |
| \`edit_rules\` | 80 | Edit intent |
| \`create_example\` | 70 | Complex creation (few-shot) |
| \`components\` | 50 | Available components |
| \`color_vars\` | 45 | Color variables available |

### Brand-Aware Context
When a Brand Guideline is active, the prompt receives:
- **Colors** — palette with roles (Primary, Accent, CTA, Background)
- **Typography** — principal (headings) and secondary (body) families with available weights
- **Logos** — light/dark variants for cloning via \`CLONE_NODE sourceName\`
- **Design tokens** — spacing, radius from the brand guideline
- **Voice & rules** — brand voice, dos/don'ts as hard constraints

Brand context overrides generic styles (e.g., "Inter" is never used when brand fonts exist).

### Feedback Loop
When operations fail validation (>50% invalid), the system automatically retries with:
- Lower temperature (0.1 vs 0.2)
- Error feedback injected at priority 98 (seen before all other modules)
- Specific error messages per operation type

### Clone-First Strategy
When the user asks for "variations", "more like this", or "same style" with a frame selected:
1. The intent classifier detects \`clone\` intent
2. \`CLONE_NODE\` is prioritized over \`CREATE_*\` operations
3. \`textOverrides\` replace text in cloned children by layer name
4. This preserves logos, images, shapes, and complex layers that can't be recreated

## Brand Guidelines
- Select a brand guideline from the sidebar to inject identity context (colors, typography, tone, tokens, voice) into every AI prompt.
- The last selected brand **persists across sessions** via Figma pluginData — no need to re-select each time.
- Brand context is sent alongside the user prompt to the server, ensuring brand-consistent outputs.

## Smart Scan (REQUEST_SCAN)
When the AI needs context beyond the current selection, it automatically emits a \`REQUEST_SCAN\` operation. This triggers a full page scan, re-sending the command with complete page context. The scan status appears as a tool call in the chat UI.

## Plugin API (for developers)

### Architecture
\`\`\`
Figma Sandbox (code.ts) <> UI iframe (React) --SSE--> POST /api/plugin/stream (Claude/Gemini)
                        <-- APPLY_OPERATIONS ----------
\`\`\`

Two AI provider paths:
- **Streaming (default):** \`POST /api/plugin/stream\` — SSE with Claude (agentic, multi-turn with web search)
- **Direct (fallback):** \`POST /api/figma/generate\` — Gemini structured JSON output

### POST /api/plugin/stream
SSE endpoint. Receives serialized selection + brand context + user prompt. Streams events: \`status\`, \`thinking\`, \`text\`, \`operations\`, \`done\`.

### Operation JSON Format
\`\`\`json
[
  { "type": "CREATE_FRAME", "ref": "card", "props": { "name": "Card 300x200", "width": 300, "height": 200 } },
  { "type": "CREATE_TEXT", "parentRef": "card", "props": { "content": "Hello", "fontSize": 16 } },
  { "type": "CLONE_NODE", "ref": "v2", "sourceName": "card", "textOverrides": [{ "name": "Hello", "content": "World" }] }
]
\`\`\`

\`ref\` creates a named reference; \`parentRef\` nests inside a previously created node; \`parentNodeId\` nests inside an existing Figma node by ID; \`sourceName\` clones by layer name; \`autoPosition: "right"\` auto-positions frames side by side.

### Quality Assurance
After operations are applied, an \`auditCreatedNodes()\` pass checks for:
- Text truncation (\`textTruncation === 'ENDING'\`)
- Double-fixed sizing on text (causes clipping)
- Incorrect layout sizing in auto-layout context
- Structural white frames (unnecessary solid fills)
- Child overflow parent bounds

Violations are reported in the \`OPERATIONS_DONE\` message telemetry.`;
}

function generateAgentsMarkdown(platformMcpSpec?: MCPSpec | null): string {
  const tools = platformMcpSpec?.tools ?? [];
  const toolCount = tools.length;

  const toolTable = tools.length > 0
    ? ['| Tool | Description | Cost |', '|------|-------------|------|',
       ...tools.map(t => `| \`${t.name}\` | ${t.description} | ${t['x-cost'] ?? 'free'} |`)
      ].join('\n')
    : '_Tool list not loaded — fetch /api/docs/platform/mcp.json_';

  return [
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
    `## Available MCP Tools (${toolCount} total)`,
    '',
    toolTable,
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
  ].join('\n');
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

function generatePricingMarkdown(pricingData?: PricingData | null): string {
  if (!pricingData) return '# Pricing\n\nPricing data not loaded yet.';

  const { creditCosts, creditPackages, infraCosts } = pricingData;
  const lines: string[] = ['# Visant Copilot — Pricing Guide', ''];

  // Credit cost breakdown
  lines.push('## Credit Costs by Model & Resolution', '');
  lines.push('| Model | Resolution | Google Price (USD) | Visant Overhead | Total Cost | Credits |');
  lines.push('|-------|------------|--------------------|-----------------|------------|---------|');

  const imageCosts = creditCosts.filter(t => t.category === 'image');
  const imageTotalOverhead = infraCosts
    ? (infraCosts.IMAGE_PROCESSING ?? 0) + (infraCosts.IMAGE_CDN ?? 0) + (infraCosts.IMAGE_API_OVERHEAD ?? 0)
    : 0.013;

  imageCosts.forEach(t => {
    const total = t.googlePriceUSD + imageTotalOverhead;
    lines.push(`| ${t.model} | ${t.resolution} | $${t.googlePriceUSD.toFixed(3)} | $${imageTotalOverhead.toFixed(3)} | **$${total.toFixed(3)}** | ${t.creditsRequired} |`);
  });
  lines.push('');

  // Video costs
  const videoCosts = creditCosts.filter(t => t.category === 'video');
  if (videoCosts.length > 0) {
    lines.push('## Video Generation', '');
    lines.push('| Model | Resolution | Cost per 8s | Credits |');
    lines.push('|-------|------------|-------------|---------|');
    videoCosts.forEach(t => {
      lines.push(`| ${t.model} | ${t.resolution} | $${t.googlePriceUSD.toFixed(2)} | ${t.creditsRequired} |`);
    });
    lines.push('');
  }

  // Other costs
  const otherCosts = creditCosts.filter(t => t.category !== 'image' && t.category !== 'video');
  if (otherCosts.length > 0) {
    lines.push('## Other Operations', '');
    otherCosts.forEach(t => {
      lines.push(`- **${t.model}** (${t.resolution}): ${t.creditsRequired} credit${t.creditsRequired > 1 ? 's' : ''}`);
    });
    lines.push('');
  }

  // Infrastructure breakdown
  if (infraCosts) {
    lines.push('## Infrastructure Overhead (per image)', '');
    if (infraCosts.IMAGE_PROCESSING) lines.push(`- **Image processing** — Resizing, optimization, format conversion ($${infraCosts.IMAGE_PROCESSING.toFixed(3)})`);
    if (infraCosts.IMAGE_CDN) lines.push(`- **CDN delivery** — Cloudflare R2 storage + global delivery ($${infraCosts.IMAGE_CDN.toFixed(3)})`);
    if (infraCosts.IMAGE_API_OVERHEAD) lines.push(`- **API overhead** — Rate limiting, auth, monitoring ($${infraCosts.IMAGE_API_OVERHEAD.toFixed(3)})`);
    lines.push('');
  }

  // Credit packages
  if (creditPackages?.length > 0) {
    lines.push('## Credit Packages', '');
    lines.push('| Credits | Price (BRL) | Price (USD) | Per Credit | ~HD Images | ~4K Images | ~Fast Videos |');
    lines.push('|---------|-------------|-------------|------------|-----------|-----------|-------------|');
    creditPackages.forEach(pkg => {
      lines.push(`| ${pkg.credits} | R$${pkg.priceBRL.toFixed(2)} | $${pkg.priceUSD.toFixed(2)} | $${pkg.pricePerCreditUSD.toFixed(3)} | ~${pkg.imagesHD} | ~${pkg.images4K} | ~${pkg.videosFast} |`);
    });
  }

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
