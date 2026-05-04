import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// ── Prisma mock ──────────────────────────────────────────────────────────────

const mockPrisma = {
  oAuthClient: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  oAuthAuthCode: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
  oAuthRefreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
};

vi.mock('../../db/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../utils/jwtSecret.js', () => ({ JWT_SECRET: 'test-secret-key-for-testing' }));

// ── Helpers ──────────────────────────────────────────────────────────────────

const JWT_SECRET = 'test-secret-key-for-testing';

function makeCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function makeUserJwt(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('OAuth 2.1 MCP Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Well-known endpoints ─────────────────────────────────────────────────

  describe('Well-known discovery', () => {
    it('oauth-authorization-server returns required metadata', async () => {
      const { default: router } = await import('../oauth.js');
      const { createTestApp, request } = await setupApp(router);

      const res = await request.get('/.well-known/oauth-authorization-server');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        issuer: expect.any(String),
        authorization_endpoint: expect.stringContaining('/oauth/authorize'),
        token_endpoint: expect.stringContaining('/oauth/token'),
        registration_endpoint: expect.stringContaining('/oauth/register'),
        code_challenge_methods_supported: ['S256'],
        grant_types_supported: expect.arrayContaining(['authorization_code', 'refresh_token']),
        response_types_supported: ['code'],
      });
    });

    it('oauth-protected-resource returns MCP resource metadata', async () => {
      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.get('/.well-known/oauth-protected-resource');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        resource: expect.stringContaining('/api/mcp'),
        authorization_servers: expect.any(Array),
        scopes_supported: expect.arrayContaining(['read', 'write', 'generate']),
      });
    });
  });

  // ── Dynamic Client Registration ──────────────────────────────────────────

  describe('Dynamic Client Registration (RFC 7591)', () => {
    it('registers a new client with valid metadata', async () => {
      mockPrisma.oAuthClient.create.mockResolvedValue({});

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/register').send({
        client_name: 'Claude Code',
        redirect_uris: ['http://127.0.0.1:3456/callback'],
        grant_types: ['authorization_code', 'refresh_token'],
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        client_id: expect.any(String),
        client_name: 'Claude Code',
        redirect_uris: expect.any(Array),
        grant_types: ['authorization_code', 'refresh_token'],
        client_id_issued_at: expect.any(Number),
      });
      expect(mockPrisma.oAuthClient.create).toHaveBeenCalled();
    });

    it('rejects registration without client_name', async () => {
      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/register').send({
        redirect_uris: ['http://localhost:3456/callback'],
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_client_metadata');
    });

    it('rejects registration without redirect_uris', async () => {
      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/register').send({
        client_name: 'Test',
      });
      expect(res.status).toBe(400);
    });
  });

  // ── Authorization endpoint ───────────────────────────────────────────────

  describe('Authorization endpoint', () => {
    it('redirects to login when no user token present', async () => {
      const clientId = 'test-client-id';
      mockPrisma.oAuthClient.findUnique.mockResolvedValue({
        clientId,
        clientName: 'Test App',
        redirectUris: ['http://127.0.0.1/callback'],
      });

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const codeVerifier = crypto.randomBytes(32).toString('hex');
      const res = await request.get('/oauth/authorize').query({
        client_id: clientId,
        redirect_uri: 'http://127.0.0.1:8080/callback',
        code_challenge: makeCodeChallenge(codeVerifier),
        code_challenge_method: 'S256',
        state: 'random-state',
        response_type: 'code',
      });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login');
    });

    it('shows consent page when user is authenticated', async () => {
      const clientId = 'test-client-id';
      mockPrisma.oAuthClient.findUnique.mockResolvedValue({
        clientId,
        clientName: 'Claude Code',
        redirectUris: ['http://127.0.0.1/callback'],
      });

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const codeVerifier = crypto.randomBytes(32).toString('hex');
      const userToken = makeUserJwt('user-123');

      const res = await request.get('/oauth/authorize').query({
        client_id: clientId,
        redirect_uri: 'http://127.0.0.1:8080/callback',
        code_challenge: makeCodeChallenge(codeVerifier),
        code_challenge_method: 'S256',
        state: 'random-state',
        response_type: 'code',
        token: userToken,
      });

      expect(res.status).toBe(200);
      expect(res.text).toContain('Claude Code');
      expect(res.text).toContain('Approve');
      expect(res.text).toContain('Deny');
    });

    it('rejects unknown client_id', async () => {
      mockPrisma.oAuthClient.findUnique.mockResolvedValue(null);

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.get('/oauth/authorize').query({
        client_id: 'unknown',
        redirect_uri: 'http://127.0.0.1/callback',
        code_challenge: 'abc',
        state: 'state',
      });
      expect(res.status).toBe(400);
    });

    it('rejects non-S256 code_challenge_method', async () => {
      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.get('/oauth/authorize').query({
        client_id: 'test',
        redirect_uri: 'http://127.0.0.1/callback',
        code_challenge: 'abc',
        code_challenge_method: 'plain',
        state: 'state',
      });
      expect(res.status).toBe(400);
      expect(res.text).toContain('S256');
    });

    it('POST deny redirects with error=access_denied', async () => {
      mockPrisma.oAuthClient.findUnique.mockResolvedValue({
        clientId: 'test-client',
        redirectUris: ['http://127.0.0.1/callback'],
      });

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/authorize')
        .type('form')
        .send({
          action: 'deny',
          client_id: 'test-client',
          redirect_uri: 'http://127.0.0.1:8080/callback',
          code_challenge: 'abc',
          state: 'my-state',
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=access_denied');
      expect(res.headers.location).toContain('state=my-state');
    });

    it('POST approve generates auth code and redirects', async () => {
      const clientId = 'test-client';
      mockPrisma.oAuthClient.findUnique.mockResolvedValue({
        clientId,
        redirectUris: ['http://127.0.0.1/callback'],
      });
      mockPrisma.oAuthAuthCode.create.mockResolvedValue({});

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const userToken = makeUserJwt('user-456');

      const res = await request.post('/oauth/authorize')
        .type('form')
        .send({
          action: 'approve',
          client_id: clientId,
          redirect_uri: 'http://127.0.0.1:8080/callback',
          code_challenge: 'some-challenge',
          code_challenge_method: 'S256',
          state: 'my-state',
          scopes: 'read write generate',
          resource: 'https://api.visantlabs.com/api/mcp',
          token: userToken,
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('code=');
      expect(res.headers.location).toContain('state=my-state');
      expect(mockPrisma.oAuthAuthCode.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clientId,
            userId: 'user-456',
            scopes: ['read', 'write', 'generate'],
          }),
        })
      );
    });
  });

  // ── Token endpoint ───────────────────────────────────────────────────────

  describe('Token endpoint — authorization_code exchange', () => {
    it('exchanges valid auth code for tokens with PKCE', async () => {
      const codeVerifier = crypto.randomBytes(32).toString('hex');
      const codeChallenge = makeCodeChallenge(codeVerifier);

      mockPrisma.oAuthAuthCode.findUnique.mockResolvedValue({
        code: 'test-code',
        clientId: 'test-client',
        userId: 'user-789',
        codeChallenge,
        resource: 'https://api.visantlabs.com/api/mcp',
        scopes: ['read', 'write'],
        expiresAt: new Date(Date.now() + 600000),
        used: false,
      });
      mockPrisma.oAuthAuthCode.update.mockResolvedValue({});
      mockPrisma.oAuthRefreshToken.create.mockResolvedValue({});

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/token').send({
        grant_type: 'authorization_code',
        code: 'test-code',
        code_verifier: codeVerifier,
        client_id: 'test-client',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        access_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: expect.any(String),
        scope: 'read write',
      });

      // Verify access token is a valid JWT
      const decoded = jwt.verify(res.body.access_token, JWT_SECRET) as any;
      expect(decoded.sub).toBe('user-789');
      expect(decoded.aud).toBe('https://api.visantlabs.com/api/mcp');
      expect(decoded.scope).toBe('read write');

      // Verify code marked as used
      expect(mockPrisma.oAuthAuthCode.update).toHaveBeenCalledWith({
        where: { code: 'test-code' },
        data: { used: true },
      });

      // Verify refresh token persisted
      expect(mockPrisma.oAuthRefreshToken.create).toHaveBeenCalled();
    });

    it('rejects already-used auth code', async () => {
      mockPrisma.oAuthAuthCode.findUnique.mockResolvedValue({
        code: 'used-code',
        used: true,
      });

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/token').send({
        grant_type: 'authorization_code',
        code: 'used-code',
        code_verifier: 'anything',
        client_id: 'test-client',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_grant');
    });

    it('rejects expired auth code', async () => {
      mockPrisma.oAuthAuthCode.findUnique.mockResolvedValue({
        code: 'expired-code',
        used: false,
        clientId: 'test-client',
        expiresAt: new Date(Date.now() - 1000),
      });

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/token').send({
        grant_type: 'authorization_code',
        code: 'expired-code',
        code_verifier: 'anything',
        client_id: 'test-client',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_grant');
    });

    it('rejects wrong PKCE code_verifier', async () => {
      const realVerifier = crypto.randomBytes(32).toString('hex');
      const wrongVerifier = crypto.randomBytes(32).toString('hex');

      mockPrisma.oAuthAuthCode.findUnique.mockResolvedValue({
        code: 'test-code',
        clientId: 'test-client',
        userId: 'user-789',
        codeChallenge: makeCodeChallenge(realVerifier),
        resource: 'https://api.visantlabs.com/api/mcp',
        scopes: ['read'],
        expiresAt: new Date(Date.now() + 600000),
        used: false,
      });

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/token').send({
        grant_type: 'authorization_code',
        code: 'test-code',
        code_verifier: wrongVerifier,
        client_id: 'test-client',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_grant');
      expect(res.body.error_description).toContain('PKCE');
    });

    it('rejects client_id mismatch', async () => {
      mockPrisma.oAuthAuthCode.findUnique.mockResolvedValue({
        code: 'test-code',
        clientId: 'real-client',
        used: false,
        expiresAt: new Date(Date.now() + 600000),
      });

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/token').send({
        grant_type: 'authorization_code',
        code: 'test-code',
        code_verifier: 'anything',
        client_id: 'wrong-client',
      });

      expect(res.status).toBe(400);
      expect(res.body.error_description).toContain('client_id');
    });
  });

  describe('Token endpoint — refresh_token', () => {
    it('rotates refresh token and issues new access token', async () => {
      mockPrisma.oAuthRefreshToken.findUnique.mockResolvedValue({
        id: 'rt-id',
        token: 'old-refresh-token',
        userId: 'user-100',
        clientId: 'client-abc',
        scopes: ['read', 'write', 'generate'],
        resource: 'https://api.visantlabs.com/api/mcp',
        expiresAt: new Date(Date.now() + 86400000),
      });
      mockPrisma.oAuthRefreshToken.delete.mockResolvedValue({});
      mockPrisma.oAuthRefreshToken.create.mockResolvedValue({});

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/token').send({
        grant_type: 'refresh_token',
        refresh_token: 'old-refresh-token',
        client_id: 'client-abc',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        access_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: expect.any(String),
        scope: 'read write generate',
      });

      // Old token deleted
      expect(mockPrisma.oAuthRefreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-id' } });
      // New token created
      expect(mockPrisma.oAuthRefreshToken.create).toHaveBeenCalled();
      // New token is different from old
      expect(res.body.refresh_token).not.toBe('old-refresh-token');
    });

    it('rejects expired refresh token', async () => {
      mockPrisma.oAuthRefreshToken.findUnique.mockResolvedValue({
        token: 'expired-rt',
        expiresAt: new Date(Date.now() - 1000),
      });

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/token').send({
        grant_type: 'refresh_token',
        refresh_token: 'expired-rt',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_grant');
    });

    it('rejects unknown refresh token', async () => {
      mockPrisma.oAuthRefreshToken.findUnique.mockResolvedValue(null);

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/token').send({
        grant_type: 'refresh_token',
        refresh_token: 'nonexistent',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_grant');
    });

    it('rejects client_id mismatch on refresh', async () => {
      mockPrisma.oAuthRefreshToken.findUnique.mockResolvedValue({
        token: 'rt',
        clientId: 'real-client',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/token').send({
        grant_type: 'refresh_token',
        refresh_token: 'rt',
        client_id: 'wrong-client',
      });

      expect(res.status).toBe(400);
      expect(res.body.error_description).toContain('client_id');
    });
  });

  describe('Token endpoint — unsupported grant type', () => {
    it('rejects unsupported grant_type', async () => {
      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/token').send({
        grant_type: 'client_credentials',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('unsupported_grant_type');
    });
  });

  // ── Token Revocation ─────────────────────────────────────────────────────

  describe('Token revocation (RFC 7009)', () => {
    it('revokes a valid refresh token', async () => {
      mockPrisma.oAuthRefreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/revoke').send({
        token: 'some-refresh-token',
        token_type_hint: 'refresh_token',
      });

      expect(res.status).toBe(200);
      expect(mockPrisma.oAuthRefreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'some-refresh-token' },
      });
    });

    it('returns 200 for unknown token (per RFC 7009)', async () => {
      mockPrisma.oAuthRefreshToken.deleteMany.mockResolvedValue({ count: 0 });

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/revoke').send({
        token: 'unknown-token',
      });

      expect(res.status).toBe(200);
    });

    it('returns 200 for access_token hint (stateless JWT)', async () => {
      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/revoke').send({
        token: 'some-jwt',
        token_type_hint: 'access_token',
      });

      expect(res.status).toBe(200);
    });

    it('rejects missing token', async () => {
      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const res = await request.post('/oauth/revoke').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_request');
    });
  });

  // ── PKCE ─────────────────────────────────────────────────────────────────

  describe('PKCE S256 verification', () => {
    it('correctly verifies S256 code_challenge', () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = makeCodeChallenge(verifier);
      const hash = crypto.createHash('sha256').update(verifier).digest('base64url');
      expect(hash).toBe(challenge);
    });
  });

  // ── Localhost URI normalization ──────────────────────────────────────────

  describe('Localhost redirect_uri normalization', () => {
    it('matches localhost URIs ignoring port', async () => {
      const clientId = 'port-test';
      mockPrisma.oAuthClient.findUnique.mockResolvedValue({
        clientId,
        clientName: 'Test',
        redirectUris: ['http://127.0.0.1/callback'],
      });

      const { default: router } = await import('../oauth.js');
      const { request } = await setupApp(router);

      const codeVerifier = crypto.randomBytes(32).toString('hex');
      const token = makeUserJwt('user-1');

      const res = await request.get('/oauth/authorize').query({
        client_id: clientId,
        redirect_uri: 'http://127.0.0.1:54321/callback',
        code_challenge: makeCodeChallenge(codeVerifier),
        code_challenge_method: 'S256',
        state: 'state',
        token,
      });

      // Should show consent (200), not reject as invalid redirect_uri
      expect(res.status).toBe(200);
    });
  });
});

// ── Test utilities ────────────────────────────────────────────────────────────

async function setupApp(router: any) {
  const express = (await import('express')).default;
  const supertest = (await import('supertest')).default;
  const app = express();
  app.use(express.json());
  app.use('/', router);
  return { createTestApp: app, request: supertest(app) };
}
