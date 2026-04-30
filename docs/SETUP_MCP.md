# Using Visant via MCP

Connect any MCP-compatible AI client to Visant's full tool suite — brand guidelines, mockup generation, creatives, canvas, and budgets.

**Endpoint:** `https://visantlabs.com/api/mcp`  
**Transport:** Streamable HTTP (MCP spec 2025-03-26, stateless)  
**Auth:** Bearer API key  

> **Full tool reference + agent workflows:** `.agent/memory/MCP-GETTING-STARTED.md`

---

## Get your API key

1. Log in at [visantlabs.com](https://visantlabs.com)
2. Go to **Settings → API Keys**
3. Create a key — it starts with `visant_sk_`

---

## Claude Code CLI

Claude Code only supports stdio MCP servers, so you need `mcp-remote` as a bridge.

Add to `.mcp.json` in your project root, or `~/.claude/mcp.json` globally:

**Option A — OAuth (recommended, zero token config):**
```json
{
  "mcpServers": {
    "visant": {
      "command": "npx",
      "args": ["mcp-remote@0.1.16", "https://visantlabs.com/api/mcp"]
    }
  }
}
```
On first use, a browser window opens → log in → click Approve → done. Token stored in OS keychain.

**Option B — API key:**
```json
{
  "mcpServers": {
    "visant": {
      "command": "npx",
      "args": [
        "mcp-remote@0.1.16",
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
Note: `Authorization:Bearer` has no space after the colon — avoids a Windows argument-splitting bug.

Verify:
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
      "url": "https://visantlabs.com/api/mcp",
      "headers": {
        "Authorization": "Bearer visant_sk_your_key_here"
      }
    }
  }
}
```

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
      "args": ["mcp-remote@0.1.16", "https://visantlabs.com/api/mcp"]
    }
  }
}
```
Restart Claude Desktop. OAuth browser flow opens on first use.

---

## Claude.ai Web

1. **Settings → Integrations → Add custom MCP**
2. URL: `https://visantlabs.com/api/mcp`
3. Header: `Authorization: Bearer visant_sk_xxx`

---

## Other clients (VS Code, OpenAI, etc.)

Any client that supports Streamable HTTP MCP:
```
URL:    https://visantlabs.com/api/mcp
Header: Authorization: Bearer visant_sk_your_key_here
```

---

## Verify the connection

```bash
# Server info — no auth required
curl https://visantlabs.com/api/mcp

# List tools
curl -X POST https://visantlabs.com/api/mcp \
  -H "Authorization: Bearer visant_sk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## Available tools (67)

### Account
| Tool | Description |
|------|-------------|
| `account-usage` | Credits, plan, reset date, `can_generate` flag |
| `account-profile` | Name, email, avatar, subscription |

### Auth *(no API key needed)*
| Tool | Description |
|------|-------------|
| `auth-register` | Create account → returns JWT for `api-key-create` |
| `auth-login` | Sign in → returns JWT for `api-key-create` |
| `api-key-create` | Create a `visant_sk_xxx` key (pass JWT or existing key) |
| `api-key-list` | List all keys (no raw values shown) |

### Mockups
| Tool | Description |
|------|-------------|
| `mockup-generate` | Generate image. Key params: `prompt`, `brandGuidelineId`, `model`, `aspectRatio`, `resolution` |
| `mockup-list` | List user mockups |
| `mockup-get` | Get mockup by ID |
| `mockup-update` | Update metadata (no regeneration) |
| `mockup-delete` | Delete mockup |
| `mockup-presets` | Browse presets by type |
| `mockup-list-public` | Public blank templates (no auth) |

### Branding
| Tool | Description |
|------|-------------|
| `branding-generate` | Brand identity from prompt. `step`: full / market-research / swot / persona / archetype / concept-ideas / color-palettes / moodboard |
| `branding-list` | List branding projects |
| `branding-get` | Get branding project |
| `branding-save` | Create or update branding project |
| `branding-delete` | Delete branding project |

### Brand Guidelines — Read
| Tool | Description |
|------|-------------|
| `brand-guidelines-list` | List all brand vaults |
| `brand-guidelines-get` | Get by ID. `format`: structured (JSON) or prompt (LLM-ready text) |
| `brand-guidelines-public` | Public guideline by slug (no auth) |

### Brand Guidelines — Write
| Tool | Description |
|------|-------------|
| `brand-guidelines-create` | Create vault. Requires `identity.name`. All other sections optional. |
| `brand-guidelines-update` | Patch specific sections (only provided fields change) |
| `brand-guidelines-delete` | Delete (requires `confirm: true`) |
| `brand-guidelines-duplicate` | Clone a guideline |

### Brand Guidelines — Assets & Intelligence
| Tool | Description |
|------|-------------|
| `brand-guidelines-upload-logo` | Upload logo (base64 or URL). Variants: primary / dark / light / icon / accent / custom |
| `brand-guidelines-delete-logo` | Remove logo by ID |
| `brand-guidelines-upload-media` | Upload to media kit (image or PDF) |
| `brand-guidelines-delete-media` | Remove media asset |
| `brand-guidelines-ingest` | Extract brand data from URL or text and merge |
| `brand-guidelines-compliance-check` | AI audit: contrast, typography, voice, completeness |
| `brand-guidelines-share` | Generate public read-only link |
| `brand-guidelines-versions` | Version history |
| `brand-guidelines-restore-version` | Restore to previous version |

### AI Utilities *(free — no credit cost)*
| Tool | Description |
|------|-------------|
| `ai-improve-prompt` | Enhance prompt via Gemini |
| `ai-describe-image` | Analyze image (URL or base64) |

### Creative Studio
| Tool | Description |
|------|-------------|
| `creative-full` | **Full pipeline**: plan → background → render PNG → save. Prefer this over chaining. |
| `creative-generate` | Generate layout plan only |
| `creative-render` | Render plan + background → PNG |
| `creative-projects-list` | List creative projects |
| `creative-projects-get` | Get project with all layers |
| `creative-projects-create` | Save creative project manually |
| `creative-projects-update` | Partial update |
| `creative-projects-delete` | Delete project |

### Moodboard
| Tool | Description |
|------|-------------|
| `moodboard-detect-grid` | Detect cell bounding boxes in a moodboard image |
| `moodboard-upscale` | Upscale image to 1K / 2K / 4K |
| `moodboard-suggest` | Analyze cells → Remotion/Veo animation suggestions |

### Canvas
| Tool | Description |
|------|-------------|
| `canvas-list` | List canvas projects |
| `canvas-list-projects` | List with node type breakdown |
| `canvas-get` | Get canvas with nodes and edges |
| `canvas-create` | Create empty canvas |
| `canvas-update` | Update name, nodes, edges, linkedGuidelineId |
| `canvas-delete` | Delete canvas |
| `canvas-share` | Share with users (canEdit / canView) |
| `canvas-resolve-variables` | Preview `{{placeholder}}` resolution |
| `canvas-parse-csv` | Parse CSV → rows preview |

### Budget
| Tool | Description |
|------|-------------|
| `budget-create` | Create budget document |
| `budget-list` | List budget documents |
| `budget-get` | Get budget with line items |
| `budget-update` | Partial update |
| `budget-duplicate` | Clone budget |
| `budget-delete` | Delete budget |

### Community *(no auth needed)*
| Tool | Description |
|------|-------------|
| `community-presets` | Browse public presets |
| `community-profiles` | Browse creator profiles |

---

## Recommended agent flow

```
1. account-usage                              → confirm credits available
2. brand-guidelines-list                      → get brand vault IDs
3. brand-guidelines-get (id, format=prompt)   → load LLM-ready brand context
4. creative-full (prompt, brandGuidelineId)   → generate creative with brand injected
```

**No brand yet?**
```
1. branding-generate (prompt, step=full)      → full brand intelligence
2. brand-guidelines-create                    → create vault from results
3. brand-guidelines-upload-logo               → attach logo
4. brand-guidelines-compliance-check          → validate
```

Passing `brandGuidelineId` to generation tools automatically injects logo, colors, typography, and voice — no manual prompt engineering needed.

---

## Troubleshooting

**401 Unauthorized** — Token missing or invalid. Check Settings → API Keys.

**`mcp-remote` hangs on Windows** — `Authorization:Bearer` must have no space after the colon.

**OAuth browser doesn't open** — Use `mcp-remote@0.1.16` or later.

**`can_generate: false`** — Insufficient credits. Check `account-usage` for reset date.
