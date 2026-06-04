# Using Visant via MCP

Connect any MCP-compatible AI client to Visant's full tool suite — brand guidelines, mockup generation, creatives, canvas, and budgets.

**Endpoint:** `https://api.visantlabs.com/api/mcp`  
**Transport:** Streamable HTTP (MCP spec 2025-11-25, stateless)  
**Auth:** OAuth 2.1 (DCR + PKCE S256) or API key (`visant_sk_*`)  
**Discovery:** `GET /.well-known/mcp.json`

> **Full tool reference + agent workflows:** `.agent/memory/MCP-GETTING-STARTED.md`

---

## Get your API key

1. Log in at [visantlabs.com](https://visantlabs.com)
2. Go to **Settings → API Keys**
3. Create a key — it starts with `visant_sk_`

---

## Claude Code CLI

Claude Code now supports remote HTTP MCP servers natively — no `mcp-remote` bridge needed.

```bash
claude mcp add --transport http visant https://api.visantlabs.com/api/mcp
```

OAuth browser flow opens on first use. Verify:

```bash
claude mcp list
```

**Legacy (mcp-remote bridge):** Still works if preferred — add to `.mcp.json`:

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

## Claude.ai / Claude Desktop (Connector)

1. Go to **Settings → Connectors → Add**
2. Enter URL: `https://api.visantlabs.com/api/mcp`
3. Authorize via OAuth (automatic browser flow — no API key needed)

Works across claude.ai, Claude Desktop, Cowork, and mobile apps.

---

## Anthropic API (MCP Connector)

Use Visant as a remote MCP server directly in API calls:

```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 4096,
  "mcp_servers": [{
    "type": "url",
    "url": "https://api.visantlabs.com/api/mcp",
    "name": "visant",
    "authorization_token": "visant_sk_your_key_here"
  }],
  "tools": [{ "type": "mcp_toolset", "mcp_server_name": "visant" }],
  "messages": [{ "role": "user", "content": "Generate a mockup of a coffee brand packaging" }]
}
```

Requires header: `"anthropic-beta": "mcp-client-2025-11-20"`

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
