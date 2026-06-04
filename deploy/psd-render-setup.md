# PSD Mockup Render — Setup & Deploy

Adds server-side PSD smart object replacement to the Visant Labs API.
Users send a PSD URL + art URL, get back a rendered PNG with full PSD effects.

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

| File | Purpose |
|---|---|
| `server/routes/psdRender.ts` | Express route: POST /render, GET /status |
| `server/services/psdRenderService.ts` | Download files, spawn Bun worker, upload result to R2 |
| `server/scripts/psd-render-worker.ts` | Bun script: HeadlessPhotopea PSD render |

## Files Modified

| File | Change |
|---|---|
| `server/app.ts` | Added import + mount at `/psd-render` |
| `Dockerfile` | Added: chromium, fonts, curl, Bun runtime, @printmadehq/mockup-generator |
| `package.json` | Added: puppeteer-core |

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

## Constraints

- Max 1 concurrent render (Redis semaphore)
- Rate limit: 5 requests/minute per IP
- Render timeout: 120 seconds
- Temp files cleaned up after each render

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
