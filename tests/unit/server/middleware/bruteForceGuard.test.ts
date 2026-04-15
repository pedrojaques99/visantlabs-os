import { describe, it, expect, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { bruteForceGuard, _resetBruteForceStore } from '../../../../server/middleware/bruteForceGuard.js';

function run(mw: any, { ip, email, status }: { ip: string; email: string; status: number }) {
  return new Promise<{ blocked: boolean; retryAfter?: number }>((resolve) => {
    const listeners: Record<string, Function[]> = {};
    const res: any = {
      statusCode: status,
      headers: {} as Record<string, string>,
      setHeader(k: string, v: string) {
        this.headers[k] = v;
      },
      status(code: number) {
        res._rejectStatus = code;
        return res;
      },
      json() {
        resolve({ blocked: true, retryAfter: Number(this.headers['Retry-After']) });
        return res;
      },
      once(event: string, cb: Function) {
        listeners[event] = listeners[event] ?? [];
        listeners[event].push(cb);
      },
      on(event: string, cb: Function) {
        this.once(event, cb);
      },
      _fire() {
        (listeners.finish ?? []).forEach((cb) => cb());
      },
    };
    const req: any = { ip, body: { email }, socket: {} };
    const next: NextFunction = () => {
      res._fire();
      resolve({ blocked: false });
    };
    mw(req as Request, res as Response, next);
  });
}

describe('bruteForceGuard', () => {
  beforeEach(() => _resetBruteForceStore());

  it('allows the first 3 failures without blocking', async () => {
    const mw = bruteForceGuard((r) => r.body?.email);
    for (let i = 0; i < 3; i++) {
      const r = await run(mw, { ip: '1.1.1.1', email: 'a@b.c', status: 401 });
      expect(r.blocked).toBe(false);
    }
  });

  it('blocks after exceeding free attempts, with exponential Retry-After', async () => {
    const mw = bruteForceGuard((r) => r.body?.email);
    for (let i = 0; i < 4; i++) await run(mw, { ip: '1.1.1.1', email: 'a@b.c', status: 401 });

    const res = await run(mw, { ip: '1.1.1.1', email: 'a@b.c', status: 401 });
    expect(res.blocked).toBe(true);
    expect(res.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it('segregates state per (ip, email)', async () => {
    const mw = bruteForceGuard((r) => r.body?.email);
    for (let i = 0; i < 10; i++) await run(mw, { ip: '1.1.1.1', email: 'a@b.c', status: 401 });

    // Different email on same IP → still free
    const other = await run(mw, { ip: '1.1.1.1', email: 'x@y.z', status: 401 });
    expect(other.blocked).toBe(false);
  });

  it('resets on successful response (200)', async () => {
    const mw = bruteForceGuard((r) => r.body?.email);
    for (let i = 0; i < 3; i++) await run(mw, { ip: '1.1.1.1', email: 'a@b.c', status: 401 });
    await run(mw, { ip: '1.1.1.1', email: 'a@b.c', status: 200 }); // success clears

    const r = await run(mw, { ip: '1.1.1.1', email: 'a@b.c', status: 401 });
    expect(r.blocked).toBe(false);
  });
});
