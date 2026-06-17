import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { JWT_SECRET } from '../../../server/utils/jwtSecret.js';
import { MCP_ENDPOINT } from '../../../server/lib/mcp-constants.js';

// Exercises the REAL MCP transport (/api/mcp JSON-RPC) for the prisma-direct
// brand tools, proving the platform-mcp.ts reshaping that unit/route tests
// don't touch: nextSteps on create, the slim _meta footprint, stripNullish,
// and the export userId-leak fix — through the actual transport, not a stub.
//
// Notes on the harness:
//  - The transport is stateless, so each request is a single tools/call.
//  - The DB is truncated between `it` blocks, so the create→get→export journey
//    runs inside ONE test to keep the same brand alive.
//  - `_meta` may be null here (no Mongo-backed quota in the test env). The fix
//    under test is the *shape*: it must never carry the storage/formatted blob.

function mintToken(userId: string): string {
  return jwt.sign({ sub: userId, aud: MCP_ENDPOINT, scope: 'read write generate' }, JWT_SECRET, {
    expiresIn: '5m',
  });
}

async function callTool(token: string, name: string, args: Record<string, unknown>) {
  const agent = await request();
  const res = await agent
    .post('/api/mcp')
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  const text = res.body?.result?.content?.[0]?.text;
  return { status: res.status, parsed: text ? JSON.parse(text) : undefined };
}

const slimOk = (meta: any) =>
  meta === null ||
  meta === undefined ||
  (!('storage' in meta) && !('formatted' in meta) && !('reset_date' in meta));

describe('Brand Guidelines — MCP transport (/api/mcp)', () => {
  let token: string;

  beforeAll(async () => {
    const { user } = await createUser();
    token = mintToken(user.id);
  });

  it('rejects unauthenticated calls', async () => {
    const agent = await request();
    const res = await agent
      .post('/api/mcp')
      .set('Accept', 'application/json')
      .send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    expect(res.status).toBe(401);
  });

  it('create → get → export journey applies all MCP-layer fixes', async () => {
    // CREATE — P6 nextSteps/viewUrl + P3 slim _meta shape
    const created = await callTool(token, 'brand-guidelines-create', {
      identity: { name: 'MCP Probe Co.' },
    });
    expect(created.parsed?.guideline?.id).toBeTruthy();
    const brandId = created.parsed.guideline.id;
    expect(Array.isArray(created.parsed.nextSteps)).toBe(true);
    expect(created.parsed.nextSteps.join(' ')).toMatch(/ingest/);
    expect(created.parsed.viewUrl).toContain(brandId);
    expect(slimOk(created.parsed._meta)).toBe(true); // P3 — no storage/formatted blob

    // GET — P4 no null-soup + P3 slim _meta
    const got = await callTool(token, 'brand-guidelines-get', { id: brandId });
    expect(got.parsed.identity?.name).toBe('MCP Probe Co.');
    expect('logos' in got.parsed).toBe(false); // unset section absent, not null
    expect('motion' in got.parsed).toBe(false);
    expect('gradients' in got.parsed).toBe(false);
    expect(slimOk(got.parsed._meta)).toBe(true);

    // EXPORT — R1/security: no userId or internal runtime fields
    const exported = await callTool(token, 'brand-guidelines-export', { id: brandId });
    expect(exported.parsed.identity?.name).toBe('MCP Probe Co.');
    expect('userId' in exported.parsed).toBe(false);
    expect('publicViews' in exported.parsed).toBe(false);
    expect('lastViewedAt' in exported.parsed).toBe(false);
  });
});
