# Visant MCP Server

Visant exposes its full Creative Studio and Brand Intelligence as MCP tools.
Any MCP-compatible client can call brand guidelines, generate mockups, run campaigns, and more.

**Endpoint:** `https://api.visantlabs.com/api/mcp`
**Auth:** OAuth 2.1 (automatic) or API key (`visant_sk_...`)
**Transport:** Streamable HTTP (MCP spec 2025-03-26, stateless)
**Scopes:** `read`, `write`, `generate`

---

## Quick Start

### Claude Code (recommended)

```bash
claude mcp add --transport http visant https://api.visantlabs.com/api/mcp
```

OAuth 2.1 flow is fully automatic — Claude Code discovers the auth server, opens a browser consent page, and stores tokens in the OS keychain. No manual token management needed.

### Visant CLI (alternative)

```bash
npm i -g visantlabs
visant login        # authenticate via browser
visant setup        # writes MCP config to .claude/settings.json
```

---

## Authentication Methods

### 1. OAuth 2.1 + PKCE (recommended)

Zero-config for MCP clients that support HTTP transport. The flow:

1. Client calls `POST /api/mcp` → gets `401` with `WWW-Authenticate` header
2. Client discovers `/.well-known/oauth-protected-resource` → finds auth server
3. Client discovers `/.well-known/oauth-authorization-server` → gets OAuth endpoints
4. Dynamic Client Registration (`POST /oauth/register`) — no pre-registration needed
5. Browser opens consent page → user approves
6. Authorization code exchange with PKCE (S256) → access + refresh tokens
7. Automatic token refresh — no manual intervention

### 2. API Key (for automation / CI / legacy clients)

1. Log in at [visantlabs.com](https://visantlabs.com)
2. Go to **Settings → API Keys**
3. Create a new key — it starts with `visant_sk_`
4. Pass as `Authorization: Bearer visant_sk_...` header

---

## Client Setup

### Claude Desktop

Uses OAuth automatically with HTTP transport:

```json
{
  "mcpServers": {
    "visant": {
      "type": "http",
      "url": "https://api.visantlabs.com/api/mcp"
    }
  }
}
```

### Cursor

Cursor supports Streamable HTTP natively:

```json
{
  "mcpServers": {
    "visant": {
      "url": "https://api.visantlabs.com/api/mcp"
    }
  }
}
```

Or use the Cursor UI: **Settings → MCP → Add Server → URL** and paste `https://api.visantlabs.com/api/mcp`.

For clients without OAuth support, use API key in headers:
```json
{
  "mcpServers": {
    "visant": {
      "url": "https://api.visantlabs.com/api/mcp",
      "headers": {
        "Authorization": "Bearer visant_sk_your_key_here"
      }
    }
  }
}
```

### OpenAI (Responses API)

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="gpt-4o",
    tools=[{
        "type": "mcp",
        "server_url": "https://api.visantlabs.com/api/mcp",
        "headers": {"Authorization": "Bearer visant_sk_your_key_here"},
    }],
    input="List my brand guidelines",
)
```

### Local Development (stdio)

For development against a local server:

```bash
npm run mcp:visant
```

Uses `~/.visant/credentials.json` for auth (created by `visant login`).

---

## OAuth Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/.well-known/oauth-authorization-server` | GET | OAuth server metadata (RFC 8414) |
| `/.well-known/oauth-protected-resource` | GET | Resource server metadata (RFC 9728) |
| `/oauth/register` | POST | Dynamic Client Registration (RFC 7591) |
| `/oauth/authorize` | GET | Authorization + consent page |
| `/oauth/authorize` | POST | User approve/deny |
| `/oauth/token` | POST | Token exchange (auth code + refresh) |
| `/oauth/revoke` | POST | Token revocation (RFC 7009) |

---

## Scopes

| Scope | Description | Tool pattern |
|-------|-------------|-------------|
| `read` | List and get resources | `list-*`, `get-*` |
| `write` | Create, update, delete | `create-*`, `update-*`, `delete-*` |
| `generate` | AI generation features | `generate-*`, `improve-*`, `batch-*` |

Default OAuth consent grants all three scopes.

---

## Verify Connection

```bash
# Check OAuth discovery (no auth)
curl https://api.visantlabs.com/.well-known/oauth-authorization-server

# Check MCP discovery (no auth)
curl https://api.visantlabs.com/.well-known/mcp.json

# Test tool listing (requires auth)
curl -X POST https://api.visantlabs.com/api/mcp \
  -H "Authorization: Bearer visant_sk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## Available Tools (40+)

| Tool | Scope | Description |
|------|-------|-------------|
| `list_brand_guidelines` | read | List all brands |
| `get_brand_guideline` | read | Full brand data |
| `update_brand_guideline` | write | Patch brand fields |
| `validate_brand_section` | write | Mark section approved/needs_work |
| `get_brand_design_system` | read | LLM-ready design tokens |
| `get_brand_insights` | read | Learned preferences from edit history |
| `create_creative_plan` | generate | Layout plan for marketing assets |
| `generate_mockup` | generate | Text-to-image / img2img |
| `batch_generate_mockups` | generate | Up to 20 mockups in parallel |
| `create_ad_campaign` | generate | Full campaign from product image |
| `get_campaign_results` | read | Poll campaign progress |
| `improve_prompt` | generate | Refine image generation prompt |
| `generate_smart_prompt` | generate | Prompt from structured inputs |
| `suggest_prompt_variations` | generate | Prompt variations |
| `extract_prompt_from_image` | generate | Reverse-engineer prompt from image |
| `extract_colors` | generate | Color palette from image |
| `generate_naming` | generate | Brand/product name suggestions |
| `generate_persona` | generate | Audience persona |
| `generate_archetype` | generate | Brand archetype analysis |
| `generate_color_palettes` | generate | AI color palettes |
| `generate_moodboard` | generate | Moodboard direction |
| `generate_market_research` | generate | Market benchmarking |
| `generate_swot` | generate | SWOT analysis |
| `generate_concept_ideas` | generate | Mockup scenario ideas |
| `document_extract` | generate | PDF to markdown + brand tokens |
| `list_mockups` | read | List user mockups |
| `get_mockup` | read | Get mockup by ID |
| `delete_mockup` | write | Delete a mockup |
| `list_canvas_projects` | read | List canvas projects |
| `create_canvas_project` | write | Create canvas project |
| `update_canvas_project` | write | Update canvas project |
| `delete_canvas_project` | write | Delete canvas project |
| `list_creative_events` | read | Creative edit event stream |
| `get_creative_metrics` | read | Aggregate creative metrics |
| `list_public_mockups` | read | Public mockup templates |

---

## Troubleshooting

**401 Unauthorized** — OAuth token expired (should auto-refresh) or API key invalid. Re-run `visant login` or check Settings → API Keys.

**OAuth consent page doesn't open** — Ensure your MCP client supports HTTP transport. If not, use API key auth as fallback.

**Tools return FORBIDDEN** — Your OAuth token may lack the required scope. Re-authorize to get all scopes.

**Local dev 401** — Ensure `npm run dev` is running on port 3001. The stdio MCP server defaults to `localhost:3001`.
