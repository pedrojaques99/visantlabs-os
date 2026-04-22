# Visant Labs — MCP Server

Exposes Visant's Creative Studio + Brand Intelligence as MCP tools for any agent (Claude Desktop, Cursor, custom clients).

## Design principle

**Zero logic duplication.** Every tool is a thin HTTP wrapper around the existing Express routes. The running Visant server (`npm run dev:server`) is the single source of truth for prompts, Gemini calls, brand insights, and the event store.

```
Agent (Claude Desktop)
   ↓ stdio
mcp-server/index.ts  (this file)
   ↓ HTTP (VISANT_API_URL)
server/routes/creative.ts  +  server/routes/brand-guidelines.ts
   ↓
Gemini · JSONL event store · Prisma
```

## Tools

| Tool | Backs onto | Purpose |
|---|---|---|
| `create_creative_plan` | `POST /api/creative/plan` | Generate layered creative (auto brand-biased if `brandId`) |
| `get_brand_insights` | `GET /api/creative/brand/:id/insights` | Learned brand preferences (#5) |
| `list_creative_events` | `GET /api/creative/events` | Raw edit timeline (#6) |
| `get_creative_metrics` | `GET /api/creative/events/metrics` | First-try acceptance, avg edits |
| `list_brand_guidelines` | `GET /api/brand-guidelines` | Discovery |
| `get_brand_guideline` | `GET /api/brand-guidelines/:id` | Full brand context |

## Run

```bash
# 1. Start Visant server
npm run dev:server

# 2. Run MCP server (stdio)
npm run mcp:visant
```

## Environment

| Var | Default | Purpose |
|---|---|---|
| `VISANT_API_URL` | `http://localhost:3000/api` | Visant API base |
| `VISANT_API_TOKEN` | — | Optional `Authorization: Bearer` token |

## Claude Desktop integration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "visant-labs": {
      "command": "npx",
      "args": ["tsx", "Z:/Cursor/visantlabs-os/mcp-server/index.ts"],
      "env": {
        "VISANT_API_URL": "http://localhost:3000/api"
      }
    }
  }
}
```

Restart Claude Desktop → tools appear under the 🔌 icon.

## Roadmap (see `.agent/plans/disruptive-next-level.md`)

Tools waiting on upstream work:
- `create_creative` — full generate+image (needs server-side creative persistence)
- `update_layer` / `add_layer` / `remove_layer` — needs #3 canvas sync (WebSocket)
- `export_creative` — needs export endpoint decoupled from client DOM
