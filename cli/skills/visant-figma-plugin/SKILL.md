---
name: visant-figma-plugin
description: >-
  Drive the live Visant Copilot Figma plugin directly — push declarative FigmaOperation
  batches to an open Figma file (components, instances, variables, clone+override, brand
  apply) via POST /api/plugin/agent-command or the Figma MCP tools. Use when the user wants
  to build/edit IN Figma through the plugin (not raw use_figma), produce on-brand pieces with
  real components + bound variables (SSoT), or bulk-generate from a master. Triggers: "usar o
  plugin", "pelo plugin", "Visant Copilot", "agent-command", "aplicar ops no Figma",
  /visant-figma-plugin.
---

# Drive the Visant Copilot plugin directly

Push **declarative operations** to a Figma file where the **Visant Copilot plugin is open**.
The plugin applies them via `applyOperations` (robust normalization of fills/fonts/variables).
This is the production path for on-brand, **SSoT** output: real components + instances + bound
brand variables — not cloned copies. Contrast with raw `use_figma` (MCP): no network/fetch, raw
JS, good only for prototyping when no plugin session exists.

## Prerequisites (check first)

1. **Plugin open & connected** in the target file. Session is keyed by `fileId` (the Figma file
   key from `figma.com/design/<fileId>/...`). If offline, ops **queue in Redis** and drain on
   reconnect — so a push can "succeed-later". Verify live sessions: `GET /api/plugin/debug/sessions` (auth).
2. **Auth**: Bearer token or an API key — create one with the Visant MCP tool `api-key-create`
   (list with `api-key-list`). Base URL `https://api.visantlabs.com`.
3. **Brand context** comes from the guideline (SSoT) — see [[visant-creative]] / [[visant-mcp-connect]].

## Channel A — HTTP (any agent)

```
POST https://api.visantlabs.com/api/plugin/agent-command
Authorization: Bearer <token-or-api-key>
{ "fileId": "<figma file key>", "operations": [ <FigmaOperation>, ... ] }
→ { success, appliedCount }   // 400 if validation fails, 500 if plugin didn't ACK
```

Ops are validated (`operationValidator.validateBatch`) then `pluginBridge.push(fileId, ops)` →
WS `AGENT_OPS` → plugin applies → `OPERATION_ACK`. Keep batches small; one batch = one undo step.

## Channel B — Figma MCP tools (if the figma-mcp server is connected)

`server/mcp/figma-mcp.ts` wraps push as tools, each taking `fileId`: `get_selection`,
`create_frame`, `create_rectangle`, `create_text`, `set_fill`, `rename_node`, `delete_node`,
`get_design_context` (depth), `get_screenshot`, `search_design_system`, `get_code_connect_map`,
`add_code_connect_map`. Prefer this when available; fall back to Channel A for arbitrary op batches.

## Operation vocabulary (`shared` FigmaOperation — ~60 ops)

Each op has a discriminant `type`. Use `ref` (string) to name a node you create so later ops in the
**same batch** can target it; mutate existing nodes by `nodeId`.

- **Create:** CREATE_PAGE · CREATE_FRAME · CREATE_RECTANGLE · CREATE_ELLIPSE · CREATE_TEXT ·
  CREATE_LINE/POLYGON/STAR · CREATE_SVG · CREATE_ICON · CREATE_SECTION.
- **Components (SSoT):** **CREATE_COMPONENT** · **CREATE_COMPONENT_INSTANCE** · COMBINE_AS_VARIANTS ·
  **SWAP_INSTANCE** · DETACH_INSTANCE · GET_AGENT_COMPONENTS · SCAFFOLD_AGENT_LIBRARY.
- **Clone/bulk:** **CLONE_NODE** (`sourceName`/`sourceScope` + `textOverrides:[{name,content}]` +
  `imageOverrides:[{layerName,sourceNodeName}]`) · DUPLICATE_NODE · FILL_TEMPLATE (slot fill from data).
- **Variables (color SSoT):** **CREATE_VARIABLE** · CREATE_COLOR_VARIABLES_FROM_SELECTION ·
  **BIND_NEAREST_COLOR_VARIABLES** · **APPLY_VARIABLE** · APPLY_STYLE.
- **Mutate:** SET_FILL · SET_STROKE · SET_IMAGE_FILL · RECOLOR_NODE · SET_CORNER_RADIUS ·
  SET_INDIVIDUAL_CORNERS · SET_EFFECTS · SET_OPACITY · SET_BLEND_MODE · SET_AUTO_LAYOUT ·
  SET_CONSTRAINTS · SET_LAYOUT_GRID · RESIZE · MOVE · RENAME · REORDER_CHILD · GROUP_NODES · UNGROUP.
- **Text:** SET_TEXT_CONTENT · SET_TEXT_STYLE · SET_TEXT_RANGES.
- **Read-back:** GET_DESIGN_CONTEXT (`nodeId`,`depth`) · GET_SCREENSHOT · GET_VARIABLE_DEFS ·
  SEARCH_DESIGN_SYSTEM (`query`) · EXPORT_FRAMES_DATA · GET_CODE_CONNECT_MAP.
- **Misc:** DELETE_NODE · SELECT_AND_ZOOM · SET_EXPORT_SETTINGS · BOOLEAN_OPERATION · UNDO_LAST_BATCH.

## Higher-level RPC (envelope, `shared/protocol.ts` OpName)

UI↔plugin uses `Envelope {v:1,id,op,payload}`. Notable ops that wrap the above:
`canvas.applyOperations` (the FigmaOperation[] batch) · **`brand.applyLocal`** (apply guideline
colors/fonts as local variables/styles) · `brand.importLogos` · `components.getInFile` /
`components.getAgent` · `templates.scaffold` · `variables.getColors/getFonts` · `text.swapFonts` ·
`export.framesData`. The HTTP agent-command path maps to `canvas.applyOperations`.

## The SSoT recipe (lesson — never clone-copy a logo again)

1. **Reuse before create:** `GET_AGENT_COMPONENTS` / `SEARCH_DESIGN_SYSTEM` to find an existing
   logo/component; if present, instance it.
2. **Componentize once:** if none, `CREATE_COMPONENT` from the asset, then place
   `CREATE_COMPONENT_INSTANCE` everywhere (resize/scale per use) — one edit propagates.
3. **Brand color as variables:** `brand.applyLocal` (or CREATE_COLOR_VARIABLES_FROM_SELECTION) +
   `APPLY_VARIABLE`/`BIND_NEAREST_COLOR_VARIABLES` — never hardcode hex on copies.
4. **Bulk:** design one master, then `CLONE_NODE` + `textOverrides`/`imageOverrides` per data row.
5. **Validate:** `GET_SCREENSHOT` the result, inspect, fix.
   Why the plugin beats raw use_figma here: it has **network access** (manifest allows r2.dev/
   assets.visantlabs → can fetch the real logo asset) and is **component/variable-first**, so output
   is linked + on-brand, not divergent copies. See `docs/PLUGIN_AGENT_PROTOCOL.md`.

## Gotchas

- Plugin offline → push returns queued/late; check `debug/sessions` and tell the user to open the plugin.
- Batches are atomic-ish per ACK and map to one undo (`UNDO_LAST_BATCH`). Keep them focused.
- `ref` only resolves within the same batch; across batches, capture returned node IDs / re-query.
- Don't recreate brand tokens that exist — discover via `variables.getColors` / `GET_AGENT_COMPONENTS` first.
