---
phase: 03-typescript-python-sdks
plan: "01"
subsystem: api
tags: [typescript, sdk, openapi, codegen, openapi-typescript-codegen]

requires:
  - phase: 01-openapi-spec-interactive-docs
    provides: generateMCPOpenAPISpec function and /api/openapi.json endpoint

provides:
  - "@visant/sdk npm package scaffold in sdks/typescript/"
  - "Auto-generated TypeScript client with 12 service classes (59 paths)"
  - "scripts/generate-sdks.sh single regeneration entrypoint"
  - "scripts/dump-openapi-spec.ts offline spec snapshot helper"

affects: [03-02-python-sdk, developer-portal, sdk-publishing]

tech-stack:
  added: [openapi-typescript-codegen@0.29.0]
  patterns: ["OpenAPI spec → SDK codegen pipeline", "offline spec dump via tsx for Windows dev"]

key-files:
  created:
    - sdks/typescript/package.json
    - sdks/typescript/tsconfig.json
    - sdks/typescript/src/index.ts
    - sdks/typescript/src/services/ (12 service classes)
    - sdks/typescript/src/core/ (6 runtime files)
    - sdks/typescript/openapi.json
    - sdks/typescript/README.md
    - scripts/generate-sdks.sh
    - scripts/dump-openapi-spec.ts
  modified: []

key-decisions:
  - "Used openapi-typescript-codegen@0.29.0 (stable, well-tested) over newer openapi-typescript (no client generation)"
  - "scripts/ directory is gitignored — used git add -f to force-track generate-sdks.sh and dump-openapi-spec.ts as project artifacts"
  - "Generated spec offline via npx tsx dump-openapi-spec.ts (server not running) — 59 paths captured"
  - "SDK uses static service class pattern (no VisantApi root class) — consumers import individual services + configure OpenAPI singleton"

patterns-established:
  - "SDK config pattern: set OpenAPI.TOKEN and OpenAPI.BASE once, all service classes pick it up automatically"
  - "Regeneration pattern: bash scripts/generate-sdks.sh (live server) OR npx tsx scripts/dump-openapi-spec.ts (offline)"

requirements-completed: [SDK-01, SDK-03]

duration: 50min
completed: 2026-05-19
---

# Phase 03 Plan 01: TypeScript SDK Summary

**Auto-generated @visant/sdk TypeScript client from OpenAPI spec via openapi-typescript-codegen, yielding 12 typed service classes across 59 API paths with a single-command regeneration pipeline**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-05-19T21:47:14Z
- **Completed:** 2026-05-19T23:27:34Z
- **Tasks:** 2
- **Files modified:** 27 (24 generated, 3 scaffold)

## Accomplishments

- Created `sdks/typescript/` with publishable `@visant/sdk` npm package structure
- Generated typed client: 12 service classes (Brand, BrandGuidelines, Branding, AiGeneration, Mockups, Canvas, Campaigns, Creative, Auth, Tools + Ai + Plugin), `tsc --noEmit` passes clean
- Created `scripts/generate-sdks.sh` as the single SDK regeneration entrypoint (satisfies SDK-03)
- Created `scripts/dump-openapi-spec.ts` for offline spec capture on Windows dev machines

## Task Commits

1. **Task 1: Bootstrap TS SDK package and generation script** - `0d1e22a` (feat)
2. **Task 2: Create TS SDK README with authenticated hello-world** - `6bbb86c` (feat)

## Files Created/Modified

- `sdks/typescript/package.json` - @visant/sdk package scaffold, name/version/scripts/devDeps
- `sdks/typescript/tsconfig.json` - ES2020 target, bundler moduleResolution, declaration output
- `sdks/typescript/openapi.json` - Captured spec snapshot (59 paths, 93+ MCP tools)
- `sdks/typescript/src/index.ts` - Generated entrypoint exporting all services and core types
- `sdks/typescript/src/services/*.ts` - 12 generated service classes with typed methods
- `sdks/typescript/src/core/*.ts` - Runtime: ApiError, CancelablePromise, OpenAPI config, fetch request
- `sdks/typescript/README.md` - Install, quick start, services table, auth, regeneration docs
- `scripts/generate-sdks.sh` - Shell script: curl spec + run openapi-typescript-codegen
- `scripts/dump-openapi-spec.ts` - tsx script to snapshot spec without running dev server

## Decisions Made

- Used `openapi-typescript-codegen@0.29.0` (static service classes) over `openapi-typescript` (type-only, no client). The codegen approach matches the plan's requirement for a usable typed client, not just types.
- The generated code uses static classes + `OpenAPI` singleton config — no `new VisantApi()` constructor. README updated to reflect actual generated API.
- `scripts/` is gitignored in this repo. Force-tracked `generate-sdks.sh` and `dump-openapi-spec.ts` with `git add -f` since they are project infrastructure, not personal scripts.
- Spec snapshot captured offline via `npx tsx scripts/dump-openapi-spec.ts` — yielded 59 paths (legacy REST + MCP tools merged).

## Deviations from Plan

**1. [Rule 1 - Bug] scripts/ directory is gitignored**
- **Found during:** Task 1 commit
- **Issue:** `.gitignore` has `/scripts` — git refused to stage generate-sdks.sh
- **Fix:** Used `git add -f` to force-track the two infrastructure scripts
- **Files modified:** git index only
- **Committed in:** 0d1e22a

**2. [Rule 1 - Bug] Windows ESM path scheme prevents `import()` with drive letter**
- **Found during:** Task 1 (spec generation step)
- **Issue:** `scripts/dump-openapi-spec.mjs` with dynamic `import(join(root, ...))` fails on Windows — `Z:` is not a valid ESM scheme
- **Fix:** Switched to static `import` in a `.ts` file, ran via `npx tsx` which handles Windows paths correctly
- **Files modified:** scripts/dump-openapi-spec.ts (replaced .mjs)
- **Committed in:** 0d1e22a

---

**Total deviations:** 2 auto-fixed (both Rule 1 environment bugs)
**Impact on plan:** No scope change. Both fixes were Windows-specific environment issues, not design changes.

## Issues Encountered

- The dev server was not running. Used `npx tsx scripts/dump-openapi-spec.ts` to call `generateMCPOpenAPISpec()` directly — yielded identical output to what the server would serve.

## User Setup Required

None — no external service configuration required. The SDK is a local package; publishing to npm is a future step.

## Next Phase Readiness

- TypeScript SDK in `sdks/typescript/` is ready for consumption and publishing
- Plan 02 can add the Python SDK generation to `scripts/generate-sdks.sh` (placeholder comment already in place)
- The `openapi.json` snapshot in `sdks/typescript/openapi.json` can be refreshed any time via `npx tsx scripts/dump-openapi-spec.ts`

---
*Phase: 03-typescript-python-sdks*
*Completed: 2026-05-19*
