# Requirements: Brand Infrastructure API

**Defined:** 2026-05-19
**Core Value:** External developers can programmatically generate on-brand assets via a single API call

## v1 Requirements

Requirements for public beta. Each maps to roadmap phases.

### API Documentation

- [x] **DOCS-01**: Developer can access auto-generated OpenAPI 3.1 spec covering all 93 MCP tools
- [ ] **DOCS-02**: Developer can browse interactive Swagger UI at `/api/docs` with try-it-out capability

### Developer Portal

- [ ] **PORTAL-01**: Developer can create, revoke, and manage API keys with scope selection via dashboard
- [ ] **PORTAL-02**: Developer can view real-time usage analytics (API calls, credits consumed, historical graphs)
- [ ] **PORTAL-03**: Developer can follow a getting-started guide with copy-paste code examples per tool category

### SDKs

- [ ] **SDK-01**: Developer can install TypeScript SDK from npm with typed methods for all 93 tools
- [ ] **SDK-02**: Developer can install Python SDK from pip with typed methods for all 93 tools
- [ ] **SDK-03**: SDKs are auto-generated from the OpenAPI spec (single source of truth)

### Billing & Webhooks

- [ ] **BILL-01**: Developer can query current credit balance and quota via `GET /api/billing/balance`
- [ ] **BILL-02**: Developer can view API pricing tiers and rate card on a public pricing page
- [ ] **BILL-03**: Developer can register webhook URLs to receive async events (generation.complete, credits.depleted, brand.updated)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Developer Experience

- **DX-01**: Developer can test tools in an interactive API sandbox/playground
- **DX-02**: Developer can view documented error codes with resolution steps
- **DX-03**: Developer can subscribe to API changelog and status updates

### White-Label (v2.1)

- **WL-01**: Agency can create organization with sub-accounts
- **WL-02**: Agency can apply custom branding (logo, colors, name) to dashboard
- **WL-03**: Agency can manage client brands under one billing account
- **WL-04**: Agency can configure custom domain for their portal

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom API domains | Deferred to white-label milestone (v2.1) |
| Go/Rust/Java SDKs | Evaluate after TS/Python adoption metrics |
| API versioning (v2 paths) | Single version for beta; version when breaking changes needed |
| GraphQL endpoint | REST/OpenAPI is standard for this market; MCP already structured |
| Self-hosted option | SaaS-only for now; complexity not justified |
| Fine-tuned models | Not on technical roadmap |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DOCS-01 | Phase 1 | Complete |
| DOCS-02 | Phase 1 | Pending |
| PORTAL-01 | Phase 2 | Pending |
| PORTAL-02 | Phase 2 | Pending |
| PORTAL-03 | Phase 2 | Pending |
| SDK-01 | Phase 3 | Pending |
| SDK-02 | Phase 3 | Pending |
| SDK-03 | Phase 3 | Pending |
| BILL-01 | Phase 4 | Pending |
| BILL-02 | Phase 4 | Pending |
| BILL-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0

---
*Requirements defined: 2026-05-19*
*Last updated: 2026-05-19 — traceability mapped after roadmap creation*
