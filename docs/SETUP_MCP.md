# Using Visant via MCP

Connect any MCP-compatible AI client to Visant's full tool suite — brand guidelines, mockup generation, ad campaigns, canvas projects, and more.

**Endpoint:** `https://api.visantlabs.com/api/mcp`  
**Transport:** Streamable HTTP (MCP spec 2026, stateless)  
**Auth:** OAuth 2.1 (browser flow) or Bearer API key  

---

## Get your API key

1. Log in at [visantlabs.com](https://visantlabs.com)
2. Go to **Settings → API Keys**
3. Create a key — it starts with `visant_sk_`

---

## Claude Code CLI

Claude Code only supports stdio MCP servers, so you need `mcp-remote` as a bridge.

**Option A — OAuth (recommended, zero token config):**

Add to `.mcp.json` in your project root, or `~/.claude/mcp.json` globally:

```json
{
  "mcpServers": {
    "visant": {
      "command": "npx",
      "args": ["mcp-remote@0.1.16", "https://api.visantlabs.com/api/mcp"]
    }
  }
}
```

On first use, a browser window opens → log in to Visant → click Approve → done. Token is stored in your OS keychain. No manual token management.

**Option B — API key:**

```json
{
  "mcpServers": {
    "visant": {
      "command": "npx",
      "args": [
        "mcp-remote@0.1.16",
        "https://api.visantlabs.com/api/mcp",
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

Note: `Authorization:Bearer` has no space after the colon — this is intentional to avoid a Windows argument-splitting bug.

Verify the server is registered:

```bash
claude mcp list
```

---

## Cursor

Cursor supports Streamable HTTP natively — no `mcp-remote` needed.

Edit `~/.cursor/mcp.json`:

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

Or via UI: **Settings → MCP → Add Server → URL** → paste `https://api.visantlabs.com/api/mcp`.

---

## Claude Desktop

Edit the config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "visant": {
      "command": "npx",
      "args": [
        "mcp-remote@0.1.16",
        "https://api.visantlabs.com/api/mcp"
      ]
    }
  }
}
```

Restart Claude Desktop. On first use, the OAuth browser flow opens automatically.

---

## Other clients (VS Code, OpenAI, etc.)

Any client that supports Streamable HTTP MCP can connect directly:

```
URL:    https://api.visantlabs.com/api/mcp
Header: Authorization: Bearer visant_sk_your_key_here
```

---

## Verify the connection

```bash
# Server info — no auth required
curl https://api.visantlabs.com/api/mcp

# List tools — requires auth
curl -X POST https://api.visantlabs.com/api/mcp \
  -H "Authorization: Bearer visant_sk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## Available tools

| Tool | What it does |
|------|-------------|
| `list_brand_guidelines` | List all brands with IDs and names |
| `get_brand_guideline` | Full brand data: colors, fonts, voice, tokens, gradients |
| `update_brand_guideline` | Patch any brand fields |
| `validate_brand_section` | Mark a section approved / needs_work |
| `get_brand_design_system` | LLM-ready design tokens for a brand |
| `get_brand_insights` | Learned brand preferences from edit history |
| `create_creative_plan` | Generate a layout plan for a marketing asset |
| `generate_mockup` | Text-to-image or img2img mockup (OpenAI / Gemini / Seedream) |
| `batch_generate_mockups` | Up to 20 mockups in parallel |
| `create_ad_campaign` | Full campaign from product image + brief |
| `get_campaign_results` | Poll campaign generation progress |
| `improve_prompt` | Refine an image generation prompt |
| `generate_smart_prompt` | Build an optimized prompt from structured inputs |
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

## For AI agents

When an AI needs to work with Visant, the recommended flow is:

```
1. list_brand_guidelines          → find the brand by name, get its ID
2. get_brand_guideline(brandId)   → load full brand context
3. Use brand colors/fonts/voice to inform generation
4. generate_mockup or batch_generate_mockups with brandGuidelineId
```

Passing `brandGuidelineId` to generation tools automatically injects brand context into the prompt — no manual prompt engineering needed.

**Example prompt for an AI:**
> "List my brand guidelines, find Movitera, then generate 3 background concepts using its gradient palette."

The AI will call `list_brand_guidelines` → `get_brand_guideline` → `batch_generate_mockups` in sequence.

---

## Troubleshooting

**401 Unauthorized** — Token missing or invalid. Check Settings → API Keys or re-run the OAuth flow.

**`mcp-remote` hangs on Windows** — The `Authorization:Bearer` arg must have no space after the colon.

**OAuth browser doesn't open** — Make sure you're on `mcp-remote@0.1.16` or later: `npx mcp-remote@0.1.16 --version`.

**Tools return "Visant API 401"** — Your API key may lack permissions. Check the key's scope in Settings.
