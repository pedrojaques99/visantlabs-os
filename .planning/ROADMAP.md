# Roadmap: v2.0 Brand Infrastructure API — Public Beta

**Milestone:** v2.0
**Created:** 2026-05-19
**Requirements:** 11 v1 requirements

## Phases

- [ ] **Phase 1: OpenAPI Spec & Interactive Docs** - Expose all 93 MCP tools as a machine-readable OpenAPI 3.1 spec with browsable Swagger UI
- [ ] **Phase 2: Developer Portal** - Give developers a dashboard to manage API keys, view usage analytics, and follow a getting-started guide
- [ ] **Phase 3: TypeScript & Python SDKs** - Ship auto-generated, typed SDKs to npm and pip from the OpenAPI spec
- [ ] **Phase 4: Billing Endpoints & Webhooks** - Expose credit balance/quota via API, publish a pricing page, and deliver async webhook events

## Phase Details

### Phase 1: OpenAPI Spec & Interactive Docs
**Goal**: Developers can discover and explore all 93 MCP tools through machine-readable spec and interactive UI
**Depends on**: Nothing (builds on existing mcp-server/shared.ts tool registry)
**Requirements**: DOCS-01, DOCS-02
**Success Criteria** (what must be TRUE):
  1. Developer can fetch `GET /api/openapi.json` and receive a valid OpenAPI 3.1 document listing all 93 tools with request/response schemas
  2. Developer can visit `/api/docs` in a browser and see Swagger UI with all tools grouped by category
  3. Developer can use the try-it-out button in Swagger UI to execute a real API call with their API key
  4. Adding or renaming a tool in `mcp-server/shared.ts` is automatically reflected in the spec without manual edits
**Plans:** 2 plans
Plans:
- [ ] 01-01-PLAN.md — Auto-generate OpenAPI 3.1 spec from MCP tool registry
- [ ] 01-02-PLAN.md — Serve Swagger UI at /api/docs with try-it-out
**UI hint**: yes

### Phase 2: Developer Portal
**Goal**: Developers can self-serve API access, monitor consumption, and onboard without contacting support
**Depends on**: Phase 1
**Requirements**: PORTAL-01, PORTAL-02, PORTAL-03
**Success Criteria** (what must be TRUE):
  1. Developer can create a new API key with selected scopes (read/write/generate) and see it listed in their dashboard
  2. Developer can revoke an API key and confirm it is immediately rejected by the API
  3. Developer can view a usage dashboard showing API call counts, credits consumed, and a historical graph
  4. Developer can follow a getting-started guide with copy-paste code examples for at least three tool categories
**Plans**: TBD
**UI hint**: yes

### Phase 3: TypeScript & Python SDKs
**Goal**: Developers can integrate Visant tools into their codebase using a typed SDK without writing raw HTTP calls
**Depends on**: Phase 1
**Requirements**: SDK-01, SDK-02, SDK-03
**Success Criteria** (what must be TRUE):
  1. Developer can run `npm install @visant/sdk` and call any of the 93 tools with full TypeScript type inference
  2. Developer can run `pip install visant-sdk` and call any of the 93 tools with Python type hints
  3. Both SDKs are generated from the OpenAPI spec via a single command; updating the spec regenerates both SDKs
  4. SDK README includes an authenticated hello-world example that runs end-to-end against the live API
**Plans**: TBD

### Phase 4: Billing Endpoints & Webhooks
**Goal**: Developers can programmatically monitor consumption, understand pricing, and receive async event notifications
**Depends on**: Phase 2
**Requirements**: BILL-01, BILL-02, BILL-03
**Success Criteria** (what must be TRUE):
  1. Developer can call `GET /api/billing/balance` with their API key and receive current credit balance and quota remaining
  2. Developer can view a public pricing page listing API tiers, per-call costs, and rate limits
  3. Developer can register a webhook URL and receive a `generation.complete` event payload within 5 seconds of a generation finishing
  4. Developer can register for `credits.depleted` and `brand.updated` events and receive correctly structured payloads
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. OpenAPI Spec & Interactive Docs | 0/2 | Planned | - |
| 2. Developer Portal | 0/? | Not started | - |
| 3. TypeScript & Python SDKs | 0/? | Not started | - |
| 4. Billing Endpoints & Webhooks | 0/? | Not started | - |

---
*Created: 2026-05-19*
*Last updated: 2026-05-19 — Phase 1 planned (2 plans)*
