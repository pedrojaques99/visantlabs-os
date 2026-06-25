# Plugin Ops Channel — external agent → open Figma plugin (HTTP, scalable)

Lets an external agent (Claude/MCP/server) push operation batches to the **live** Visant Copilot
plugin running in a Figma file, over plain HTTPS — no WebSocket, no sticky sessions.

## Why not the WS bridge

`pluginBridge` (server→plugin WebSocket) is **orphaned in prod**: the shipping plugin migrated to
HTTP (`client.ts`: _"Substitui useApi + useWebSocket"_), has no WS client, and `manifest.json` only
allows `ws://localhost` (no `wss://api.visantlabs.com`). So server-initiated WS push can't reach it.
This channel replaces it with a stateless, Redis-backed HTTP design that scales horizontally
(any server instance serves from the shared queue) and works through the Figma iframe (which already
does HTTP streaming).

## Flow

```
agent ─POST /api/plugin/agent-command {fileId, operations}─▶ server
        ├─ if WS session exists (dev): pluginBridge.push  (back-compat)
        └─ else: pluginQueue.enqueue(fileId, batch)  → { queued, batchId }

plugin ─GET /api/plugin/pending?fileId  (long-poll ~25s, peek loop)─▶ { batches }
plugin ─(postMessage AGENT_OPS → code.ts applyOperations → OPERATION_ACK)
plugin ─POST /api/plugin/ack {fileId, appliedIds, failed?}─▶ removes applied; failures stay → retried next poll
```

- **Queue:** `pluginQueue` (Redis list per fileId, already exists). SSoT.
- **Delivery:** `/pending` long-polls by peeking the queue every ~1s up to ~25s (no blocking Redis cmd —
  ioredis here is a shared "safe-proxy" client; BRPOP would stall it). Returns as soon as batches exist.
- **Reliability:** at-least-once. `/pending` does NOT clear; `/ack` removes applied batch ids
  (`pluginQueue.removeByIds`). Un-acked batches reappear on the next poll → automatic retry. Plugin must
  dedupe by batchId (idempotent apply) to be safe against double-delivery.
- **Auth:** `authenticate` (Bearer JWT or `visant_sk_` API key). Plugin already holds `authToken` and
  `figma.fileKey`.

## Server changes (`server/routes/plugin.ts`, `server/lib/pluginQueue.ts`)

- `pluginQueue.removeByIds(fileId, ids)` — read-filter-rewrite (preserves LPUSH/peek ordering).
- `POST /agent-command` — enqueue when no WS session (was: hard-fail).
- `GET /pending` — long-poll peek loop.
- `POST /ack` — remove applied ids.

## Plugin client (implemented — needs `npm run build` + reinstall in Figma to go live)

- `code.ts`: emits `{type:'FILE_INFO', fileId: figma.fileKey}` on startup + answers `GET_FILE_INFO`.
- `usePluginOpsChannel` (`plugin/src/ui/hooks/`): when authenticated + fileId known, long-polls
  `GET /pending` → for each batch `postMessage({type:'AGENT_OPS', operations, opId:batchId})` →
  awaits the OPERATION_ACK/ERROR `code.ts` already emits → `POST /ack` with applied ids. Dedupes
  applied batchIds (idempotent), 30s per-batch timeout, 3s backoff on network error, aborts on unmount.
- Wired in `App.tsx` (mounted once).
- **Build note:** `npm --prefix plugin run build` is gated by a banned-icon lint that currently trips on
  pre-existing files; run `npm --prefix plugin run build -- --fix` (or clear the icons) to produce `dist/`,
  then reinstall the plugin in Figma. Server side must also be deployed.

## Notes / trade-offs

- Long-poll is fine here (Node long-running server: `CMD npx tsx server/index.ts`, not serverless).
  On serverless, switch to short interval polling.
- Latency ~1–3s (peek step). Good enough for design ops; lower it by reducing the step if needed.
- Keeps WS bridge intact for local dev; prod uses the queue path transparently.
