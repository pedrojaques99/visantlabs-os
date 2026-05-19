# @visant/sdk — TypeScript SDK for Visant Labs API

Auto-generated TypeScript client for the [Visant Labs Brand Infrastructure API](https://api.visantlabs.com/api/docs).
Covers all 93+ MCP tools for AI-powered brand generation, mockups, creative studio, and compliance.

> **This SDK is auto-generated from the OpenAPI spec. Do not edit generated files directly.**

---

## Install

```bash
npm install @visant/sdk
```

---

## Quick Start

```typescript
import { OpenAPI, BrandService, MockupsService } from '@visant/sdk';

// Configure API key once (format: visant_sk_*)
OpenAPI.TOKEN = 'visant_sk_your_key_here';
OpenAPI.BASE = 'https://api.visantlabs.com';

// List brand guidelines
const result = await BrandService.getBrandInsights({
  brandGuidelineId: 'your-brand-id',
});
console.log(result);

// Generate a mockup
const mockup = await MockupsService.generateMockupImage({
  prompt: 'Product hero shot on white background',
  brandGuidelineId: 'your-brand-id',
});
console.log(mockup);
```

---

## Authentication

All API calls require a Visant API key in the format `visant_sk_*`.

Get your key from **Settings → API Keys** in the Visant dashboard.

```typescript
import { OpenAPI } from '@visant/sdk';

OpenAPI.TOKEN = 'visant_sk_xxxxxxxxxxxx';
```

The key is passed as a Bearer token in the `Authorization` header on every request.

---

## Available Services

| Service | Description |
|---------|-------------|
| `BrandService` | Brand insights and preference learning |
| `BrandGuidelinesService` | Brand guideline CRUD and public access |
| `BrandingService` | Brand generation and compliance |
| `AiGenerationService` | AI prompt generation, image analysis, extraction |
| `MockupsService` | Mockup generation and management |
| `CanvasService` | Canvas project management |
| `CampaignsService` | Ad campaign generation |
| `CreativeService` | Creative plans and analytics |
| `AuthService` | Authentication (login, register, tokens) |
| `ToolsService` | General MCP tools |

---

## Regenerating the SDK

Whenever the Visant API adds new tools, regenerate the SDK with:

```bash
bash scripts/generate-sdks.sh
```

This fetches the latest OpenAPI spec from the running server and re-runs `openapi-typescript-codegen`.

To generate from a non-running server (offline):

```bash
npx tsx scripts/dump-openapi-spec.ts
cd sdks/typescript
npm run generate
```

---

## Build

```bash
cd sdks/typescript
npm run build   # runs tsc, outputs to dist/
```

---

## License

MIT — Visant Labs
