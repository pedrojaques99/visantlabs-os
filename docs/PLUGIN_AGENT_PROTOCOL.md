# Plugin Agent Protocol — driving Visant Copilot from an agent

How an external agent (Claude, MCP, server) drives the **live** Visant Copilot Figma plugin by
pushing declarative operations to an open file. Operational how-to lives in the skill
`visant-figma-plugin` (`cli/skills/visant-figma-plugin/SKILL.md`); this is the architecture map.

## Channel
```
agent ──HTTP POST /api/plugin/agent-command {fileId, operations}──▶ server
server ──pluginBridge.push(fileId, ops)──▶ WS {type:AGENT_OPS, operations, opId} ──▶ plugin
plugin ──applyOperations(ops)──▶ canvas ; ──▶ {OPERATION_ACK, opId, appliedCount}
```
- Plugin connects: `wss://api.visantlabs.com/api/plugin/ws?token=<jwt>&fileId=<key>` →
  `pluginBridge.register(fileId, ws, userId)` (`server/routes/plugin.ts:145`).
- Push endpoint: `POST /api/plugin/agent-command` — auth + rate-limit + `operationValidator.validateBatch`
  → `pluginBridge.push` (`server/routes/plugin.ts:299`).
- Bridge: session map keyed by `fileId`, ACK tracking, 10s op timeout, heartbeat; offline ops drain
  from Redis (`pluginQueue`) on reconnect (`server/lib/pluginBridge.ts`).
- Plugin entry: `figma.ui.onmessage` → `AGENT_OPS` → `applyOperations` (`plugin/src/code.ts`,
  `plugin/src/handlers/operations.ts`).

## Contracts (source of truth)
- **Operation vocabulary:** `src/lib/figma-types.ts` → `FigmaOperation` union (~60 ops).
- **RPC envelope + OpName map:** `shared/protocol.ts` (`Envelope`, `OpMap`, e.g. `canvas.applyOperations`,
  `brand.applyLocal`, `components.getInFile`). Dispatch: `plugin/src/handlers/registry.ts`.
- **Figma MCP wrapper:** `server/mcp/figma-mcp.ts` exposes per-op tools (`create_frame`, `create_text`,
  `get_design_context`, `get_screenshot`, `search_design_system`, …), each calling `pluginBridge.push`.

## Auth
`authenticate` accepts a Bearer JWT or an API key (create via Visant MCP `api-key-create`).
Sessions debug: `GET /api/plugin/debug/sessions`.

## Why this path (vs raw use_figma MCP)
The plugin has **network access** (manifest `networkAccess`: r2.dev, assets.visantlabs) so it can fetch
real brand assets (logo), and its op set is **component/variable-first** (CREATE_COMPONENT +
CREATE_COMPONENT_INSTANCE, CREATE_VARIABLE/APPLY_VARIABLE, brand.applyLocal). Result is linked, on-brand
(SSoT) — instances + bound variables, not the divergent cloned copies that raw `use_figma` produces
(it has no fetch and emits raw JS). Use plugin for production; use_figma for prototyping when no session.

## Prereq the agent can't satisfy alone
The plugin must be **open in the file** (a human action). If no session for `fileId`, ops queue and
apply on reconnect — surface this to the user instead of assuming immediate apply.
