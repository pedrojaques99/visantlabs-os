/**
 * OAuth 2.1 + PKCE browser flow — reuses /oauth/* endpoints.
 *
 * Flow:
 *  1. Register dynamic public client (no secret)
 *  2. Generate PKCE verifier + challenge
 *  3. Spin up local HTTP server on random port to catch callback
 *  4. Open browser → /oauth/authorize
 *  5. User approves → browser redirects to localhost with ?code=
 *  6. Exchange auth code for access token
 *  7. Return access token (JWT) — caller creates permanent API key
 */

import { createServer } from 'http'
import { createHash, randomBytes } from 'crypto'
import { API_BASE } from './api.js'

// OAuth lives at root domain, not under /api
const OAUTH_BASE = API_BASE.replace(/\/api$/, '')

function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

async function oauthPost(path: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${OAUTH_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error_description ?? json?.error ?? `HTTP ${res.status}`)
  return json
}

export async function browserOAuthFlow(): Promise<string> {
  // 1. Dynamic client registration (public client, no secret)
  let clientId = 'visant-cli'
  try {
    const reg = await oauthPost('/oauth/register', {
      client_name: 'Visant CLI',
      redirect_uris: ['http://localhost'],
      grant_types: ['authorization_code'],
      token_endpoint_auth_method: 'none',
    })
    if (!reg.client_id) throw new Error('no client_id')
    clientId = reg.client_id
  } catch {
    throw new Error('OAuth client registration failed — use visant login --email instead')
  }

  const { verifier, challenge } = pkce()
  const state = randomBytes(16).toString('hex')
  const port = 40000 + Math.floor(Math.random() * 10000)
  const redirectUri = `http://localhost:${port}`

  // 2. Build authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    response_type: 'code',
  })
  const authUrl = `${OAUTH_BASE}/oauth/authorize?${params}`

  // 3. Open browser
  const { default: open } = await import('open')
  await open(authUrl)

  // 4. Wait for callback
  const code = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => { server.close(); reject(new Error('Timeout (120s)')) }, 120_000)

    const server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${port}`)
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      const retState = url.searchParams.get('state')

      const ok = !error && code && retState === state
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<!DOCTYPE html><html><head><meta charset="utf-8">
        <style>*{box-sizing:border-box}body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#09090b;color:#fafafa}
        .card{border:1px solid #27272a;border-radius:16px;padding:2.5rem;max-width:420px;width:90%;text-align:center}
        h2{margin:0 0 .75rem;font-size:1.375rem;font-weight:600}p{margin:0;color:#71717a;font-size:.9rem;line-height:1.5}
        .icon{font-size:2.5rem;margin-bottom:1rem}</style></head>
        <body><div class="card">
          <div class="icon">${ok ? '✅' : '❌'}</div>
          <h2>${ok ? 'Autenticado com sucesso' : 'Autenticação cancelada'}</h2>
          <p>${ok ? 'Pode fechar esta aba e voltar ao terminal.' : 'Feche esta aba e tente novamente.'}</p>
        </div></body></html>`)

      clearTimeout(timer)
      server.close()
      if (error) return reject(new Error(`OAuth: ${error}`))
      if (retState !== state) return reject(new Error('State mismatch'))
      if (!code) return reject(new Error('No code in callback'))
      resolve(code)
    })

    server.listen(port)
  })

  // 5. Exchange code for access token
  const tokenRes = await oauthPost('/oauth/token', {
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    client_id: clientId,
    redirect_uri: redirectUri,
  })

  return tokenRes.access_token as string
}
