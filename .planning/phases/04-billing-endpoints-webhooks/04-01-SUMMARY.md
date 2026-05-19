---
phase: 04-billing-endpoints-webhooks
plan: "01"
subsystem: billing-api
tags: [billing, webhooks, api, prisma]
dependency_graph:
  requires: []
  provides: [billing-balance-endpoint, webhook-crud-endpoints, webhook-prisma-model]
  affects: [server/app.ts, prisma/schema.prisma]
tech_stack:
  added: []
  patterns: [express-router, prisma-crud, crypto-hmac-secret]
key_files:
  created:
    - server/routes/billing.ts
    - server/routes/webhooks.ts
  modified:
    - prisma/schema.prisma
    - server/app.ts
decisions:
  - "Webhook secret only returned on POST creation, never on GET list (security)"
  - "Max 5 webhooks per user enforced before insert"
  - "DELETE uses deleteMany with userId+id for ownership check without 404 leak"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-05-19"
  tasks_completed: 2
  files_changed: 4
---

# Phase 4 Plan 01: Billing Endpoints and Webhook Registration Summary

**One-liner:** JWT-authenticated billing balance endpoint + webhook CRUD with HMAC-SHA256 signing secrets and Prisma Webhook model for MongoDB.

## What Was Built

### Task 1: Prisma Webhook Model
Added `Webhook` model to `prisma/schema.prisma` with fields: `userId`, `url` (HTTPS endpoint), `events` (string array), `secret` (HMAC signing), `active`, timestamps. Indexed on `[userId]` and `[userId, active]`.

Note: `npx prisma generate` could not complete due to dev server holding DLL lock on Windows (EPERM rename error on `query_engine-windows.dll.node`). This must be run manually after stopping the dev server. The schema itself is valid.

### Task 2: Billing Balance + Webhook CRUD Routes
- **`server/routes/billing.ts`**: `GET /balance` — queries User model for credit fields, returns `creditsRemaining = max(0, monthlyCredits - creditsUsed)`, 404 if user not found.
- **`server/routes/webhooks.ts`**: Full CRUD — POST validates HTTPS URL and allowed event types, generates `crypto.randomBytes(32).toString('hex')` signing secret (shown once on creation). GET lists without secret. DELETE uses `deleteMany` with `userId` ownership enforcement. Max 5 webhooks per user.
- **`server/app.ts`**: Both routes registered as `/billing` and `/webhooks` in the mounts array.

## Deviations from Plan

### Auto-fixed Issues

None.

### Known Blockers

**prisma generate blocked by dev server DLL lock (Windows)**
- The `npx prisma generate` command fails with `EPERM: operation not permitted, rename ...query_engine-windows.dll.node.tmp -> ...query_engine-windows.dll.node`
- This is a known Windows issue documented in CLAUDE.md: "stop dev server first on Windows"
- The schema is valid; the TypeScript types for `prisma.webhook` will resolve once generate runs
- Action required: stop dev server, run `npx prisma generate`, restart dev server

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 7b71940 | feat(04-01): add Webhook model to Prisma schema |
| 2 | 91cc572 | feat(04-01): create billing balance + webhook CRUD routes, register in app.ts |

## Self-Check: PASSED

- server/routes/billing.ts: created
- server/routes/webhooks.ts: created
- server/app.ts: modified (billing + webhooks registered)
- prisma/schema.prisma: modified (Webhook model added)
- Commits 7b71940 and 91cc572 exist in git log
