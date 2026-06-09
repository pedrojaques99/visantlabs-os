import express from 'express';
import { getMcpToolCount } from '../mcp/platform-mcp.js';
import {
  MCP_ENDPOINT,
  MCP_SPEC_VERSION,
  API_BASE_URL,
  FRONTEND_BASE_URL,
  SUPPORT_EMAIL,
  PLATFORM_DESCRIPTION,
} from '../lib/mcp-constants.js';

const router = express.Router();

const COMMON_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=86400',
  Link: '</llms.txt>; rel="ai-index"',
};

// ─── GET /llms.txt — concise discovery file (< 4 KB) ────────────────────────
router.get('/llms.txt', (_req, res) => {
  res.set(COMMON_HEADERS);
  res.send(`# Visant Labs

> Visant Labs is an ${PLATFORM_DESCRIPTION}

- Website: ${FRONTEND_BASE_URL}
- Full reference: ${API_BASE_URL}/llms-full.txt
- OpenAPI spec: ${API_BASE_URL}/api/docs/api/spec

## MCP Server

- Endpoint: ${MCP_ENDPOINT}
- Transport: Streamable HTTP (MCP ${MCP_SPEC_VERSION})
- Auth: OAuth 2.1 (PKCE + Dynamic Client Registration) or API key
- Tools: ${getMcpToolCount()}, all annotated with readOnlyHint / destructiveHint

## What you can do

1. **Brand Guidelines** — Create, ingest from URL, update, export, compile to CSS/Tailwind, share publicly. The \`brand-guidelines-get\` tool returns LLM-ready context you can inject into any downstream prompt.
2. **Mockup Generation** — Generate photorealistic product mockups from text prompts, optionally injecting brand context (colors, logo, typography) automatically.
3. **Creative Studio** — Generate layered marketing creatives (social posts, ads, banners) with AI-composed text, logos, and shapes.
4. **Branding Machine** — Generate a complete brand identity from a brief (name, colors, typography, strategy, archetypes).
5. **Image Tools** — Generate, describe, extract colors, change objects, apply themes, upscale.
6. **3D Studio** — Create and render 3D product scenes.
7. **Playground** — Generate interactive mini-apps from prompts.
8. **Canvas** — Collaborative design editor with variables and CSV data-merge.
9. **Budget** — AI-powered project budget estimation.
10. **Campaign** — Batch-generate creatives for a full campaign.

## How to Connect (MCP Protocol)

MCP uses JSON-RPC 2.0 over HTTP. All requests are POST to \`${MCP_ENDPOINT}\`.

1. Authenticate (see below) → get access_token
2. Initialize: \`POST ${MCP_ENDPOINT}\` with \`{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"${MCP_SPEC_VERSION}","capabilities":{},"clientInfo":{"name":"Your Agent","version":"1.0"}},"id":1}\`
   — Save the \`mcp-session-id\` response header
3. Discover tools: \`{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}\`
4. Call a tool: \`{"jsonrpc":"2.0","method":"tools/call","params":{"name":"account-profile","arguments":{}},"id":3}\`

**Important:** This is NOT a REST API. Do NOT call \`GET /auth/profile\` — use \`tools/call\` with the tool name. Persist the access token (1h lifetime) and session ID across requests. Add \`Accept: application/json\` header if your client cannot read SSE streams.

Full reference: ${API_BASE_URL}/llms-full.txt

## Authentication

**Option A — OAuth 2.1 (recommended for AI agents)**
Full Authorization Code + PKCE flow. No API key needed — the user authorizes you via browser.

1. Register: \`POST ${API_BASE_URL}/oauth/register\` with \`{"client_name": "Your Agent", "redirect_uris": ["http://localhost:..."], "grant_types": ["authorization_code"]}\`
2. Authorize: open \`${API_BASE_URL}/oauth/authorize?client_id=...&redirect_uri=...&code_challenge=...&code_challenge_method=S256&state=...&response_type=code&scope=read+write+generate\` in the user's browser
3. Exchange: \`POST ${API_BASE_URL}/oauth/token\` with \`grant_type=authorization_code&code=...&code_verifier=...&client_id=...\`
4. Refresh: \`POST ${API_BASE_URL}/oauth/token\` with \`grant_type=refresh_token&refresh_token=...\`

Discovery: \`GET ${API_BASE_URL}/.well-known/oauth-authorization-server\`
Scopes: \`read\`, \`write\`, \`generate\`

**Option B — Device Flow (recommended for agents without a local server)**
Best for Telegram bots, CLI tools, remote agents. Zero copy-paste — agent polls automatically.

1. \`POST ${API_BASE_URL}/oauth/device/code\` with \`{"client_id": "...", "scope": "read write generate"}\`
2. Show user: "Go to \`verification_uri\` and enter code: \`user_code\`" (or give them \`verification_uri_complete\`)
3. Poll \`POST ${API_BASE_URL}/oauth/token\` with \`{"grant_type": "urn:ietf:params:oauth:grant-type:device_code", "device_code": "...", "client_id": "..."}\` every 5s
4. When user approves, poll returns access_token + refresh_token

**Option C — OOB flow (fallback — manual copy-paste)**
Use \`redirect_uri=urn:ietf:wg:oauth:2.0:oob\` — user sees the code on screen and pastes it back to the agent.

**Option D — API Key (manual)**
Header: \`Authorization: Bearer visant_sk_xxx\`
Create keys at: ${FRONTEND_BASE_URL}/settings/api-keys

## Public endpoint (no auth)

\`\`\`
GET ${API_BASE_URL}/api/brand-guidelines/public/visant/context?output=text
\`\`\`

Returns the Visant Labs brand context as plain text — try it to see the output format.

## Links

- Privacy: ${FRONTEND_BASE_URL}/privacy
- Support: ${SUPPORT_EMAIL}
`);
});

// ─── GET /llms-full.txt — complete MCP reference ─────────────────────────────
router.get('/llms-full.txt', (_req, res) => {
  res.set(COMMON_HEADERS);
  res.send(`# Visant Labs — MCP Server Reference

> Complete tool reference for AI agents connecting to Visant Labs via MCP.
> Endpoint: ${MCP_ENDPOINT} | Protocol: MCP ${MCP_SPEC_VERSION} | Transport: Streamable HTTP

## How to Connect (MCP Protocol)

MCP uses JSON-RPC 2.0 over HTTP. All requests go to \`${MCP_ENDPOINT}\` as POST with \`Content-Type: application/json\`.

### Step 1 — Authenticate (get an access token)
See the Authentication section below for OAuth 2.1, Device Flow, or API key.

### Step 2 — Initialize the session
\`\`\`
POST ${MCP_ENDPOINT}
Authorization: Bearer <access_token>
Content-Type: application/json

{"jsonrpc": "2.0", "method": "initialize", "params": {"protocolVersion": "${MCP_SPEC_VERSION}", "capabilities": {}, "clientInfo": {"name": "Your Agent", "version": "1.0"}}, "id": 1}
\`\`\`
Response: \`{"jsonrpc": "2.0", "result": {"protocolVersion": "...", "capabilities": {"tools": {}}, "serverInfo": {"name": "Visant Labs", ...}}, "id": 1}\`
Save the \`mcp-session-id\` header from the response — include it in all subsequent requests.

### Step 3 — Discover available tools
\`\`\`
POST ${MCP_ENDPOINT}
Authorization: Bearer <access_token>
Mcp-Session-Id: <session_id>
Content-Type: application/json

{"jsonrpc": "2.0", "method": "tools/list", "params": {}, "id": 2}
\`\`\`
Response: list of all tools with names, descriptions, and input schemas.

### Step 4 — Call a tool
\`\`\`
POST ${MCP_ENDPOINT}
Authorization: Bearer <access_token>
Mcp-Session-Id: <session_id>
Content-Type: application/json

{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "account-profile", "arguments": {}}, "id": 3}
\`\`\`
Response: \`{"jsonrpc": "2.0", "result": {"content": [{"type": "text", "text": "..."}]}, "id": 3}\`

### Important
- **Always use \`tools/call\` with a \`name\` field** — do NOT call tool names as top-level methods.
- **Persist the access token** — reuse it for all requests until it expires (1 hour). Then use the refresh token.
- **Persist the session ID** — include the \`Mcp-Session-Id\` header in every request after initialize.
- **This is NOT a REST API** — do not try to call \`GET /auth/profile\` or similar. All communication is JSON-RPC via the single MCP endpoint.

### Response Format
By default, the server responds with **SSE (Server-Sent Events)** streams (\`text/event-stream\`). Each SSE event contains a JSON-RPC response in its \`data:\` field.

If your client does not support SSE (e.g. Python \`requests\`, simple HTTP clients), add the header:
\`\`\`
Accept: application/json
\`\`\`
The server will then return plain JSON responses instead of SSE streams. This is recommended for agents making simple request/response calls.

---

## Authentication

**Option A — OAuth 2.1 (recommended for AI agents and Claude Connectors)**
Full Authorization Code + PKCE (S256) + Dynamic Client Registration. This is the recommended flow for AI agents — no API key needed.

Discovery: \`GET ${API_BASE_URL}/.well-known/oauth-authorization-server\`
Scopes: \`read\`, \`write\`, \`generate\`

### Step-by-step OAuth flow for agents:

1. **Register your client** (one-time):
   \`\`\`
   POST ${API_BASE_URL}/oauth/register
   Content-Type: application/json

   {"client_name": "Your Agent Name", "redirect_uris": ["http://localhost:3456/callback"], "grant_types": ["authorization_code"]}
   \`\`\`
   Response: \`{"client_id": "uuid-here", ...}\`

2. **Generate PKCE pair** (per auth attempt):
   - Create a random \`code_verifier\` (43-128 chars, base64url)
   - Compute \`code_challenge\` = base64url(sha256(code_verifier))

3. **Open authorization URL** in user's browser:
   \`\`\`
   ${API_BASE_URL}/oauth/authorize?client_id=<client_id>&redirect_uri=<redirect_uri>&code_challenge=<code_challenge>&code_challenge_method=S256&state=<random>&response_type=code&scope=read+write+generate
   \`\`\`
   The user sees a login page (if needed) then a consent screen. After approval, the browser redirects to your \`redirect_uri?code=<auth_code>&state=<state>\`.

4. **Exchange code for tokens**:
   \`\`\`
   POST ${API_BASE_URL}/oauth/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code&code=<auth_code>&code_verifier=<code_verifier>&client_id=<client_id>&redirect_uri=<redirect_uri>
   \`\`\`
   Response: \`{"access_token": "jwt...", "token_type": "Bearer", "expires_in": 3600, "refresh_token": "hex...", "scope": "read write generate"}\`

5. **Use the access token**:
   \`\`\`
   Authorization: Bearer <access_token>
   \`\`\`

6. **Refresh when expired**:
   \`\`\`
   POST ${API_BASE_URL}/oauth/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=refresh_token&refresh_token=<refresh_token>&client_id=<client_id>
   \`\`\`

**Option B — Device Flow (recommended for agents without a local server)**
Best for Telegram bots, CLI tools, IoT, remote agents. User approves in browser; agent polls and gets the token automatically — no copy-paste.

1. **Request device code**:
   \`\`\`
   POST ${API_BASE_URL}/oauth/device/code
   Content-Type: application/json

   {"client_id": "<client_id>", "scope": "read write generate"}
   \`\`\`
   Response: \`{"device_code": "...", "user_code": "ABCD-1234", "verification_uri": "${API_BASE_URL}/oauth/device", "verification_uri_complete": "${API_BASE_URL}/oauth/device?code=ABCD-1234", "expires_in": 600, "interval": 5}\`

2. **Show user** the \`verification_uri_complete\` link (or \`verification_uri\` + \`user_code\` separately)

3. **Poll for token** every \`interval\` seconds:
   \`\`\`
   POST ${API_BASE_URL}/oauth/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=<device_code>&client_id=<client_id>
   \`\`\`
   Returns \`{"error": "authorization_pending"}\` until user approves, then returns \`{"access_token": "...", "refresh_token": "...", ...}\`

**Option C — OOB flow (fallback — manual copy-paste)**
If your agent can't listen on a local port, use \`redirect_uri=urn:ietf:wg:oauth:2.0:oob\`.
After the user approves, the authorization code is displayed on screen for them to copy back to the agent.
Everything else (register, PKCE, token exchange) is the same as Option A.

**Option D — API Key (manual, for scripts)**
Header: \`Authorization: Bearer visant_sk_xxx\`
Create keys at: ${FRONTEND_BASE_URL}/settings/api-keys

## Credits

AI operations consume credits. Check balance with \`account-usage\`.
Costs: mockup ~5, branding ~10, image gen ~2, creative ~3. Free tier includes starter credits.

---

## Tools (${getMcpToolCount()} total)

All tools include \`readOnlyHint\` or \`destructiveHint\` annotations.
Legend: (R) = read-only, (W) = write, (D) = destructive/delete.

### Brand Guidelines

Core differentiator: brand guidelines are INPUT for AI generation, not just static docs.

- \`brand-guidelines-list\` (R) — List user's brand guidelines (returns summary fields; full data via \`brand-guidelines-get\`)
- \`brand-guidelines-get\` (R) — Get guideline as JSON or LLM-ready prompt text. Use \`format: "prompt"\` to get injectable brand context.
- \`brand-guidelines-public\` (R) — Get public guideline by slug (no auth). Example: slug \`visant\`
- \`brand-guidelines-create\` (W) — Create guideline with identity, colors, typography, strategy, tokens
- \`brand-guidelines-update\` (W) — Patch any section; strategy sub-fields merge independently
- \`brand-guidelines-delete\` (D) — Permanently delete (requires \`confirm: true\`)
- \`brand-guidelines-ingest\` (W) — Extract brand data from URL or raw text, merge into guideline
- \`brand-guidelines-share\` (W) — Generate or revoke a public slug link
- \`brand-guidelines-invite\` (W) — Invite collaborator by email
- \`brand-guidelines-versions\` (R) — Version history with changelog
- \`brand-guidelines-restore-version\` (W) — Restore a previous version
- \`brand-guidelines-duplicate\` (W) — Clone a guideline
- \`brand-guidelines-upload-logo\` (W) — Upload logo image to guideline
- \`brand-guidelines-delete-logo\` (D) — Remove a logo by ID
- \`brand-guidelines-upload-media\` (W) — Upload media asset (photo, pattern, etc.)
- \`brand-guidelines-delete-media\` (D) — Remove media by ID
- \`brand-guidelines-export\` (R) — Export guideline as structured data
- \`brand-guidelines-compile\` (R) — Compile brand tokens to CSS, Tailwind config, or React theme
- \`brand-guidelines-health-check\` (R) — Audit guideline completeness (missing sections, weak areas)
- \`brand-guidelines-compliance-check\` (R) — Check design/text against brand rules
- \`brand-guidelines-compare-versions\` (R) — Diff two versions
- \`brand-guidelines-figma-link\` (W) — Link guideline to a Figma file
- \`brand-guidelines-figma-sync\` (W) — Sync tokens to/from Figma
- \`brand-guidelines-knowledge-list\` (R) — List knowledge base entries for a guideline

### Mockups

- \`mockup-generate\` (W) — Generate mockup from prompt. Accepts \`brandGuidelineId\` to auto-inject brand context. ~5 credits.
- \`mockup-list\` (R) — List user's mockups (paginated: \`limit\`, \`skip\`)
- \`mockup-get\` (R) — Get mockup by ID (image URL, prompt, metadata)
- \`mockup-presets\` (R) — Browse community presets by category
- \`mockup-update\` (W) — Update mockup metadata
- \`mockup-delete\` (D) — Delete mockup

### Creative Studio

- \`creative-generate\` (W) — Generate layered creative (text + logo + shapes) with brand context. ~3 credits.
- \`creative-render\` (W) — Render a creative to final image
- \`creative-full\` (W) — Generate + render in one call
- \`creative-projects-list\` (R) — List creative projects (paginated)
- \`creative-projects-get\` (R) — Get project with all layers
- \`creative-projects-create\` (W) — Create new project
- \`creative-projects-update\` (W) — Update project
- \`creative-projects-delete\` (D) — Delete project

### Branding Machine

- \`branding-generate\` (W) — Generate complete brand identity from brief. ~10 credits.
- \`branding-list\` (R) — List branding projects
- \`branding-get\` (R) — Get branding by ID
- \`branding-save\` (W) — Save/update branding
- \`branding-delete\` (D) — Delete branding

### Image & Media

- \`ai-generate-image\` (W) — Generate image from prompt. ~2 credits.
- \`upload-image\` (W) — Upload image, returns public URL
- \`ai-describe-image\` (R) — Analyze and describe an image
- \`image-extract-url\` (R) — Extract image URL from a webpage
- \`ai-extract-colors\` (R) — Extract color palette from image (hex, name, role)
- \`ai-change-object\` (W) — Replace/modify objects in an image
- \`ai-apply-theme\` (W) — Apply visual theme/style to an image
- \`moodboard-detect-grid\` (R) — Detect grid layout in a moodboard image
- \`moodboard-upscale\` (W) — Upscale a moodboard cell
- \`moodboard-suggest\` (W) — Get AI suggestions for moodboard composition
- \`video-generate\` (W) — Generate video from prompt

### AI Utilities

- \`ai-improve-prompt\` (W) — Enhance a prompt for better generation results
- \`ai-suggest-prompt-variations\` (R) — Generate alternative prompt wordings
- \`ai-generate-naming\` (W) — Generate brand/product name suggestions
- \`smart-analyze\` (R) — Multi-modal analysis of images or designs

### 3D Studio

- \`studio3d-list-presets\` (R) — Browse 3D scene presets
- \`studio3d-create-scene\` (W) — Create 3D product scene
- \`studio3d-list-scenes\` (R) — List user's scenes
- \`studio3d-get-scene\` (R) — Get scene by ID
- \`update-studio3d-scene\` (W) — Update scene
- \`delete-studio3d-scene\` (D) — Delete scene

### Playground (Mini-Apps)

- \`playground-generate\` (W) — Generate interactive mini-app from prompt
- \`playground-iterate\` (W) — Iterate/improve an existing mini-app
- \`playground-save\` (W) — Save to account
- \`playground-list\` (R) — List saved mini-apps
- \`playground-get\` (R) — Get by slug (public)
- \`playground-publish\` (W) — Publish to community feed
- \`playground-feed\` (R) — Browse published mini-apps
- \`playground-fork\` (W) — Fork a public mini-app
- \`playground-share\` (W) — Generate share link
- \`playground-quickstart\` (W) — Create from template
- \`playground-describe\` (R) — Describe a mini-app's functionality

### Canvas

- \`canvas-list\` (R) — List canvas projects
- \`canvas-get\` (R) — Get canvas by ID
- \`canvas-create\` (W) — Create new canvas
- \`canvas-update\` (W) — Update canvas
- \`canvas-delete\` (D) — Delete canvas
- \`canvas-share\` (W) — Share canvas
- \`canvas-resolve-variables\` (R) — Resolve \`{{placeholder}}\` tokens in a prompt using canvas data
- \`canvas-parse-csv\` (R) — Parse CSV for data-driven generation
- \`canvas-list-projects\` (R) — Extended list with metadata

### Budget

- \`budget-list\` (R) — List budget documents
- \`budget-get\` (R) — Get budget by ID
- \`budget-create\` (W) — Create budget from template
- \`budget-update\` (W) — Update budget
- \`budget-delete\` (D) — Delete budget
- \`budget-duplicate\` (W) — Clone a budget

### Campaign

- \`campaign-generate\` (W) — Batch-generate creatives for a campaign
- \`campaign-status\` (R) — Check generation progress

### Community

- \`community-presets\` (R) — Browse approved presets (public, paginated)
- \`community-preset-get\` (R) — Get preset by ID
- \`community-profiles\` (R) — Browse creator profiles (public)
- \`community-preset-create\` (W) — Create preset
- \`community-preset-update\` (W) — Update your preset
- \`community-preset-delete\` (D) — Delete your preset
- \`community-preset-like\` (W) — Toggle like
- \`community-my-presets\` (R) — List your presets

### Documents & PDF

- \`document-extract\` (R) — Extract text/data from documents and PDFs
- \`pdf-compress\` (R) — Compress a PDF
- \`pdf-to-images\` (R) — Convert PDF pages to images
- \`images-to-pdf\` (R) — Combine images into a PDF

### Reference Library

- \`reference-search\` (R) — Search curated mockup references
- \`reference-ingest\` (W) — Add reference to library

### Account & Auth

- \`account-usage\` (R) — Credit balance, plan limits, billing info
- \`account-profile\` (R) — User profile (name, email, plan)
- \`auth-register\` (W) — Create account (returns JWT)
- \`auth-login\` (W) — Sign in (returns JWT)
- \`api-key-create\` (W) — Generate \`visant_sk_xxx\` API key
- \`api-key-list\` (R) — List API keys (prefix only, not raw values)
- \`payments-subscription-status\` (R) — Subscription details
- \`payments-usage\` (R) — Usage breakdown
- \`payments-plans\` (R) — Available plans and pricing
- \`settings-byok-status\` (R) — BYOK (Bring Your Own Key) status

### OAuth Management

- \`oauth-authorized-apps\` (R) — List AI agents/apps authorized via OAuth
- \`oauth-revoke-app\` (D) — Revoke OAuth access for a connected app (requires \`confirm: true\`)

---

## Common Workflows

### 1. Create brand from website, then generate mockups

\`\`\`
brand-guidelines-create → brand-guidelines-ingest (url) → brand-guidelines-get (format: prompt) → mockup-generate (with brandGuidelineId)
\`\`\`

### 2. Generate a full campaign

\`\`\`
brand-guidelines-get → campaign-generate (count: 10, formats: [social, banner, card])
\`\`\`

### 3. Get brand context for external use

\`\`\`
brand-guidelines-public (slug) → returns LLM-ready text you can inject into any other agent's system prompt
\`\`\`

---

## Error Codes

All tool errors return: \`{ "error": { "code": "...", "message": "..." } }\`

| Code | Meaning |
|------|---------|
| UNAUTHORIZED | Missing or invalid auth |
| NOT_FOUND | Resource not found |
| VALIDATION_ERROR | Invalid parameters |
| INSUFFICIENT_CREDITS | Not enough credits |
| INTERNAL_ERROR | Server error |

## Rate Limits

- General API: 60 req/min per user
- AI generation: 10 req/min per user
- Rate limit headers: \`RateLimit-Limit\`, \`RateLimit-Remaining\`, \`RateLimit-Reset\`

## Links

- Website: ${FRONTEND_BASE_URL}
- Privacy: ${FRONTEND_BASE_URL}/privacy
- OpenAPI: ${API_BASE_URL}/api/docs/api/spec
- OAuth discovery: ${API_BASE_URL}/.well-known/oauth-authorization-server
- Public brand demo: ${API_BASE_URL}/api/brand-guidelines/public/visant/context?output=text
- Support: ${SUPPORT_EMAIL}
`);
});

export default router;
