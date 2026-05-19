---
phase: 04-billing-endpoints-webhooks
plan: "02"
subsystem: webhooks
tags: [webhooks, events, hmac, generation, credits, brand]
dependency_graph:
  requires: ["04-01"]
  provides: ["webhook-dispatch", "event-emission"]
  affects: ["server/routes/mockups.ts", "server/routes/creative.ts", "server/routes/brand-guidelines.ts"]
tech_stack:
  added: []
  patterns: ["fire-and-forget async dispatch", "HMAC-SHA256 payload signing", "Promise.allSettled multi-delivery"]
key_files:
  created:
    - server/utils/webhookDispatch.ts
  modified:
    - prisma/schema.prisma
    - server/routes/mockups.ts
    - server/routes/creative.ts
    - server/routes/brand-guidelines.ts
decisions:
  - "Added Webhook model to schema (Plan 01 ran in separate worktree, model was missing)"
  - "credits.depleted fires based on totalCreditsEarned + monthlyCreditsRemaining <= 0 to account for earned credits"
  - "Both imageUrl and base64 fallback paths in creative.ts emit generation.complete"
metrics:
  duration: "~15 min"
  completed: "2026-05-19"
  tasks_completed: 2
  files_modified: 4
---

# Phase 04 Plan 02: Webhook Dispatch Utility Summary

Webhook dispatch utility created and wired into generation, credit, and brand update flows. All webhook events fire with HMAC-SHA256 signed payloads using fire-and-forget semantics.

## What Was Built

### server/utils/webhookDispatch.ts

`dispatchWebhookEvent(userId, event, data)` — queries active webhooks for the user+event, signs the JSON payload with `crypto.createHmac('sha256', secret)`, and POSTs to each endpoint with a 5-second AbortController timeout. Uses `Promise.allSettled` so one failing endpoint doesn't block others. All errors are caught and logged; the function never throws.

### Event Wiring

| Event | File | Trigger Point |
|---|---|---|
| `generation.complete` | mockups.ts | After `res.json(responseData)` |
| `generation.complete` | creative.ts | After brand-driven render (both imageUrl and base64 paths) |
| `credits.depleted` | mockups.ts | After atomic credit deduction when total remaining <= 0 |
| `brand.updated` | brand-guidelines.ts | After successful `prisma.brandGuideline.update` with changedFields |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Webhook model missing from worktree schema**
- **Found during:** Task 1 — `prisma.webhook` unavailable in Prisma client
- **Issue:** Plan 01 ran in a different parallel worktree; the Webhook model was never added to this worktree's `prisma/schema.prisma`
- **Fix:** Added Webhook model to schema with all required fields, ran `npx prisma generate`
- **Files modified:** `prisma/schema.prisma`
- **Commit:** 6df8d74

## Self-Check: PASSED

- `server/utils/webhookDispatch.ts` — FOUND
- `grep "dispatchWebhookEvent" server/routes/` — 3 files confirmed
- `grep "X-Webhook-Signature" server/utils/webhookDispatch.ts` — FOUND
- Commits 6df8d74 and 98f4128 — FOUND
