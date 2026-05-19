---
phase: 01-openapi-docs
plan: 01
subsystem: api-docs
tags: [openapi, mcp, spec, documentation]
dependency_graph:
  requires: []
  provides: [openapi-spec-endpoint]
  affects: [server/app.ts]
tech_stack:
  added: []
  patterns: [single-source-of-truth from TOOLS array, merge-legacy-spec pattern]
key_files:
  created:
    - server/lib/mcp-to-openapi.ts
    - server/routes/openapi.ts
  modified:
    - server/app.ts
decisions:
  - Merge MCP tool paths with legacy REST spec so one endpoint covers both
  - Use tool name prefix matching for tag derivation (no manual mapping table needed)
  - Public endpoint with 5-min cache — no auth, safe for SDK tooling
metrics:
  duration: ~8min
  completed: "2026-05-19"
  tasks_completed: 2
  files_changed: 3
---

# Phase 01 Plan 01: MCP-to-OpenAPI Converter Summary

OpenAPI 3.1 spec auto-generated from 37-tool TOOLS array in `mcp-server/shared.ts`, served at `GET /api/openapi.json` with merged legacy REST routes (59 total paths).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create MCP-to-OpenAPI converter | 290f5a5 | server/lib/mcp-to-openapi.ts |
| 2 | Wire /api/openapi.json endpoint | 52ce021 | server/routes/openapi.ts, server/app.ts |

## What Was Built

**`server/lib/mcp-to-openapi.ts`** — `generateMCPOpenAPISpec(version, serverUrl)`:
- Imports TOOLS from `mcp-server/shared.ts` (single source of truth)
- Each tool becomes `POST /api/mcp/tools/{toolName}` with requestBody from tool's `inputSchema`
- Tags derived from name prefix: Brand, AI Generation, Mockups, Canvas, Campaigns, Creative, Tools
- Merges with legacy REST spec from `generateOpenAPISpec()` in `openapi-gen.ts`
- Returns OpenAPI 3.1.0 document with bearerAuth (JWT) + apiKeyAuth (visant_sk_*) security schemes

**`server/routes/openapi.ts`** — Public `GET /openapi.json`:
- Reads version from `package.json` at runtime
- Sets `Content-Type: application/json` and `Cache-Control: public, max-age=300`
- No authentication middleware — safe for external tooling and SDK generators

**`server/app.ts`** — Route registration after existing mounts array.

## Verification Result

```
Total paths: 59
Has MCP tools: true
OpenAPI version: 3.1.0
Has create_creative_plan: true
Has document_extract: true
```

37 MCP tool paths + 22 legacy REST paths = 59 total. All acceptance criteria met.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- server/lib/mcp-to-openapi.ts: FOUND
- server/routes/openapi.ts: FOUND
- server/app.ts contains openapiRoutes: FOUND
- Commit 290f5a5: FOUND
- Commit 52ce021: FOUND
