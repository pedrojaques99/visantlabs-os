# PSD Mockup Render — Setup & Deploy

Adds server-side PSD smart object replacement to the Visant Labs API.
Users send a PSD URL + art URL, get back a rendered PNG with full PSD effects.

> **Engine:** o compositor padrão é o pacote
> [`@visant/psd-engine`](../packages/psd-engine/README.md) (ag-psd + node-canvas,
> sem Chromium) — ver [`server/docs/psd-render.md`](../server/docs/psd-render.md)
> para a arquitetura atual, Scene Packages (render no browser) e os endpoints.
> A seção HeadlessPhotopea/Chromium abaixo descreve o worker **legado**
> (`PSD_RENDER_ENGINE=photopea`), mantido só como fallback. O runbook de
> go-live do parceiro Boxy mais abaixo continua válido.

## Architecture

```
POST /api/psd-render/render
  { psdUrl, artUrl, smartObject, hideLayers? }
         |
  Express route (Node.js) — validates, rate-limits (5/min)
         |
  psdRenderService — downloads PSD + art, spawns Bun subprocess
         |
  psd-render-worker.ts (Bun) — HeadlessPhotopea + Chromium
         |
  PNG output → uploaded to R2 → URL returned
```

## Files Added

| File                                  | Purpose                                               |
| ------------------------------------- | ----------------------------------------------------- |
| `server/routes/psdRender.ts`          | Express route: POST /render, GET /status              |
| `server/services/psdRenderService.ts` | Download files, spawn Bun worker, upload result to R2 |
| `server/scripts/psd-render-worker.ts` | Bun script: HeadlessPhotopea PSD render               |

## Files Modified

| File            | Change                                                                   |
| --------------- | ------------------------------------------------------------------------ |
| `server/app.ts` | Added import + mount at `/psd-render`                                    |
| `Dockerfile`    | Added: chromium, fonts, curl, Bun runtime, @printmadehq/mockup-generator |
| `package.json`  | Added: puppeteer-core                                                    |

## Dockerfile Changes

```dockerfile
# Added to apt-get:
chromium fonts-liberation fonts-noto-color-emoji curl unzip

# Added env vars:
PUPPETEER_SKIP_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Added Bun:
curl -fsSL https://bun.sh/install | bash

# Added after npm install:
npm install @printmadehq/mockup-generator --legacy-peer-deps --no-package-lock
```

## API Usage

### Render a PSD mockup

```bash
curl -X POST https://api.visantlabs.com/api/psd-render/render \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "psdUrl": "https://your-storage.com/mockup.psd",
    "artUrl": "https://your-storage.com/design.png",
    "smartObject": "Edite Aqui",
    "hideLayers": ["[BOXY]"]
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "url": "https://r2.visantlabs.com/psd-renders/userId/jobId.png",
    "sizeBytes": 9876543,
    "durationMs": 28000
  }
}
```

### Check status

```bash
curl https://api.visantlabs.com/api/psd-render/status \
  -H "Authorization: Bearer <token>"
```

## Auth & scopes

`POST /render` runs `authenticate → requireScope('generate') → renderLimiter → resolveTier`.

- **Interactive sessions** (logged-in browser, JWT) and trusted internal **MCP** calls are full-access and bypass the scope check.
- **Scoped credentials** — API keys (`visant_sk_*`) and OAuth tokens — must carry the **`generate`** scope or the request is rejected with `403 Insufficient scope`. A read-only key cannot trigger renders.
- **Access tier** (`resolveTier`) is computed from the *credential owner*: admin / team-member / `PSD_RENDER_ALLOWED_USERS` → `all` (full library + arbitrary `psdUrl`); everyone else → `public` (only `GOOGLE_DRIVE_PUBLIC_FOLDER_IDS`, no `psdUrl`). A partner key minted on a **dedicated non-admin account** therefore resolves to `public` by construction — it can never escalate to the full library even if leaked.

## Constraints

- Max 1 concurrent render (Redis semaphore)
- Render timeout: 120 seconds
- Temp files cleaned up after each render
- Rate limit: **per account, not per IP** (a single partner proxy IP no longer shares one bucket across users)
  - Interactive auth: **5 renders/min**
  - API-key (partner) auth: **`PSD_RENDER_PARTNER_MAX`** env (default **120**/min)

## Boxy partner integration — go-live runbook

The Boxy app proxies its users' renders to this endpoint server-to-server. Boxy enforces its own 3:1 render:download quota locally; Visant only executes the render. Steps to flip it on:

1. **Mint the partner key on a dedicated, non-admin Visant account** (e.g. `partner-boxy@…`). Scopes: `generate` (include `read`/`write` if other partner calls need them). The non-admin owner is what pins the key to `public` tier — do **not** use a team/admin account.
2. **Boxy `.env`:** set `VISANT_RENDER_API_KEY=visant_sk_…` and confirm `VISANT_RENDER_API_URL=https://api.visantlabs.com`.
3. **Visant `.env`:** set `GOOGLE_DRIVE_PUBLIC_FOLDER_IDS=<folder ids>` (the BOXY mockup library) + Drive auth (`GOOGLE_SERVICE_ACCOUNT_KEY` or refresh-token trio). Optionally tune `PSD_RENDER_PARTNER_MAX`.
4. **Boxy DB:** `npx prisma db push`, then set `render_enabled=true` + `psd_file_name` on the pilot products.
5. **Smoke test** the full path (curl below) and confirm a valid R2 URL comes back.

```bash
# Proves auth + generate-scope + public-tier render, end to end:
curl -X POST https://api.visantlabs.com/api/psd-render/render \
  -H "Authorization: Bearer $VISANT_RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"psdFileName":"<file-in-public-folder>.psd","arts":[{"smartObject":"*","artBase64":"<base64>"}],"hideLayers":["[BOXY]"]}'
```

## Deploy

Push to main → Coolify auto-deploys. The Dockerfile changes add ~200MB to the image (Chromium + Bun).

## Testing on VPS

After deploy, SSH in and verify:

```bash
# Check Bun is installed
bun --version

# Check Chromium is available
chromium --version

# Test the endpoint
curl -X POST http://localhost:3001/api/psd-render/render \
  -H "Content-Type: application/json" \
  -H "x-mcp-user-id: test-user" \
  -d '{"psdUrl":"<url>","artUrl":"<url>","smartObject":"Edite Aqui"}'
```
