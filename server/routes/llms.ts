import express from 'express';

const router = express.Router();

const COMMON_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=86400',
  'Link': '</llms.txt>; rel="ai-index"',
};

// GET /llms.txt — concise overview for AI agents
router.get('/llms.txt', (req, res) => {
  res.set(COMMON_HEADERS);
  res.send(`# Visant Labs

> AI-powered design platform for mockups, branding, budgets, and collaborative canvas.

## Capabilities

- **Mockup Generation**: AI-generated product mockups from text prompts and images
- **Branding Machine**: Complete brand identity generation (logos, colors, typography, guidelines)
- **Brand Guidelines**: Centralized identity vault to maintain visual consistency across designs
- **Canvas Editor**: Collaborative design canvas with real-time multiplayer
- **Budget Machine**: AI-powered project budget estimation and planning
- **Figma Plugin**: Direct AI generation inside Figma via plugin + MCP server
- **Community**: Public gallery of user-created mockups and designs
- **AI Tools**: Image generation, background removal, upscaling, style transfer

## For Agents (Claude Connectors)

**MCP Server**: \`POST /api/mcp\` — 22 tools via Streamable HTTP (MCP 2025-03-26)

Connect on Claude.ai:
1. Settings → Connectors → Add custom connector
2. URL: \`https://visantlabs.com/api/mcp\`
3. Auth (optional): API key \`visant_sk_xxx\`

**REST API**: Full CRUD under \`/api/*\` — see /llms-full.txt
**Auth**: API key (\`Authorization: Bearer visant_sk_xxx\`) or JWT
**Credits**: Pay-per-use; check via \`GET /api/usage/credits\`
**Rate Limits**: 60 req/min API, 10 req/min AI generation

## Documentation

- API Docs: \`/api/docs/api/spec\` (OpenAPI JSON)
- MCP Spec: \`/api/docs/plugin/mcp.json\`
- Full LLM Reference: \`/llms-full.txt\`
- Website: https://visantlabs.com
`);
});

// GET /llms-full.txt — full reference for AI agents
router.get('/llms-full.txt', (req, res) => {
  res.set(COMMON_HEADERS);
  res.send(`# Visant Labs — Full LLM Reference

> Complete API reference for AI agents and LLM integrations.

## Authentication

Two methods supported:

1. **API Key** (recommended): \`Authorization: Bearer visant_sk_xxx\`
2. **JWT Token**: \`Authorization: Bearer <jwt>\` (obtained via /api/auth/login)

API keys are generated in the user dashboard under Settings > API Keys.

## Credit System

- All AI operations consume credits
- Check balance: \`GET /api/usage/credits\`
- Purchase credits: via Stripe checkout (\`POST /api/payments/create-checkout\`)
- Credit costs vary by operation (mockup ~5 credits, branding ~10 credits, image gen ~2 credits)
- Free tier includes starter credits on signup

## MCP Server (Claude Connectors Compatible)

**Endpoint**: \`POST /api/mcp\`
**Protocol**: JSON-RPC 2.0 over Streamable HTTP (MCP 2025-03-26)

### Connect via Claude.ai

1. Go to **Settings → Connectors → Add custom connector**
2. Enter URL: \`https://visantlabs.com/api/mcp\`
3. (Optional) Add API key for authenticated access: \`visant_sk_xxx\`

### Connect Programmatically

\`\`\`bash
curl -X POST https://visantlabs.com/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "Authorization: Bearer visant_sk_xxx" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
\`\`\`

### Required Headers

| Header | Value | Required |
|--------|-------|----------|
| \`Content-Type\` | \`application/json\` | Yes |
| \`Accept\` | \`application/json, text/event-stream\` | Yes |
| \`Authorization\` | \`Bearer visant_sk_xxx\` | For authenticated tools |

### Legacy SSE Transport

For older clients: \`GET /api/mcp/sse\` (deprecated, use POST /api/mcp)

### Available Tools (22)

**Account** (requires auth):
- \`account-usage\` — Get credit balance, plan limits, billing info
- \`account-profile\` — Get user profile (name, email, plan)

**Mockups** (requires auth):
- \`mockup-list\` — List user's mockups (paginated)
- \`mockup-get\` — Get mockup by ID
- \`mockup-presets\` — Browse presets by category
- \`mockup-generate\` — Generate mockup (1 credit)

**Branding** (requires auth):
- \`branding-list\` — List branding projects
- \`branding-get\` — Get branding by ID
- \`branding-generate\` — Generate brand identity

**Canvas** (requires auth):
- \`canvas-list\` — List canvas projects
- \`canvas-get\` — Get canvas by ID
- \`canvas-create\` — Create new canvas

**Budget** (requires auth):
- \`budget-list\` — List budget documents
- \`budget-get\` — Get budget by ID
- \`budget-create\` — Create budget from template

**AI Utilities** (requires auth):
- \`ai-improve-prompt\` — Enhance prompt for better results (1 credit)
- \`ai-describe-image\` — Analyze and describe image (1 credit)

**Brand Guidelines** (requires auth for private):
- \`brand-guidelines-list\` — List user's brand guidelines
- \`brand-guidelines-get\` — Get guideline (JSON or LLM-ready prompt)
- \`brand-guidelines-public\` — Get public guideline by slug (no auth)

**Community** (no auth required):
- \`community-presets\` — Browse shared mockup presets
- \`community-profiles\` — Browse public creator profiles

## REST API Endpoints

### Auth — \`/api/auth\`
- \`POST /api/auth/register\` — Create account
- \`POST /api/auth/login\` — Login, returns JWT
- \`POST /api/auth/forgot-password\` — Request password reset
- \`POST /api/auth/reset-password\` — Reset password with token
- \`GET /api/auth/me\` — Get current user profile
- \`PUT /api/auth/profile\` — Update profile

### Mockups — \`/api/mockups\`
- \`POST /api/mockups/generate\` — Generate mockup (consumes credits)
- \`GET /api/mockups\` — List user's mockups (paginated)
- \`GET /api/mockups/:id\` — Get mockup by ID
- \`DELETE /api/mockups/:id\` — Delete mockup
- \`POST /api/mockups/:id/publish\` — Publish to community

### Mockup Tags — \`/api/mockup-tags\`
- \`GET /api/mockup-tags\` — List available tags/categories

### Branding — \`/api/branding\`
- \`POST /api/branding/generate\` — Generate brand identity (consumes credits)
- \`GET /api/branding\` — List user's brandings
- \`GET /api/branding/:id\` — Get branding by ID
- \`DELETE /api/branding/:id\` — Delete branding

### Canvas — \`/api/canvas\`
- \`POST /api/canvas\` — Create canvas
- \`GET /api/canvas\` — List user's canvases
- \`GET /api/canvas/:id\` — Get canvas by ID
- \`PUT /api/canvas/:id\` — Update canvas
- \`DELETE /api/canvas/:id\` — Delete canvas

### Brand Guidelines — \`/api/brand-guidelines\`
- \`GET /api/brand-guidelines\` — List all guidelines
- \`GET /api/brand-guidelines/:id\` — Get guideline details
- \`POST /api/brand-guidelines\` — Create new guideline
- \`PUT /api/brand-guidelines/:id\` — Update guideline
- \`DELETE /api/brand-guidelines/:id\` — Delete guideline
- \`GET /api/brand-guidelines/:id/context\` — Get LLM-ready context (text/json)
- \`POST /api/brand-guidelines/:id/share\` — Enable public sharing
- \`GET /api/brand-guidelines/public/:slug\` — Public read access
- \`GET /api/brand-guidelines/public/:slug/context\` — Public LLM context

### Budget — \`/api/budget\`
- \`POST /api/budget/generate\` — Generate budget estimate (consumes credits)
- \`GET /api/budget\` — List user's budgets
- \`GET /api/budget/:id\` — Get budget by ID
- \`DELETE /api/budget/:id\` — Delete budget
- \`GET /api/budget/shared/:shareId\` — Get shared budget (public)

### AI — \`/api/ai\`
- \`POST /api/ai/generate-image\` — Generate image from prompt
- \`POST /api/ai/remove-background\` — Remove image background
- \`POST /api/ai/upscale\` — Upscale image

### Images — \`/api/images\`
- \`POST /api/images/upload\` — Upload image
- \`GET /api/images/:id\` — Get image by ID
- \`DELETE /api/images/:id\` — Delete image

### Community — \`/api/community\`
- \`GET /api/community/posts\` — List public posts (paginated)
- \`GET /api/community/posts/:id\` — Get post details
- \`POST /api/community/posts/:id/like\` — Like a post
- \`POST /api/community/posts/:id/comment\` — Comment on a post

### Payments — \`/api/payments\`
- \`POST /api/payments/create-checkout\` — Create Stripe checkout session
- \`GET /api/payments/history\` — Get payment history

### Usage — \`/api/usage\`
- \`GET /api/usage/credits\` — Get current credit balance
- \`GET /api/usage/history\` — Get usage history

### Storage — \`/api/storage\`
- \`POST /api/storage/upload\` — Upload file to R2 storage
- \`GET /api/storage/:key\` — Get file by key

### Users — \`/api/users\`
- \`GET /api/users/:id\` — Get public user profile
- \`GET /api/users/:id/posts\` — Get user's public posts

### Referral — \`/api/referral\`
- \`GET /api/referral/code\` — Get referral code
- \`POST /api/referral/apply\` — Apply referral code

### Workflows — \`/api/workflows\`
- \`POST /api/workflows\` — Create workflow
- \`GET /api/workflows\` — List workflows
- \`GET /api/workflows/:id\` — Get workflow by ID

### Visant Templates — \`/api/visant-templates\`
- \`GET /api/visant-templates\` — List design templates
- \`GET /api/visant-templates/:id\` — Get template by ID

### Docs — \`/api/docs\`
- \`GET /api/docs/api/spec\` — OpenAPI specification (JSON)
- \`GET /api/docs/plugin/mcp.json\` — MCP tool specification (JSON)

### Figma Plugin — \`/api/plugin\`
- \`POST /api/plugin/generate\` — AI generation for Figma plugin
- \`POST /api/plugin/agent-command\` — Agent command execution
- WebSocket: \`ws://host/api/plugin/ws\` — Real-time plugin communication

## Figma Plugin MCP

Separate stdio-based MCP server for direct Figma integration.
Runs locally alongside the Figma plugin, not exposed over HTTP.

## Rate Limits

- **General API**: 60 requests/minute per user
- **AI Generation**: 10 requests/minute per user
- **Auth endpoints**: 10 requests/minute per IP
- **Health checks**: 30 requests/minute

Rate limit headers included in responses:
- \`RateLimit-Limit\`
- \`RateLimit-Remaining\`
- \`RateLimit-Reset\`

## Error Format

All errors return JSON:

\`\`\`json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "status": 400
}
\`\`\`

Common error codes:
- \`UNAUTHORIZED\` (401) — Missing or invalid auth
- \`FORBIDDEN\` (403) — Insufficient permissions
- \`NOT_FOUND\` (404) — Resource not found
- \`INSUFFICIENT_CREDITS\` (402) — Not enough credits
- \`RATE_LIMITED\` (429) — Too many requests
- \`VALIDATION_ERROR\` (400) — Invalid request body
- \`INTERNAL_ERROR\` (500) — Server error
`);
});

export default router;
