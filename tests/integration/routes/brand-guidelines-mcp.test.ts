import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { createBrandGuideline } from '../../factories/brandGuideline.js';
import { JWT_SECRET } from '../../../server/utils/jwtSecret.js';
import { MCP_ENDPOINT } from '../../../server/lib/mcp-constants.js';

// Must be set BEFORE the app/lib is used — billing enforcement is behind the flag.
process.env.FEATURE_BRAND_BILLING = 'true';

async function setUserFields(userId: string, fields: Record<string, any>) {
  const { prisma } = await import('../../../server/db/prisma.js');
  await prisma.user.update({ where: { id: userId }, data: fields });
  // Mirror into Mongo — subscription/quota code reads the raw collection too.
  const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
  const { ObjectId } = await import('mongodb');
  await connectToMongoDB();
  const db = getDb();
  await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: fields });
}

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

// Validation errors come back as plain text (the SDK stringifies the ZodError
// before we ever see it), so they can't go through callTool's JSON.parse.
async function callToolRaw(token: string, name: string, args: Record<string, unknown>) {
  const agent = await request();
  const res = await agent
    .post('/api/mcp')
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', 'application/json')
    .set('Content-Type', 'application/json')
    .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  return {
    isError: res.body?.result?.isError === true,
    text: String(res.body?.result?.content?.[0]?.text ?? ''),
  };
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

// The `sections` param was inert for every default-format call: the preset
// resolved, then the handler returned the whole Prisma row anyway. Nothing
// asserted that a preset actually shrinks the payload, which is why it went
// unnoticed — so these assert the filtering, not just the plumbing.
describe('Brand Guidelines — MCP `sections` filtering (structured format)', () => {
  it('preset "copy" drops the visual sections instead of returning the full brand', async () => {
    const { user } = await createUser();
    const token = mintToken(user.id);
    const { guideline } = await createBrandGuideline({
      userId: user.id,
      name: 'Sections Probe Co.',
      logos: [{ id: 'l1', url: 'https://example.com/logo.png', variant: 'primary' }],
      media: [{ id: 'm1', url: 'https://example.com/shot.png', type: 'image' }],
    });

    const got = await callTool(token, 'brand-guidelines-get', {
      id: guideline.id,
      sections: 'copy',
    });

    // Asked for voice/strategy — must not pay for the visual payload.
    expect('colors' in got.parsed).toBe(false);
    expect('typography' in got.parsed).toBe(false);
    expect('logos' in got.parsed).toBe(false);
    expect('media' in got.parsed).toBe(false);

    // "copy" = identity + voice + strategy, so identity survives.
    expect(got.parsed.identity?.name).toBe('Sections Probe Co.');

    // The agent needs to see which filter actually landed.
    expect(got.parsed.sections).toEqual(['identity', 'voice', 'strategy']);
  });

  it('an explicit array keeps only what it names', async () => {
    const { user } = await createUser();
    const token = mintToken(user.id);
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Array Probe Co.' });

    const got = await callTool(token, 'brand-guidelines-get', {
      id: guideline.id,
      sections: ['colors'],
    });

    expect(Array.isArray(got.parsed.colors)).toBe(true);
    expect('typography' in got.parsed).toBe(false);
    expect('identity' in got.parsed).toBe(false); // identity is a section like any other
    expect(got.parsed.id).toBe(guideline.id); // metadata is never section-filtered
  });

  it('omitting sections still returns the full brand (no silent narrowing)', async () => {
    const { user } = await createUser();
    const token = mintToken(user.id);
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Full Probe Co.' });

    const got = await callTool(token, 'brand-guidelines-get', { id: guideline.id });

    expect(got.parsed.identity?.name).toBe('Full Probe Co.');
    expect(Array.isArray(got.parsed.colors)).toBe(true);
    expect(Array.isArray(got.parsed.typography)).toBe(true);
    expect('sections' in got.parsed).toBe(false); // nothing was filtered, so nothing to echo
  });

  it('a bad sections value explains the contract instead of dumping the union', async () => {
    const { user } = await createUser();
    const token = mintToken(user.id);
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Zod Probe Co.' });

    const res = await callToolRaw(token, 'brand-guidelines-get', {
      id: guideline.id,
      sections: 'kopy', // typo'd preset
    });

    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/sections takes either an array of sections/);
    expect(res.text).toMatch(/visual, copy, minimal, imageGen, full/);

    // The point isn't the nice sentence — it's that the union dump is gone.
    // A z.union rejection lists every arm's errors (~850 chars), which is what
    // burned a turn in the first place.
    expect(res.text).not.toMatch(/invalid_union/);
    expect(res.text.length).toBeLessThan(500);
  });

  // The SDK validates upstream of the handler wrapper that does the tracking,
  // so rejected input used to leave no trace at all — the one failure mode that
  // reliably costs an agent a turn was the one we couldn't see.
  it('records the rejection in telemetry (it used to vanish)', async () => {
    const { user } = await createUser();
    const token = mintToken(user.id);
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Telemetry Probe' });

    // Connect before the call — tracking no-ops when Mongo isn't up yet.
    const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
    await connectToMongoDB();
    const calls = getDb().collection('mcp_tool_calls');

    await callToolRaw(token, 'brand-guidelines-get', { id: guideline.id, sections: 'kopy' });

    // trackMcpToolCall is fire-and-forget, so give the insert a moment to land.
    let doc: any = null;
    for (let i = 0; i < 20 && !doc; i++) {
      doc = await calls.findOne({ toolName: 'brand-guidelines-get', errorKind: 'validation' });
      if (!doc) await new Promise((r) => setTimeout(r, 50));
    }

    expect(doc).toBeTruthy();
    expect(doc.success).toBe(false);
    expect(doc.scope).toBe('read');
    expect(doc.userId).toBe(user.id);
  });
});

describe('Brand Guidelines — MCP list pagination + search', () => {
  it('paginates instead of dumping every brand', async () => {
    const { user } = await createUser();
    const token = mintToken(user.id);
    for (const name of ['Brand A', 'Brand B', 'Brand C']) {
      await createBrandGuideline({ userId: user.id, name });
    }

    const page = await callTool(token, 'brand-guidelines-list', { limit: 2, skip: 0 });

    expect(page.parsed.guidelines).toHaveLength(2);
    expect(page.parsed.total).toBe(3); // real count, not the array length
    expect(page.parsed.page).toEqual({ limit: 2, skip: 0, hasMore: true });

    const last = await callTool(token, 'brand-guidelines-list', { limit: 2, skip: 2 });
    expect(last.parsed.guidelines).toHaveLength(1);
    expect(last.parsed.page.hasMore).toBe(false);
  });

  it('finds a brand by name without reading the whole list', async () => {
    const { user } = await createUser();
    const token = mintToken(user.id);
    await createBrandGuideline({ userId: user.id, name: 'Urban Stay' });
    await createBrandGuideline({ userId: user.id, name: 'Rural Inn' });

    const found = await callTool(token, 'brand-guidelines-list', { search: 'urban' }); // case-insensitive

    expect(found.parsed.total).toBe(1);
    expect(found.parsed.guidelines).toHaveLength(1);
    expect(found.parsed.guidelines[0].identity.name).toBe('Urban Stay');
  });

  it('pages the filtered set, not the unfiltered one', async () => {
    const { user } = await createUser();
    const token = mintToken(user.id);
    await createBrandGuideline({ userId: user.id, name: 'Urban Stay' });
    await createBrandGuideline({ userId: user.id, name: 'Rural Inn' });
    await createBrandGuideline({ userId: user.id, name: 'Urban Loft' });

    const page = await callTool(token, 'brand-guidelines-list', {
      search: 'urban',
      limit: 1,
      skip: 1,
    });

    // Would return 0 rows if skip were applied before the name filter.
    expect(page.parsed.total).toBe(2);
    expect(page.parsed.guidelines).toHaveLength(1);
    expect(page.parsed.guidelines[0].identity.name).toMatch(/^Urban /);
  });
});

describe('Brand Guidelines — MCP transport money gates (billing bypass fix)', () => {
  it('brand-guidelines-create is gated by the brand quota (free limit 1) — same as the REST route', async () => {
    const { user } = await createUser();
    const token = mintToken(user.id);

    const first = await callTool(token, 'brand-guidelines-create', {
      identity: { name: 'MCP Gate Co. #1' },
    });
    expect(first.parsed?.guideline?.id).toBeTruthy();

    const second = await callTool(token, 'brand-guidelines-create', {
      identity: { name: 'MCP Gate Co. #2' },
    });
    expect(second.parsed?.error?.code).toBe('PAYMENT_REQUIRED');
    expect(second.parsed?.error?.reason).toBe('brand_limit');
    expect(second.parsed?.error?.max).toBe(1);
    expect(second.parsed?.error?.used).toBe(1);
  });

  it('brand-guidelines-invite (role=editor) is gated by the seat quota (free = 0 seats)', async () => {
    const { user } = await createUser();
    const token = mintToken(user.id);
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'MCP Seat Brand' });

    const editorInvite = await callTool(token, 'brand-guidelines-invite', {
      id: guideline.id,
      role: 'editor',
    });
    expect(editorInvite.parsed?.error?.code).toBe('PAYMENT_REQUIRED');
    expect(editorInvite.parsed?.error?.reason).toBe('seat_limit');
    expect(editorInvite.parsed?.error?.max).toBe(0);

    // Viewer invites are never gated by seats.
    const viewerInvite = await callTool(token, 'brand-guidelines-invite', {
      id: guideline.id,
      role: 'viewer',
    });
    expect(viewerInvite.parsed?.connectUrl).toBeTruthy();
  });

  it('premium owner (1 seat): first editor invite via MCP OK, second blocked', async () => {
    const { user } = await createUser();
    await setUserFields(user.id, { subscriptionStatus: 'active', subscriptionTier: 'premium' });
    const token = mintToken(user.id);
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'MCP Premium Seat' });

    const first = await callTool(token, 'brand-guidelines-invite', {
      id: guideline.id,
      role: 'editor',
    });
    expect(first.parsed?.connectUrl).toBeTruthy();

    const second = await callTool(token, 'brand-guidelines-invite', {
      id: guideline.id,
      role: 'editor',
    });
    expect(second.parsed?.error?.code).toBe('PAYMENT_REQUIRED');
    expect(second.parsed?.error?.reason).toBe('seat_limit');
    expect(second.parsed?.error?.max).toBe(1);
    expect(second.parsed?.error?.used).toBe(1);
  });
});
