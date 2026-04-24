# Coolify VPS Deployment — api.visantlabs.com

This document covers deploying the Visant Labs backend as a persistent Node.js
server on a Coolify-managed VPS. After this setup, Vercel serves the React
frontend only, and all `/api/*` traffic goes to `https://api.visantlabs.com`.

---

## Prerequisites

- Coolify instance running on your VPS
- GitHub repository access configured in Coolify
- Domain `api.visantlabs.com` pointed to the VPS IP (A record)
- A copy of all environment variable values from `VPS.env.example`

---

## 1. Create New Application in Coolify

1. Log in to your Coolify dashboard
2. Go to **Applications** > **New Application**
3. Select **GitHub** as source
4. Choose repository: `pedrojaques99/visantlabs-os`
5. Branch: `main` (or your production branch)

---

## 2. Build & Start Configuration

| Setting           | Value                          |
| ----------------- | ------------------------------ |
| Build Pack        | Dockerfile                     |
| Dockerfile path   | `./Dockerfile`                 |
| Port              | `3001`                         |
| Health check path | `/api/health`                  |
| Domain            | `api.visantlabs.com`           |
| HTTPS             | Enabled (Let's Encrypt)        |

If you prefer to skip the Dockerfile and use Nixpacks / Node directly:

- **Install command:** `npm install && npx prisma generate`
- **Build command:** _(leave empty)_
- **Start command:** `npx tsx server/index.ts`

---

## 3. Environment Variables

Set every variable from `VPS.env.example` in the Coolify **Environment Variables**
panel. Key values to update for production:

| Variable              | Production value                                          |
| --------------------- | --------------------------------------------------------- |
| `NODE_ENV`            | `production`                                             |
| `PORT`                | `3001`                                                   |
| `FRONTEND_URL`        | `https://visantlabs.com,https://www.visantlabs.com`      |
| `GOOGLE_REDIRECT_URI` | `https://api.visantlabs.com/api/auth/google/callback`    |
| `BETTER_AUTH_URL`     | `https://api.visantlabs.com/`                            |
| `REDIS_URL`           | Redis URL on VPS (e.g. `redis://localhost:6379`)          |

All other variables (API keys, secrets, DB URIs) should match your current
`.env` values. Never commit actual secrets.

---

## 4. Deploy

1. Click **Deploy** in Coolify
2. Watch the build logs — Prisma client generation runs inside the Dockerfile
3. After deploy, verify health check:

```bash
curl https://api.visantlabs.com/api/health
# Expected: {"status":"ok","message":"Server is running"}
```

---

## 5. Post-Deploy: Update Google OAuth

The Google OAuth redirect URI must point to the VPS API:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) > APIs & Services > Credentials
2. Open your OAuth 2.0 Client
3. Under **Authorized redirect URIs**, add:
   ```
   https://api.visantlabs.com/api/auth/google/callback
   ```
4. Remove the old Vercel redirect URI if no longer needed

---

## 6. Update Vercel Frontend

In your Vercel project dashboard, add this environment variable:

| Key             | Value                        |
| --------------- | ---------------------------- |
| `VITE_API_URL`  | `https://api.visantlabs.com` |

This tells the React frontend where to send API requests. Redeploy Vercel after
setting the variable.

---

## 7. Update Webhook URLs

Any external service sending webhooks must now point to the VPS:

| Service    | New webhook URL                                            |
| ---------- | ---------------------------------------------------------- |
| Stripe     | `https://api.visantlabs.com/api/payments/webhook`         |
| Resend     | `https://api.visantlabs.com/api/resend/webhook`           |
| Liveblocks | `https://api.visantlabs.com/api/liveblocks/webhook`       |

---

## Architecture Summary

```
Browser
  └─> https://visantlabs.com   (Vercel — React SPA, static)
        └─> VITE_API_URL       (env var, set in Vercel dashboard)
              └─> https://api.visantlabs.com  (Coolify VPS — Node.js persistent)
                    └─> MongoDB Atlas
                    └─> PostgreSQL (Prisma)
                    └─> Redis
                    └─> External APIs (Stripe, Resend, etc.)
```
