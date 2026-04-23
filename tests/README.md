# Test Architecture

Professional, tiered test suite for Visant Labs OSS.

## Philosophy

**Smart coverage on money + trust boundaries. Fast feedback everywhere else.**

- **Unit** (`tests/unit/` + colocated `server/**/*.test.ts`): pure functions, mocked deps, <100ms each.
- **Integration** (`tests/integration/`): real Express app via Supertest + in-memory MongoDB replica set via `mongodb-memory-server`. External HTTP mocked via MSW.
- **E2E** (`tests/e2e/`): reserved for plugin↔server smoke tests (not yet populated).

## Layout

```
tests/
├── helpers/
│   ├── env.ts            Deterministic process.env for tests
│   ├── app.ts            getApp() / request() for supertest
│   ├── db.ts             startTestMongo / resetDb
│   └── auth.ts           signTestToken / bearer
├── factories/            Prisma-backed seed helpers (user, …)
├── mocks/                MSW handlers (ai.ts) + Stripe signer
├── fixtures/             Canned payloads (legacy — migrate to factories)
├── setup.ts              Applied to every test: env + MSW lifecycle
├── setup.integration.ts  Applied to integration project only: Mongo RS lifecycle
├── unit/                 Mirrors server/src tree
└── integration/
    └── routes/           One file per route surface
```

Colocated tests under `server/**/*.test.ts` are included in the unit project — no need to relocate them.

## Running

```bash
npm run test              # all projects, one pass
npm run test:unit         # fast loop (no Mongo)
npm run test:integration  # spins up in-memory Mongo RS
npm run test:watch        # interactive
npm run test:coverage     # v8 coverage + HTML report
```

## Coverage gates (enforced in `vitest.config.ts`)

| Surface                          | Threshold       |
|----------------------------------|-----------------|
| Global                           | 50%             |
| `server/routes/auth.ts`          | 70%             |
| `server/routes/admin.ts`         | 70%             |
| `server/routes/payments.ts`      | 70%             |
| `server/lib/ai-resilience.ts`    | 70%             |
| `server/middleware/auth.ts`      | 80%             |
| `server/middleware/adminAuth.ts` | 80%             |

Merges to `main` that regress a gated surface are blocked by CI.

## Writing a new test

### Integration (touches DB / HTTP)
```ts
import { describe, it, expect } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';

describe('GET /api/users/me', () => {
  it('returns authenticated user', async () => {
    const { user } = await createUser();
    const token = signTestToken({ userId: user.id, email: user.email });
    const res = await (await request()).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
```

### Unit (pure)
```ts
import { describe, it, expect } from 'vitest';
import { myFn } from '@server/lib/my-module.js';

describe('myFn', () => {
  it('does X', () => {
    expect(myFn(1)).toBe(2);
  });
});
```

### Overriding MSW for a single test
```ts
import { mswServer } from '../../mocks/server.js';
import { aiScenarios } from '../../mocks/ai.js';

it('falls back when Gemini 429s', async () => {
  mswServer.use(aiScenarios.geminiQuotaExceeded);
  // ...
});
```

## Anti-patterns

- No real network — MSW `onUnhandledRequest: 'error'` will fail the test.
- No shared mutable state between `it` blocks — use factories per test.
- No snapshot tests for AI outputs (too noisy).
- No `any` in tests (keeps signatures honest).

## What's next

See `.agent/plans/TESTING-PLAN.md` for the 5-phase rollout (P0 foundation → P4 E2E smoke).
