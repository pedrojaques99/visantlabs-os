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
