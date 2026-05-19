# visant-sdk — Python SDK for Visant Labs API

Auto-generated Python client for the [Visant Labs API](https://api.visantlabs.com), covering all 93 MCP tools and REST endpoints.

> **Note:** This SDK is auto-generated from the OpenAPI spec. Do not edit files inside `visant_sdk/` directly — regenerate instead.

## Installation

```bash
pip install visant-sdk
```

Requires Python 3.8+.

## Authentication

All requests require an API key in `visant_sk_*` format. Obtain one from your [Visant Labs dashboard](https://app.visantlabs.com/settings/api-keys).

## Quick Start

```python
from visant_sdk import AuthenticatedClient

client = AuthenticatedClient(
    base_url="https://api.visantlabs.com",
    token="visant_sk_your_key_here",
)

# List brand guidelines
from visant_sdk.api.brand import list_brand_guidelines
from visant_sdk.models import ListBrandGuidelinesBody

body = ListBrandGuidelinesBody()
response = list_brand_guidelines.sync(client=client, body=body)
print(response)
```

### Async usage

```python
import asyncio
from visant_sdk import AuthenticatedClient
from visant_sdk.api.brand import list_brand_guidelines
from visant_sdk.models import ListBrandGuidelinesBody

async def main():
    async with AuthenticatedClient(
        base_url="https://api.visantlabs.com",
        token="visant_sk_your_key_here",
    ) as client:
        body = ListBrandGuidelinesBody()
        response = await list_brand_guidelines.asyncio(client=client, body=body)
        print(response)

asyncio.run(main())
```

## Available API Modules

| Module | Description |
|--------|-------------|
| `visant_sdk.api.brand` | Brand design system, guidelines, insights, validation |
| `visant_sdk.api.brand_guidelines` | CRUD for brand guidelines, public access |
| `visant_sdk.api.ai_generation` | AI mockup + image generation |
| `visant_sdk.api.ai` | AI tools (color analysis, typography extraction, etc.) |
| `visant_sdk.api.mockups` | Mockup CRUD and listing |
| `visant_sdk.api.canvas` | Creative canvas operations |
| `visant_sdk.api.campaigns` | Campaign management |
| `visant_sdk.api.creative` | Creative asset generation |
| `visant_sdk.api.auth` | Authentication (login, register, token refresh) |
| `visant_sdk.api.tools` | MCP tool listing and execution |
| `visant_sdk.api.branding` | Branding utilities |
| `visant_sdk.api.plugin` | Figma plugin integration |

## Regenerating the SDK

Requires the dev server running (or use the offline spec snapshot):

```bash
# From repo root
bash scripts/generate-sdks.sh
```

To refresh the spec snapshot without running the server:

```bash
npx tsx scripts/dump-openapi-spec.ts
```

## Authentication Reference

| Method | Header |
|--------|--------|
| API Key | `Authorization: Bearer visant_sk_your_key_here` |

Use `AuthenticatedClient` for endpoints requiring auth, and `Client` for public endpoints.
