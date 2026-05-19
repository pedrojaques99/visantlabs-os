---
phase: 03-typescript-python-sdks
plan: "02"
subsystem: api
tags: [python, sdk, openapi, codegen, openapi-python-client]

requires:
  - phase: 03-typescript-python-sdks
    plan: "01"
    provides: TypeScript SDK + openapi.json snapshot

provides:
  - "visant-sdk pip package scaffold in sdks/python/"
  - "Auto-generated Python client with 13 API modules and 308 typed models"
  - "scripts/generate-sdks.sh updated to regenerate both TS and Python SDKs"

affects: [developer-portal, sdk-publishing]

tech-stack:
  added: [openapi-python-client@0.28.4]
  patterns: ["openapi-python-client generate/update pattern", "AuthenticatedClient with Bearer token"]

key-files:
  created:
    - sdks/python/config.yml
    - sdks/python/pyproject.toml
    - sdks/python/README.md
    - sdks/python/visant_sdk/client.py
    - sdks/python/visant_sdk/api/ (13 modules)
    - sdks/python/visant_sdk/models/ (308 typed models)
  modified:
    - scripts/generate-sdks.sh

key-decisions:
  - "Used openapi-python-client@0.28.4 (attrs-based, async-ready) — generated AuthenticatedClient + typed models"
  - "Overwrite flag required for re-generation into existing directory — used --overwrite in generate-sdks.sh"
  - "4 array-type response endpoints omitted by generator (no items schema) — warnings noted, not blocking"

metrics:
  duration: 20min
  completed: 2026-05-19
  tasks: 2
  files_modified: 397
---

# Phase 03 Plan 02: Python SDK Summary

**Auto-generated visant-sdk Python package from OpenAPI spec via openapi-python-client, yielding 13 typed API modules and 308 typed models with a unified single-command regeneration pipeline for both TS and Python SDKs**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-19T23:30:00Z
- **Completed:** 2026-05-19T23:50:00Z
- **Tasks:** 2
- **Files modified:** 397 (generated SDK + script update + README)

## Accomplishments

- Generated `sdks/python/` with publishable `visant-sdk` package (Poetry-based, Python 3.10+)
- 13 typed API modules: brand, brand_guidelines, ai, ai_generation, mockups, canvas, campaigns, creative, auth, tools, branding, plugin, default
- 308 typed model classes with attrs + python-dateutil
- Updated `scripts/generate-sdks.sh` to regenerate both TypeScript and Python SDKs in a single run
- Created `sdks/python/README.md` with authenticated hello-world using real generated imports and `visant_sk_*` key format
- Python import verified: `from visant_sdk import AuthenticatedClient, Client` works

## Task Commits

1. **Task 1 + 2: Generate Python SDK and create README** - `ac9d5df` (feat)

## Files Created/Modified

- `sdks/python/config.yml` - openapi-python-client config (package name overrides)
- `sdks/python/pyproject.toml` - Generated Poetry package: visant-sdk 0.1.0, Python ^3.10, httpx + attrs + python-dateutil
- `sdks/python/README.md` - Install, authenticated hello-world, API modules table, regeneration docs
- `sdks/python/visant_sdk/client.py` - AuthenticatedClient + Client classes (httpx-based)
- `sdks/python/visant_sdk/api/` - 13 modules with sync/asyncio endpoint functions
- `sdks/python/visant_sdk/models/` - 308 typed response/request models
- `scripts/generate-sdks.sh` - Added Python SDK generation section after TS section

## Decisions Made

- `openapi-python-client@0.28.4` generates attrs-based dataclasses with full async support (`asyncio` variants). Matches plan's requirement for typed Python client.
- The generator requires `--overwrite` when output directory already exists. Added to generate-sdks.sh so re-runs are non-interactive.
- 4 endpoints have array responses without `items` schema in the OpenAPI spec — generator omits their response types with a warning. These are pre-existing spec issues, not introduced by this plan.

## Deviations from Plan

**1. [Rule 1 - Bug] --overwrite flag needed for re-generation**
- **Found during:** Task 1 (first generation attempt)
- **Issue:** Generator exited with "Directory already exists" when sdks/python/ already had config.yml
- **Fix:** Added `--overwrite` flag to generate-sdks.sh Python section
- **Files modified:** scripts/generate-sdks.sh
- **Committed in:** ac9d5df

**2. [Rule 2 - Missing info] README rewritten over generated stub**
- **Found during:** Task 2
- **Issue:** Generator creates a generic README with placeholder API examples
- **Fix:** Overwrote with Visant-specific README using actual imports, `visant_sk_*` auth format, and module table
- **Files modified:** sdks/python/README.md
- **Committed in:** ac9d5df

## Known Stubs

None — all generated code is functional. The 4 array-type endpoints with omitted response types are a pre-existing OpenAPI spec issue (no `items` defined), not introduced by this plan.

## Self-Check: PASSED

- `sdks/python/visant_sdk/` exists: FOUND
- `sdks/python/visant_sdk/client.py` has class: FOUND
- `scripts/generate-sdks.sh` contains openapi-python-client: FOUND
- `sdks/python/README.md` contains visant_sk_: FOUND
- Commit ac9d5df: FOUND
