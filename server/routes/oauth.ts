import express from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { JWT_SECRET } from '../utils/jwtSecret.js';
import {
  API_BASE_URL,
  MCP_ENDPOINT,
  MCP_SCOPES,
  MCP_SPEC_VERSION,
  MCP_HINTS,
  DEVICE_CODE_GRANT,
  OOB_REDIRECT_URI,
} from '../lib/mcp-constants.js';
import {
  langFrom,
  buildLoginPage,
  buildConsentPage,
  buildDeviceLoginPage,
  buildDeviceCodeEntryPage,
  buildDeviceConsentPage,
  buildDonePage,
  buildOobCodePage,
  buildErrorPage,
} from './oauth-pages.js';

const router = express.Router();

const BASE_URL = API_BASE_URL;
const MCP_RESOURCE = MCP_ENDPOINT;
const REFRESH_TOKEN_TTL_DAYS = 30;
const DEVICE_CODE_TTL_SECONDS = 600;
const DEVICE_POLL_INTERVAL = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** E-mail da conta pra tela de consentimento. Só informativo: falhou, a tela segue sem ele. */
async function emailOf(userId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    return user?.email ?? null;
  } catch {
    return null;
  }
}

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

function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code.slice(0, 4) + '-' + code.slice(4);
}

async function getDeviceCodesCollection() {
  await connectToMongoDB();
  const db = getDb();
  const col = db.collection('oauth_device_codes');
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
  await col.createIndex({ deviceCode: 1 }, { unique: true }).catch(() => {});
  await col.createIndex({ userCode: 1 }).catch(() => {});
  return col;
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
    device_authorization_endpoint: `${BASE_URL}/oauth/device/code`,
    grant_types_supported: ['authorization_code', 'refresh_token', DEVICE_CODE_GRANT],
    response_types_supported: ['code'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...MCP_SCOPES],
    client_id_metadata_document_supported: true,
    _agent_hint:
      'Register via POST ' +
      BASE_URL +
      '/oauth/register, then open ' +
      BASE_URL +
      "/oauth/authorize in the user's browser for consent. " +
      'Full step-by-step: ' +
      BASE_URL +
      '/llms-full.txt',
  });
});

// ── Well-known: OAuth Protected Resource metadata ─────────────────────────────

router.get('/.well-known/oauth-protected-resource', (_req, res) => {
  res.json({
    resource: MCP_RESOURCE,
    authorization_servers: [BASE_URL],
    scopes_supported: [...MCP_SCOPES],
    bearer_methods_supported: ['header'],
    resource_documentation: `${BASE_URL}/llms-full.txt`,
    _agent_hint: {
      message: 'To connect, use OAuth 2.1 (PKCE), Device Flow, or an API key (visant_sk_xxx).',
      oauth_discovery: `${BASE_URL}/.well-known/oauth-authorization-server`,
      quick_start: MCP_HINTS.oauthSteps(BASE_URL),
      device_flow: MCP_HINTS.deviceFlowSteps(BASE_URL),
      json_rpc_protocol: MCP_HINTS.protocolHintCompact(MCP_RESOURCE, MCP_SPEC_VERSION),
      full_reference: `${BASE_URL}/llms-full.txt`,
    },
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
    scope,
  } = req.query as Record<string, string>;
  const lang = langFrom(req.headers['accept-language']);

  // Validate required params — state is optional for OOB (no redirect to CSRF-protect)
  const isOobRequest = redirect_uri === OOB_REDIRECT_URI;
  const missingParams = [
    !client_id && 'client_id',
    !redirect_uri && 'redirect_uri',
    !code_challenge && 'code_challenge',
    !state && !isOobRequest && 'state',
  ].filter(Boolean);
  if (missingParams.length > 0) {
    return res.status(400).send(buildErrorPage({ lang, error: 'missing' }));
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
      return res.status(400).send(buildErrorPage({ lang, error: 'unknownClient' }));
    }

    // Validate redirect_uri — OOB is always allowed for agents without a local server
    const isOob = redirect_uri === OOB_REDIRECT_URI;
    if (!isOob) {
      const uriMatch = oauthClient.redirectUris.some((stored) =>
        redirectUriMatches(redirect_uri, stored)
      );
      if (!uriMatch) {
        return res.status(400).send(buildErrorPage({ lang, error: 'badRedirect' }));
      }
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
        const decoded = jwt.verify(rawToken, JWT_SECRET) as { userId?: string; sub?: string };
        userId = decoded.userId || decoded.sub || null;
      } catch {
        // invalid token, treat as not logged in
      }
    }

    // Validate requested scopes — default to all if not specified
    const validScopes = new Set(MCP_SCOPES as readonly string[]);
    const requestedScopes = scope
      ? scope.split(/[\s+]+/).filter((s) => validScopes.has(s))
      : [...MCP_SCOPES];
    const resolvedScopes = requestedScopes.length > 0 ? requestedScopes : [...MCP_SCOPES];

    // Os mesmos parâmetros servem pro login voltar aqui e pro "trocar de conta".
    const authorizeUrl = `${BASE_URL}/oauth/authorize?${new URLSearchParams({
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method: code_challenge_method || 'S256',
      state: state || '',
      response_type: response_type || 'code',
      resource: resource || MCP_RESOURCE,
      scope: resolvedScopes.join(' '),
    }).toString()}`;

    if (!userId) {
      // Serve standalone login page (no SPA dependency) so browser-based OAuth flows
      // and agents that open a browser window can complete authentication.
      return res.send(
        buildLoginPage({
          lang,
          apiBase: API_BASE_URL,
          clientName: oauthClient.clientName,
          authorizeUrl,
          googleFailed: req.query.login_error === 'google',
        })
      );
    }

    // User is logged in — show consent page
    const accountEmail = await emailOf(userId);

    return res.send(
      buildConsentPage({
        lang,
        action: `${BASE_URL}/oauth/authorize`,
        clientName: oauthClient.clientName,
        accountEmail,
        returnHost: isOob ? null : new URL(redirect_uri).host,
        switchAccountUrl: authorizeUrl,
        scopes: resolvedScopes.join(' '),
        hidden: {
          client_id,
          redirect_uri,
          code_challenge,
          code_challenge_method: code_challenge_method || 'S256',
          state: state || '',
          resource: resource || MCP_RESOURCE,
          scopes: resolvedScopes.join(' '),
          token: rawToken || '',
        },
      })
    );
  } catch (err) {
    console.error('[OAuth] GET /oauth/authorize error', err);
    return res.status(500).send(buildErrorPage({ lang, error: 'server' }));
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
  const lang = langFrom(req.headers['accept-language']);

  const isOob = redirect_uri === OOB_REDIRECT_URI;

  if (!client_id || !redirect_uri || !code_challenge || (!state && !isOob) || !action) {
    return res.status(400).send(buildErrorPage({ lang, error: 'missing' }));
  }

  try {
    // Verify client exists and redirect_uri is valid — ANTES de qualquer
    // redirect, inclusive o de negar.
    //
    // O ramo `deny` mandava o browser pro `redirect_uri` cru: o GET valida,
    // mas o POST é um form comum e qualquer página podia postar aqui com um
    // host arbitrário. Resultado: open redirect saindo de api.visantlabs.com,
    // domínio confiável, logo depois de uma tela de consentimento legítima.
    // RFC 6749 §3.1.2.4 é explícito: redirect_uri inválido NÃO redireciona.
    const oauthClient = await resolveOrRegisterClient(client_id);
    if (!oauthClient) {
      return res.status(400).send(buildErrorPage({ lang, error: 'unknownClient' }));
    }

    if (!isOob) {
      const uriMatch = oauthClient.redirectUris.some((stored) =>
        redirectUriMatches(redirect_uri, stored)
      );
      if (!uriMatch) {
        return res.status(400).send(buildErrorPage({ lang, error: 'badRedirect' }));
      }
    }

    if (action === 'deny') {
      if (isOob) {
        return res.send(buildDonePage({ lang, approved: false }));
      }
      const url = new URL(redirect_uri);
      url.searchParams.set('error', 'access_denied');
      if (state) url.searchParams.set('state', state);
      return res.redirect(url.toString());
    }

    // Re-verify user session: accept token from form body or Authorization header
    const tokenInBody = (req.body as Record<string, string>).token;
    const bearerInHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const rawToken = tokenInBody || bearerInHeader;
    let userId: string | null = null;
    if (rawToken) {
      try {
        const decoded = jwt.verify(rawToken, JWT_SECRET) as { userId?: string; sub?: string };
        userId = decoded.userId || decoded.sub || null;
      } catch {
        // fall through
      }
    }

    if (!userId) {
      return res.status(401).send(buildErrorPage({ lang, error: 'session' }));
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

    if (isOob) {
      return res.send(buildOobCodePage({ lang, code }));
    }

    const url = new URL(redirect_uri);
    url.searchParams.set('code', code);
    if (state) url.searchParams.set('state', state);
    return res.redirect(url.toString());
  } catch (err) {
    console.error('[OAuth] POST /oauth/authorize error', err);
    return res.status(500).send(buildErrorPage({ lang, error: 'server' }));
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

  if (grant_type === DEVICE_CODE_GRANT) {
    return handleDeviceCodeExchange(req, res);
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

    // Validate redirect_uri if provided (OOB is always accepted)
    if (redirect_uri && redirect_uri !== OOB_REDIRECT_URI) {
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

// ── Device Authorization Grant (RFC 8628) ─────────────────────────────────

router.post('/oauth/device/code', async (req, res) => {
  try {
    const { client_id, scope } = req.body as Record<string, string>;

    if (!client_id) {
      return res
        .status(400)
        .json({ error: 'invalid_request', error_description: 'client_id is required' });
    }

    const oauthClient = await resolveOrRegisterClient(client_id);
    if (!oauthClient) {
      return res.status(400).json({ error: 'invalid_client' });
    }

    const validScopes = new Set(MCP_SCOPES as readonly string[]);
    const requestedScopes = scope
      ? scope.split(/[\s+]+/).filter((s) => validScopes.has(s))
      : [...MCP_SCOPES];
    const resolvedScopes = requestedScopes.length > 0 ? requestedScopes : [...MCP_SCOPES];

    const deviceCode = crypto.randomBytes(32).toString('hex');
    const userCode = generateUserCode();
    const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_SECONDS * 1000);

    const col = await getDeviceCodesCollection();
    await col.insertOne({
      deviceCode,
      userCode,
      clientId: client_id,
      clientName: oauthClient.clientName,
      scopes: resolvedScopes,
      resource: MCP_RESOURCE,
      status: 'pending',
      userId: null,
      expiresAt,
      lastPolled: null,
      createdAt: new Date(),
    });

    return res.json({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: `${BASE_URL}/oauth/device`,
      verification_uri_complete: `${BASE_URL}/oauth/device?code=${userCode}`,
      expires_in: DEVICE_CODE_TTL_SECONDS,
      interval: DEVICE_POLL_INTERVAL,
    });
  } catch (err) {
    console.error('[OAuth] device/code error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/oauth/device', async (req, res) => {
  const lang = langFrom(req.headers['accept-language']);
  const prefillCode = (req.query.code as string) || '';
  const tokenParam = req.query.token as string | undefined;
  const bearerHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const rawToken = tokenParam || bearerHeader;

  let userId: string | null = null;
  if (rawToken) {
    try {
      const decoded = jwt.verify(rawToken, JWT_SECRET) as { userId?: string; sub?: string };
      userId = decoded.userId || decoded.sub || null;
    } catch {}
  }

  if (!userId) {
    return res.send(
      buildDeviceLoginPage({
        lang,
        apiBase: API_BASE_URL,
        prefillCode,
        googleFailed: req.query.login_error === 'google',
      })
    );
  }

  if (!prefillCode) {
    return res.send(
      buildDeviceCodeEntryPage({ lang, apiBase: API_BASE_URL, token: rawToken || '' })
    );
  }

  // User is logged in and has a code — verify and show consent
  try {
    const col = await getDeviceCodesCollection();
    const record = await col.findOne({ userCode: prefillCode.toUpperCase(), status: 'pending' });

    if (!record) {
      return res.send(
        buildErrorPage({
          lang,
          error: 'deviceInvalid',
          retryUrl: `${BASE_URL}/oauth/device?token=${encodeURIComponent(rawToken || '')}`,
        })
      );
    }

    if (new Date() > record.expiresAt) {
      return res.send(buildErrorPage({ lang, error: 'deviceExpired' }));
    }

    const accountEmail = await emailOf(userId);

    return res.send(
      buildDeviceConsentPage({
        lang,
        action: `${BASE_URL}/oauth/device`,
        accountEmail,
        clientName: record.clientName,
        userCode: record.userCode,
        scopes: record.scopes.join(' '),
        token: rawToken || '',
      })
    );
  } catch (err) {
    console.error('[OAuth] device page error', err);
    return res.status(500).send(buildErrorPage({ lang, error: 'server' }));
  }
});

router.post('/oauth/device', express.urlencoded({ extended: false }), async (req, res) => {
  const { user_code, action, token } = req.body as Record<string, string>;
  const lang = langFrom(req.headers['accept-language']);

  if (!user_code || !action) {
    return res.status(400).send(buildErrorPage({ lang, error: 'missing' }));
  }

  let userId: string | null = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; sub?: string };
      userId = decoded.userId || decoded.sub || null;
    } catch {}
  }

  if (!userId) {
    return res.status(401).send(
      buildErrorPage({
        lang,
        error: 'session',
        retryUrl: `${BASE_URL}/oauth/device?code=${encodeURIComponent(user_code)}`,
      })
    );
  }

  try {
    const col = await getDeviceCodesCollection();
    const record = await col.findOne({ userCode: user_code.toUpperCase(), status: 'pending' });

    if (!record || new Date() > record.expiresAt) {
      return res.send(buildErrorPage({ lang, error: 'deviceInvalid' }));
    }

    if (action === 'deny') {
      await col.updateOne({ userCode: user_code.toUpperCase() }, { $set: { status: 'denied' } });
      return res.send(buildDonePage({ lang, approved: false }));
    }

    await col.updateOne(
      { userCode: user_code.toUpperCase() },
      { $set: { status: 'approved', userId } }
    );

    return res.send(buildDonePage({ lang, approved: true }));
  } catch (err) {
    console.error('[OAuth] device approval error', err);
    return res.status(500).send(buildErrorPage({ lang, error: 'server' }));
  }
});

async function handleDeviceCodeExchange(req: express.Request, res: express.Response) {
  const { device_code, client_id } = req.body as Record<string, string>;

  if (!device_code || !client_id) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'device_code and client_id are required',
    });
  }

  try {
    const col = await getDeviceCodesCollection();
    const record = await col.findOne({ deviceCode: device_code });

    if (!record) {
      return res
        .status(400)
        .json({ error: 'invalid_grant', error_description: 'Unknown device code' });
    }

    if (new Date() > record.expiresAt) {
      return res.status(400).json({ error: 'expired_token' });
    }

    if (record.clientId !== client_id) {
      return res
        .status(400)
        .json({ error: 'invalid_grant', error_description: 'client_id mismatch' });
    }

    // Enforce polling interval (slow_down)
    if (record.lastPolled) {
      const elapsed = (Date.now() - new Date(record.lastPolled).getTime()) / 1000;
      if (elapsed < DEVICE_POLL_INTERVAL) {
        return res.status(400).json({ error: 'slow_down' });
      }
    }

    await col.updateOne({ deviceCode: device_code }, { $set: { lastPolled: new Date() } });

    if (record.status === 'pending') {
      return res.status(400).json({ error: 'authorization_pending' });
    }

    if (record.status === 'denied') {
      await col.deleteOne({ deviceCode: device_code });
      return res.status(400).json({ error: 'access_denied' });
    }

    // status === 'approved' — issue tokens
    const scopes = record.scopes.join(' ');
    const accessToken = issueAccessToken(record.userId, client_id, scopes, record.resource);

    const refreshToken = crypto.randomBytes(32).toString('hex');
    await prisma.oAuthRefreshToken.create({
      data: {
        token: refreshToken,
        userId: record.userId,
        clientId: client_id,
        scopes: record.scopes,
        resource: record.resource,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    // Clean up used device code
    await col.deleteOne({ deviceCode: device_code });

    return res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken,
      scope: scopes,
    });
  } catch (err) {
    console.error('[OAuth] device code exchange error', err);
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
cleanupExpiredOAuthData().catch((err) =>
  console.error('[OAuth] initial cleanup error:', err.message)
);

// ── Connected Apps (authorized OAuth grants) ─────────────────────────────────

router.get('/oauth/authorized-apps', async (req, res) => {
  let userId: string | null = null;

  // Internal MCP calls pass user ID directly
  const mcpUserId = req.headers['x-mcp-user-id'] as string | undefined;
  if (mcpUserId) {
    userId = mcpUserId;
  } else {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!bearer) return res.status(401).json({ error: 'unauthorized' });
    try {
      const decoded = jwt.verify(bearer, JWT_SECRET) as { userId?: string; sub?: string };
      userId = decoded.userId || decoded.sub || null;
    } catch {
      return res.status(401).json({ error: 'invalid_token' });
    }
  }
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  try {
    const tokens = await prisma.oAuthRefreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const clientIds = [...new Set(tokens.map((t) => t.clientId))];
    // select só do que a lista usa: clientes antigos têm updatedAt null na base,
    // e ler o documento inteiro estourava 500 na tela de apps conectados.
    const clients = await prisma.oAuthClient.findMany({
      where: { clientId: { in: clientIds } },
      select: { clientId: true, clientName: true },
    });
    const clientMap = new Map(clients.map((c) => [c.clientId, c]));

    const apps = tokens.map((t) => ({
      id: t.id,
      clientId: t.clientId,
      clientName: clientMap.get(t.clientId)?.clientName || t.clientId,
      scopes: t.scopes,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
    }));

    return res.json({ apps });
  } catch (err) {
    console.error('[OAuth] GET /oauth/authorized-apps error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.delete('/oauth/authorized-apps/:id', async (req, res) => {
  let userId: string | null = null;

  const mcpUserId = req.headers['x-mcp-user-id'] as string | undefined;
  if (mcpUserId) {
    userId = mcpUserId;
  } else {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!bearer) return res.status(401).json({ error: 'unauthorized' });
    try {
      const decoded = jwt.verify(bearer, JWT_SECRET) as { userId?: string; sub?: string };
      userId = decoded.userId || decoded.sub || null;
    } catch {
      return res.status(401).json({ error: 'invalid_token' });
    }
  }
  if (!userId) return res.status(401).json({ error: 'unauthorized' });

  const tokenId = req.params.id;
  if (!tokenId || !/^[a-f\d]{24}$/i.test(tokenId)) {
    return res.status(400).json({ error: 'invalid_id' });
  }

  try {
    const deleted = await prisma.oAuthRefreshToken.deleteMany({
      where: { id: tokenId, userId },
    });
    if (deleted.count === 0) return res.status(404).json({ error: 'not_found' });
    return res.json({ message: 'Access revoked' });
  } catch (err) {
    console.error('[OAuth] DELETE /oauth/authorized-apps error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
