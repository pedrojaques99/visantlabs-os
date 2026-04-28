---
phase: brand-creative-generation
plan: "02"
subsystem: server/routes/creative
tags: [creative, brand, ai, gemini, r2, endpoint]
dependency_graph:
  requires: [brand-creative-generation-01]
  provides: [generate-from-brand-endpoint]
  affects: [server/routes/creative.ts]
tech_stack:
  added: [express-rate-limit (reused)]
  patterns: [brand ownership guard via prisma.findFirst({ where: { id, userId } }), rate-limited authenticated route]
key_files:
  modified:
    - server/routes/creative.ts
decisions:
  - Reused module-level Gemini model instance to avoid double-init
  - Graceful fallback to imageBase64 when R2 not configured
  - Rate limiter inline (10 req/min) matching brand-guidelines.ts pattern
metrics:
  duration: "~10 min"
  completed: "2026-04-27"
  tasks: 1
  files: 1
---

# Phase brand-creative-generation Plan 02: Brand-Driven Creative Generation Endpoint Summary

**One-liner:** Added POST /api/creative/generate-from-brand that loads brand guideline, calls Gemini with brand context, renders PNG via server-side canvas, uploads to R2, and returns imageUrl + plan + brandUsed summary.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add generate-from-brand route to creative.ts | 2bca7eb | server/routes/creative.ts |

## What Was Built

- Added `import { prisma }` and `import { rateLimit }` to creative.ts
- Added `generateFromBrandLimiter` (10 req/min, standardHeaders)
- Route `POST /api/creative/generate-from-brand`:
  - Validates `brandId` presence and `GEMINI_API_KEY` env
  - Loads brand via `prisma.brandGuideline.findFirst({ where: { id: brandId, userId } })` — enforces ownership, returns 404 if not found
  - Extracts colors, typography, logos, gradients from brand JSON fields
  - Builds brand context string (primaryColor, bgColor, textColor, accentColor, primaryFont, logoUrls, gradientCss)
  - Calls Gemini with SYSTEM_PROMPT + brand-aware userMessage (supports intent, feedback+previousPlan for refinement)
  - Injects logo URLs into logo layers from AI plan
  - Renders PNG via `renderCreativePlan`
  - Uploads to R2 via `uploadCanvasImage` — falls back to `imageBase64` if R2 not configured
  - Returns `{ imageUrl, plan, brandUsed }` or `{ imageBase64, plan, brandUsed }`

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- server/routes/creative.ts modified — FOUND
- Commit 2bca7eb exists — FOUND
- grep "generate-from-brand" returns 3 hits — PASS
- grep "brandGuideline.findFirst" returns 1 hit — PASS
- grep "import.*prisma" returns 1 hit — PASS
- grep "authenticate" returns 2 hits (/render + /generate-from-brand) — PASS
- TypeScript compile — no new errors in creative.ts — PASS
