# Visant MCP Server

Visant exposes its full Creative Studio and Brand Intelligence as MCP tools.
Any MCP-compatible client can call brand guidelines, generate mockups, run campaigns, and more.

**Endpoint:** `https://visantlabs.com/api/mcp`
**Auth:** `Authorization: Bearer visant_sk_...`
**Transport:** Streamable HTTP (MCP spec 2026, stateless)

---

## Get your API key

1. Log in at [visantlabs.com](https://visantlabs.com)
2. Go to **Settings -> API Keys**
3. Create a new key -- it starts with `visant_sk_`

---

## Claude Code CLI (local stdio, recommended for development)

Add to `~/.claude/mcp.json` or `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "visant": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://visantlabs.com/api/mcp",
        "--header",
        "Authorization:Bearer ${VISANT_API_TOKEN}"
      ],
      "env": {
        "VISANT_API_TOKEN": "visant_sk_your_key_here"
      }
    }
  }
}
```

Then run `claude mcp list` to verify the server is registered.

---

## Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or
`%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "visant": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://visantlabs.com/api/mcp",
        "--header",
        "Authorization:Bearer ${VISANT_API_TOKEN}"
      ],
      "env": {
        "VISANT_API_TOKEN": "visant_sk_your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

---

## Cursor

Cursor supports native Streamable HTTP -- no `mcp-remote` needed.

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "visant": {
      "url": "https://visantlabs.com/api/mcp",
      "headers": {
        "Authorization": "Bearer visant_sk_your_key_here"
      }
    }
  }
}
```

Or use the Cursor UI: **Settings -> MCP -> Add Server -> URL** and paste `https://visantlabs.com/api/mcp`.

---

## VS Code (Continue extension or MCP extension)

Add to your Continue config (`~/.continue/config.json`):

```json
{
  "mcpServers": [
    {
      "name": "visant",
      "transport": {
        "type": "http",
        "url": "https://visantlabs.com/api/mcp",
        "headers": {
          "Authorization": "Bearer visant_sk_your_key_here"
        }
      }
    }
  ]
}
```

---

## OpenAI (Responses API / Assistants with MCP)

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="gpt-4o",
    tools=[{
        "type": "mcp",
        "server_url": "https://visantlabs.com/api/mcp",
        "headers": {"Authorization": "Bearer visant_sk_your_key_here"},
    }],
    input="List my brand guidelines",
)
```

---

## Verify the connection

```bash
# Check server info (no auth required)
curl https://visantlabs.com/api/mcp

# Test tool listing (requires auth)
curl -X POST https://visantlabs.com/api/mcp \
  -H "Authorization: Bearer visant_sk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## Available tools

| Tool | Description |
|------|-------------|
| `list_brand_guidelines` | List all brands with ids and names |
| `get_brand_guideline` | Full brand data (colors, fonts, voice, tokens) |
| `update_brand_guideline` | Patch any brand fields |
| `validate_brand_section` | Mark a section approved / needs_work |
| `get_brand_design_system` | LLM-ready design tokens for a brand |
| `get_brand_insights` | Learned brand preferences from edit history |
| `create_creative_plan` | Generate a layout plan for a marketing asset |
| `generate_mockup` | Text-to-image or img2img mockup generation |
| `batch_generate_mockups` | Generate up to 20 mockups in parallel |
| `create_ad_campaign` | Full campaign from product image + brief |
| `get_campaign_results` | Poll campaign generation progress |
| `improve_prompt` | Refine an image generation prompt |
| `generate_smart_prompt` | Build a prompt from structured inputs |
| `suggest_prompt_variations` | Generate prompt variations |
| `extract_prompt_from_image` | Reverse-engineer a prompt from an image |
| `extract_colors` | Extract color palette from an image |
| `generate_naming` | Brand/product name suggestions |
| `generate_persona` | Audience persona from a brief |
| `generate_archetype` | Brand archetype analysis |
| `generate_color_palettes` | AI color palette recommendations |
| `generate_moodboard` | Moodboard direction from a brief |
| `generate_market_research` | Market benchmarking paragraph |
| `generate_swot` | SWOT analysis |
| `generate_concept_ideas` | Mockup/usage scenario ideas |
| `list_mockups` | List user mockups |
| `get_mockup` | Get mockup by ID |
| `delete_mockup` | Delete a mockup |
| `get_mockup_usage_stats` | Billing period usage stats |
| `list_canvas_projects` | List canvas projects |
| `get_canvas_project` | Get canvas project by ID |
| `create_canvas_project` | Create a new canvas project |
| `update_canvas_project` | Update a canvas project |
| `delete_canvas_project` | Delete a canvas project |
| `list_creative_events` | Raw creative edit event stream |
| `get_creative_metrics` | Aggregate creative metrics |
| `list_public_mockups` | Public blank mockup templates |

---

## Troubleshooting

**401 Unauthorized** -- Token is missing, expired, or not a `visant_sk_` key. Check Settings -> API Keys.

**mcp-remote hangs on Windows** -- The `Authorization:Bearer` arg must have no space after the colon. This is a known Windows argument-splitting issue with npx.

**Tools return "Visant API 401"** -- The tool is calling the internal API with your key. Your key may lack permissions or the session expired.

**Server info endpoint** -- `GET https://visantlabs.com/api/mcp` returns `{ transport, mode, tools }` without auth. Use this to verify the endpoint is reachable.
