import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { JWT_SECRET } from '../utils/jwtSecret.js';
import { API_BASE_URL, MCP_ENDPOINT, MCP_SCOPES } from '../lib/mcp-constants.js';

const router = express.Router();

const BASE_URL = API_BASE_URL;
const MCP_RESOURCE = MCP_ENDPOINT;
const REFRESH_TOKEN_TTL_DAYS = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLocalhostUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/** Normalize a redirect URI for storage: strip the port from localhost URIs */
function normalizeRedirectUri(uri: string): string {
  if (isLocalhostUri(uri)) {
    try {
      const u = new URL(uri);
      return `${u.protocol}//${u.hostname}${u.pathname}`;
    } catch {
      return uri;
    }
  }
  return uri;
}

/** Check if a presented redirect_uri matches a stored one (localhost port-agnostic) */
function redirectUriMatches(presented: string, stored: string): boolean {
  if (presented === stored) return true;
  if (isLocalhostUri(presented) && isLocalhostUri(stored)) {
    return normalizeRedirectUri(presented) === normalizeRedirectUri(stored);
  }
  return false;
}

function isClientIdUrl(clientId: string): boolean {
  try {
    const u = new URL(clientId);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

async function resolveOrRegisterClient(clientId: string) {
  const existing = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (existing) return existing;

  if (!isClientIdUrl(clientId)) return null;

  try {
    const res = await fetch(clientId, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const meta = (await res.json()) as {
      client_name?: string;
      redirect_uris?: string[];
      grant_types?: string[];
      token_endpoint_auth_method?: string;
    };

    if (!meta.redirect_uris?.length) return null;

    const normalizedUris = meta.redirect_uris.map((uri: string) => normalizeRedirectUri(uri));
    const grantTypes = Array.isArray(meta.grant_types) ? meta.grant_types : ['authorization_code'];

    const client = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientName: meta.client_name || new URL(clientId).hostname,
        redirectUris: normalizedUris,
        grantTypes: grantTypes,
      },
    });

    console.log(`[OAuth] Auto-registered client from metadata URL: ${clientId}`);
    return client;
  } catch (err) {
    console.error(`[OAuth] Failed to fetch client metadata from ${clientId}:`, err);
    return null;
  }
}

function verifyPkce(codeVerifier: string, storedChallenge: string): boolean {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const computed = Buffer.from(hash).toString('base64url');
  return computed === storedChallenge;
}

function issueAccessToken(
  userId: string,
  clientId: string,
  scopes: string,
  resource: string
): string {
  return jwt.sign(
    {
      sub: userId,
      aud: resource || MCP_RESOURCE,
      scope: scopes,
      client_id: clientId,
      jti: crypto.randomUUID(),
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// ── Well-known: OAuth Authorization Server metadata ───────────────────────────

router.get('/.well-known/oauth-authorization-server', (_req, res) => {
  res.json({
    issuer: BASE_URL,
    authorization_endpoint: `${BASE_URL}/oauth/authorize`,
    token_endpoint: `${BASE_URL}/oauth/token`,
    registration_endpoint: `${BASE_URL}/oauth/register`,
    revocation_endpoint: `${BASE_URL}/oauth/revoke`,
    code_challenge_methods_supported: ['S256'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    response_types_supported: ['code'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...MCP_SCOPES],
    client_id_metadata_document_supported: true,
  });
});

// ── Well-known: OAuth Protected Resource metadata ─────────────────────────────

router.get('/.well-known/oauth-protected-resource', (_req, res) => {
  res.json({
    resource: MCP_RESOURCE,
    authorization_servers: [BASE_URL],
    scopes_supported: [...MCP_SCOPES],
  });
});

// ── Dynamic Client Registration (RFC 7591) ────────────────────────────────────

router.post('/oauth/register', async (req, res) => {
  try {
    const { client_name, redirect_uris, grant_types, token_endpoint_auth_method } = req.body;

    if (!client_name || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: 'client_name and redirect_uris are required',
      });
    }

    const clientId = crypto.randomUUID();
    const normalizedUris = redirect_uris.map((uri: string) => normalizeRedirectUri(uri));
    const grantTypesResolved: string[] = Array.isArray(grant_types)
      ? grant_types
      : ['authorization_code'];

    await prisma.oAuthClient.create({
      data: {
        clientId,
        clientName: client_name,
        redirectUris: normalizedUris,
        grantTypes: grantTypesResolved,
      },
    });

    return res.status(201).json({
      client_id: clientId,
      client_name,
      redirect_uris: normalizedUris,
      grant_types: grantTypesResolved,
      token_endpoint_auth_method: token_endpoint_auth_method || 'none',
      client_id_issued_at: Math.floor(Date.now() / 1000),
    });
  } catch (err) {
    console.error('[OAuth] /oauth/register error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── Authorization endpoint — GET (show consent or redirect to login) ──────────

router.get('/oauth/authorize', async (req, res) => {
  const {
    client_id,
    redirect_uri,
    code_challenge,
    code_challenge_method,
    state,
    resource,
    response_type,
  } = req.query as Record<string, string>;

  // Validate required params
  if (!client_id || !redirect_uri || !code_challenge || !state) {
    return res
      .status(400)
      .send('Missing required parameters: client_id, redirect_uri, code_challenge, state');
  }

  if (code_challenge_method && code_challenge_method !== 'S256') {
    return res.status(400).send('Only code_challenge_method=S256 is supported');
  }

  if (response_type && response_type !== 'code') {
    return res.status(400).send('Only response_type=code is supported');
  }

  try {
    // Lookup client — auto-register if client_id is a metadata URL (RFC 7591 §2)
    const oauthClient = await resolveOrRegisterClient(client_id);
    if (!oauthClient) {
      return res.status(400).send('Unknown client_id');
    }

    // Validate redirect_uri
    const uriMatch = oauthClient.redirectUris.some((stored) =>
      redirectUriMatches(redirect_uri, stored)
    );
    if (!uriMatch) {
      return res.status(400).send('redirect_uri not registered for this client');
    }

    // Check if user is logged in.
    // The Visant frontend stores JWTs in localStorage (no httpOnly cookies), so we
    // accept the token via:
    //   1. ?token=<jwt> query param  — set by the frontend login page after auth
    //   2. Authorization: Bearer <jwt> header — for programmatic / API callers
    const tokenParam = req.query.token as string | undefined;
    const bearerHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const rawToken = tokenParam || bearerHeader;

    let userId: string | null = null;

    if (rawToken) {
      try {
        const decoded = jwt.verify(rawToken, JWT_SECRET) as { userId: string };
        userId = decoded.userId;
      } catch {
        // invalid token, treat as not logged in
      }
    }

    if (!userId) {
      // Redirect to frontend /login with redirect_back to come back after auth
      const params = new URLSearchParams({
        client_id,
        redirect_uri,
        code_challenge,
        code_challenge_method: code_challenge_method || 'S256',
        state,
        response_type: response_type || 'code',
        ...(resource ? { resource } : {}),
      });
      const frontendUrl =
        process.env.FRONTEND_URL?.split(',')[0]?.trim() || 'https://visantlabs.com';
      const authorizeUrl = `${API_BASE_URL}/oauth/authorize?${params.toString()}`;
      const loginUrl = `${frontendUrl}/login?redirect_back=${encodeURIComponent(authorizeUrl)}`;
      return res.redirect(loginUrl);
    }

    // User is logged in — show consent page
    const clientName = oauthClient.clientName;
    const consentHtml = buildConsentPage({
      clientName,
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method || 'S256',
      state,
      resource: resource || MCP_RESOURCE,
      scopes: 'read write generate',
      token: rawToken,
    });

    return res.send(consentHtml);
  } catch (err) {
    console.error('[OAuth] GET /oauth/authorize error', err);
    return res.status(500).send('Internal server error');
  }
});

// ── Authorization endpoint — POST (user approved/denied consent) ──────────────

router.post('/oauth/authorize', express.urlencoded({ extended: false }), async (req, res) => {
  const {
    client_id,
    redirect_uri,
    code_challenge,
    code_challenge_method,
    resource,
    scopes,
    state,
    action,
  } = req.body as Record<string, string>;

  if (!client_id || !redirect_uri || !code_challenge || !state || !action) {
    return res.status(400).send('Missing required parameters');
  }

  if (action === 'deny') {
    const url = new URL(redirect_uri);
    url.searchParams.set('error', 'access_denied');
    if (state) url.searchParams.set('state', state);
    return res.redirect(url.toString());
  }

  try {
    // Verify client exists and redirect_uri is valid
    const oauthClient = await resolveOrRegisterClient(client_id);
    if (!oauthClient) {
      return res.status(400).send('Unknown client_id');
    }

    const uriMatch = oauthClient.redirectUris.some((stored) =>
      redirectUriMatches(redirect_uri, stored)
    );
    if (!uriMatch) {
      return res.status(400).send('redirect_uri not registered');
    }

    // Re-verify user session: accept token from form body or Authorization header
    const tokenInBody = (req.body as Record<string, string>).token;
    const bearerInHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const rawToken = tokenInBody || bearerInHeader;
    let userId: string | null = null;
    if (rawToken) {
      try {
        const decoded = jwt.verify(rawToken, JWT_SECRET) as { userId: string };
        userId = decoded.userId;
      } catch {
        // fall through
      }
    }

    if (!userId) {
      return res.status(401).send('Session expired. Please log in again.');
    }

    // Generate auth code
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.oAuthAuthCode.create({
      data: {
        code,
        clientId: client_id,
        userId,
        codeChallenge: code_challenge,
        resource: resource || MCP_RESOURCE,
        scopes: (scopes || 'read write generate').split(' ').filter(Boolean),
        expiresAt,
        used: false,
      },
    });

    const url = new URL(redirect_uri);
    url.searchParams.set('code', code);
    if (state) url.searchParams.set('state', state);
    return res.redirect(url.toString());
  } catch (err) {
    console.error('[OAuth] POST /oauth/authorize error', err);
    return res.status(500).send('Internal server error');
  }
});

// ── Token endpoint ────────────────────────────────────────────────────────────

router.post('/oauth/token', async (req, res) => {
  const { grant_type } = req.body as Record<string, string>;

  if (grant_type === 'authorization_code') {
    return handleAuthCodeExchange(req, res);
  }

  if (grant_type === 'refresh_token') {
    return handleRefreshToken(req, res);
  }

  return res.status(400).json({ error: 'unsupported_grant_type' });
});

async function handleAuthCodeExchange(req: express.Request, res: express.Response) {
  const { code, code_verifier, client_id, redirect_uri } = req.body as Record<string, string>;

  if (!code || !code_verifier || !client_id) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'code, code_verifier, client_id are required',
    });
  }

  try {
    const authCode = await prisma.oAuthAuthCode.findUnique({ where: { code } });

    if (!authCode) {
      return res
        .status(400)
        .json({ error: 'invalid_grant', error_description: 'Unknown authorization code' });
    }

    if (authCode.used) {
      return res
        .status(400)
        .json({ error: 'invalid_grant', error_description: 'Authorization code already used' });
    }

    if (new Date() > authCode.expiresAt) {
      return res
        .status(400)
        .json({ error: 'invalid_grant', error_description: 'Authorization code expired' });
    }

    if (authCode.clientId !== client_id) {
      return res
        .status(400)
        .json({ error: 'invalid_grant', error_description: 'client_id mismatch' });
    }

    // Validate redirect_uri if provided
    if (redirect_uri) {
      const oauthClient = await prisma.oAuthClient.findUnique({ where: { clientId: client_id } });
      if (!oauthClient) {
        return res.status(400).json({ error: 'invalid_client' });
      }
      const uriMatch = oauthClient.redirectUris.some((stored) =>
        redirectUriMatches(redirect_uri, stored)
      );
      if (!uriMatch) {
        return res
          .status(400)
          .json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
      }
    }

    // Verify PKCE
    if (!verifyPkce(code_verifier, authCode.codeChallenge)) {
      return res
        .status(400)
        .json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
    }

    // Mark code as used
    await prisma.oAuthAuthCode.update({ where: { code }, data: { used: true } });

    const scopes = authCode.scopes.join(' ');
    const accessToken = issueAccessToken(authCode.userId, client_id, scopes, authCode.resource);

    // Issue persistent refresh token
    const refreshToken = crypto.randomBytes(32).toString('hex');
    await prisma.oAuthRefreshToken.create({
      data: {
        token: refreshToken,
        userId: authCode.userId,
        clientId: client_id,
        scopes: authCode.scopes,
        resource: authCode.resource,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    return res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: scopes,
    });
  } catch (err) {
    console.error('[OAuth] token exchange error', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

async function handleRefreshToken(req: express.Request, res: express.Response) {
  const { refresh_token, client_id } = req.body as Record<string, string>;

  if (!refresh_token) {
    return res
      .status(400)
      .json({ error: 'invalid_request', error_description: 'refresh_token is required' });
  }

  try {
    const stored = await prisma.oAuthRefreshToken.findUnique({ where: { token: refresh_token } });
    if (!stored || stored.expiresAt < new Date()) {
      return res
        .status(400)
        .json({ error: 'invalid_grant', error_description: 'Unknown or expired refresh token' });
    }

    if (client_id && stored.clientId !== client_id) {
      return res
        .status(400)
        .json({ error: 'invalid_grant', error_description: 'client_id mismatch' });
    }

    // Rotate: delete old, create new
    await prisma.oAuthRefreshToken.delete({ where: { id: stored.id } });
    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    await prisma.oAuthRefreshToken.create({
      data: {
        token: newRefreshToken,
        userId: stored.userId,
        clientId: stored.clientId,
        scopes: stored.scopes,
        resource: stored.resource,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    const scopes = stored.scopes.join(' ');
    const accessToken = issueAccessToken(stored.userId, stored.clientId, scopes, stored.resource);

    return res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: newRefreshToken,
      scope: scopes,
    });
  } catch (err) {
    console.error('[OAuth] refresh token error', err);
    return res.status(500).json({ error: 'server_error' });
  }
}

// ── Token Revocation (RFC 7009) ───────────────────────────────────────────

router.post('/oauth/revoke', async (req, res) => {
  const { token, token_type_hint } = req.body as Record<string, string>;

  if (!token) {
    return res
      .status(400)
      .json({ error: 'invalid_request', error_description: 'token is required' });
  }

  try {
    // Try refresh token first (most common revocation target)
    if (!token_type_hint || token_type_hint === 'refresh_token') {
      const deleted = await prisma.oAuthRefreshToken.deleteMany({ where: { token } });
      if (deleted.count > 0) return res.sendStatus(200);
    }

    // Access tokens are stateless JWTs — cannot revoke directly.
    // Per RFC 7009: server MUST respond 200 even if token is unknown/already invalid.
    return res.sendStatus(200);
  } catch (err) {
    console.error('[OAuth] /oauth/revoke error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// ── Cleanup expired tokens (called periodically or on-demand) ─────────────

async function cleanupExpiredOAuthData() {
  const now = new Date();
  const [codes, tokens] = await Promise.all([
    prisma.oAuthAuthCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { used: true, createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
        ],
      },
    }),
    prisma.oAuthRefreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  if (codes.count || tokens.count) {
    console.log(
      `[OAuth] Cleanup: ${codes.count} auth codes, ${tokens.count} refresh tokens removed`
    );
  }
}

// Run cleanup every 6 hours
setInterval(cleanupExpiredOAuthData, 6 * 60 * 60 * 1000);
cleanupExpiredOAuthData().catch(() => {});

// ── Login HTML page (inline, no SPA dependency) ─────────────────────────────

interface LoginPageParams {
  clientName: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  resource: string;
  responseType: string;
}

function buildLoginPage(p: LoginPageParams): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const apiBase = API_BASE_URL;
  const authorizeParams = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    code_challenge: p.codeChallenge,
    code_challenge_method: p.codeChallengeMethod,
    state: p.state,
    response_type: p.responseType,
    resource: p.resource,
  }).toString();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign in — Visant Labs</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 2.5rem 2rem;
      max-width: 420px;
      width: 100%;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1.75rem;
    }
    .logo-text { font-size: 1.1rem; font-weight: 700; color: #f8fafc; }
    h1 { font-size: 1.25rem; font-weight: 600; color: #f8fafc; margin-bottom: 0.5rem; }
    .app-name { color: #0ea5e9; font-weight: 600; }
    .subtitle { font-size: 0.9rem; color: #94a3b8; margin-bottom: 1.75rem; }
    .field { margin-bottom: 1rem; }
    .field label { display: block; font-size: 0.8rem; font-weight: 600; color: #94a3b8; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .field input {
      width: 100%;
      padding: 0.7rem 0.9rem;
      border-radius: 8px;
      border: 1px solid #334155;
      background: #0f172a;
      color: #f8fafc;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.15s;
    }
    .field input:focus { border-color: #0ea5e9; }
    .btn {
      width: 100%;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      background: #0ea5e9;
      color: #fff;
      transition: opacity 0.15s;
      margin-top: 0.5rem;
    }
    .btn:hover { opacity: 0.85; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #f87171; font-size: 0.85rem; margin-top: 0.75rem; display: none; }
    .register-link { text-align: center; margin-top: 1.25rem; font-size: 0.85rem; color: #64748b; }
    .register-link a { color: #0ea5e9; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#0ea5e9"/><path d="M8 12l3 3 5-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span class="logo-text">Visant Labs</span>
    </div>
    <h1>Sign in to continue</h1>
    <p class="subtitle"><span class="app-name">${esc(p.clientName)}</span> wants to connect to your account.</p>

    <form id="loginForm">
      <div class="field">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required autocomplete="email" autofocus />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autocomplete="current-password" />
      </div>
      <button type="submit" class="btn" id="submitBtn">Sign in</button>
      <div class="error" id="error"></div>
    </form>
    <div class="register-link">
      Don't have an account? <a href="https://visantlabs.com" target="_blank">Sign up</a>
    </div>
  </div>
  <script>
    const form = document.getElementById('loginForm');
    const errorEl = document.getElementById('error');
    const btn = document.getElementById('submitBtn');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.style.display = 'none';
      btn.disabled = true;
      btn.textContent = 'Signing in...';
      try {
        const res = await fetch('${esc(apiBase)}/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.token) {
          throw new Error(data.message || data.error || 'Invalid credentials');
        }
        window.location.href = '${esc(apiBase)}/oauth/authorize?${esc(authorizeParams)}&token=' + encodeURIComponent(data.token);
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Sign in';
      }
    });
  </script>
</body>
</html>`;
}

// ── Consent HTML page ─────────────────────────────────────────────────────────

interface ConsentPageParams {
  clientName: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
  resource: string;
  scopes: string;
  /** JWT passed through the consent form so POST can re-verify the session */
  token?: string;
}

function buildConsentPage(p: ConsentPageParams): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authorize — Visant Labs</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 2.5rem 2rem;
      max-width: 420px;
      width: 100%;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1.75rem;
    }
    .logo-dot {
      width: 10px;
      height: 10px;
      background: #0ea5e9;
      border-radius: 50%;
    }
    .logo-text { font-size: 1.1rem; font-weight: 700; color: #f8fafc; }
    h1 { font-size: 1.25rem; font-weight: 600; color: #f8fafc; margin-bottom: 0.5rem; }
    .app-name { color: #0ea5e9; font-weight: 600; }
    .subtitle { font-size: 0.9rem; color: #94a3b8; margin-bottom: 1.75rem; }
    .scopes { background: #0f172a; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: 1.75rem; }
    .scopes-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 0.75rem; }
    .scope-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0; font-size: 0.9rem; color: #cbd5e1; }
    .scope-icon { color: #0ea5e9; font-size: 1rem; line-height: 1; }
    .actions { display: flex; gap: 0.75rem; }
    .btn {
      flex: 1;
      padding: 0.7rem 1rem;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.85; }
    .btn-approve { background: #0ea5e9; color: #fff; }
    .btn-deny { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#0ea5e9"/><path d="M8 12l3 3 5-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span class="logo-text">Visant Labs</span>
    </div>
    <h1><span class="app-name">${esc(p.clientName)}</span> wants access</h1>
    <p class="subtitle">This application is requesting permission to access your Visant Labs account.</p>

    <div class="scopes">
      <div class="scopes-title">Permissions requested</div>
      <div class="scope-item"><span class="scope-icon">&#9679;</span> Read your brand guidelines and projects</div>
      <div class="scope-item"><span class="scope-icon">&#9679;</span> Write and update content on your behalf</div>
      <div class="scope-item"><span class="scope-icon">&#9679;</span> Trigger AI generation features</div>
    </div>

    <div class="actions">
      <form method="POST" action="/oauth/authorize" style="flex:1; display:contents;">
        <input type="hidden" name="action" value="deny" />
        <input type="hidden" name="client_id" value="${esc(p.clientId)}" />
        <input type="hidden" name="redirect_uri" value="${esc(p.redirectUri)}" />
        <input type="hidden" name="code_challenge" value="${esc(p.codeChallenge)}" />
        <input type="hidden" name="code_challenge_method" value="${esc(p.codeChallengeMethod)}" />
        <input type="hidden" name="state" value="${esc(p.state)}" />
        <input type="hidden" name="resource" value="${esc(p.resource)}" />
        <input type="hidden" name="scopes" value="${esc(p.scopes)}" />
        ${p.token ? `<input type="hidden" name="token" value="${esc(p.token)}" />` : ''}
        <button type="submit" class="btn btn-deny">Deny</button>
      </form>
      <form method="POST" action="/oauth/authorize" style="flex:1; display:contents;">
        <input type="hidden" name="action" value="approve" />
        <input type="hidden" name="client_id" value="${esc(p.clientId)}" />
        <input type="hidden" name="redirect_uri" value="${esc(p.redirectUri)}" />
        <input type="hidden" name="code_challenge" value="${esc(p.codeChallenge)}" />
        <input type="hidden" name="code_challenge_method" value="${esc(p.codeChallengeMethod)}" />
        <input type="hidden" name="state" value="${esc(p.state)}" />
        <input type="hidden" name="resource" value="${esc(p.resource)}" />
        <input type="hidden" name="scopes" value="${esc(p.scopes)}" />
        ${p.token ? `<input type="hidden" name="token" value="${esc(p.token)}" />` : ''}
        <button type="submit" class="btn btn-approve">Approve</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}

export default router;
