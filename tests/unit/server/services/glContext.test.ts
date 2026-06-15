/**
 * glContext — unit tests for the shared singleton GL context + serialized access
 * (Part B: GL context reuse).
 *
 * headless-gl ('gl') is a native module not present in CI, so we mock it with a
 * minimal fake WebGL context. We assert:
 *   - the singleton context is REUSED across acquires (compiled-program cache
 *     survives → real cache hits),
 *   - the drawing buffer is resized per acquire via STACKGL_resize_drawingbuffer,
 *   - concurrent acquires SERIALIZE (the 2nd waits for the 1st to release —
 *     WebGL state on one context must never interleave),
 *   - markBroken() tears the context down so the next acquire rebuilds it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Fake headless-gl ─────────────────────────────────────────────────────────
let createdContexts = 0;
const resizeCalls: Array<[number, number]> = [];

function makeFakeGL() {
  createdContexts += 1;
  const resizeExt = {
    resize: (w: number, h: number) => {
      resizeCalls.push([w, h]);
    },
  };
  const destroyExt = { destroy: vi.fn() };
  return {
    __id: createdContexts,
    getExtension: (name: string) => {
      if (name === 'STACKGL_resize_drawingbuffer') return resizeExt;
      if (name === 'STACKGL_destroy_context') return destroyExt;
      return null;
    },
    getError: () => 0,
    CONTEXT_LOST_WEBGL: 0x9242,
  } as any;
}

const glFactory = vi.fn((_w: number, _h: number, _opts?: any) => makeFakeGL());

vi.mock('gl', () => ({ default: glFactory }));

const { acquireSharedContext, invalidateSharedContext } =
  await import('../../../../server/services/imageLab/glContext.js');

describe('glContext — shared singleton + serialization', () => {
  beforeEach(() => {
    createdContexts = 0;
    resizeCalls.length = 0;
    glFactory.mockClear();
    invalidateSharedContext(); // ensure a clean singleton between tests
    // invalidate disposes whatever exists; reset counters AFTER so the dispose
    // of a previous test's context isn't counted here.
    createdContexts = 0;
    glFactory.mockClear();
  });

  it('reuses ONE underlying context across sequential acquires', async () => {
    const a = await acquireSharedContext(100, 100);
    expect(a).not.toBeNull();
    const glA = a!.gl;
    a!.release();

    const b = await acquireSharedContext(200, 150);
    expect(b).not.toBeNull();
    const glB = b!.gl;
    b!.release();

    expect(glA).toBe(glB); // same singleton object
    expect(glFactory).toHaveBeenCalledTimes(1); // context built once, reused
  });

  it('resizes the drawing buffer per acquire', async () => {
    const a = await acquireSharedContext(64, 48);
    a!.release();
    const b = await acquireSharedContext(128, 96);
    b!.release();

    // First acquire builds at 64x48; second resizes to 128x96.
    expect(resizeCalls).toContainEqual([128, 96]);
  });

  it('serializes concurrent acquires (2nd waits for 1st release)', async () => {
    const order: string[] = [];

    const firstCtx = await acquireSharedContext(10, 10);
    order.push('first-acquired');

    // Kick off a second acquire WITHOUT awaiting — it must block on the mutex.
    let secondResolved = false;
    const secondPromise = acquireSharedContext(20, 20).then((ctx) => {
      secondResolved = true;
      order.push('second-acquired');
      return ctx!;
    });

    // Give the event loop a few ticks; the second must NOT have acquired yet.
    await new Promise((r) => setTimeout(r, 20));
    expect(secondResolved).toBe(false);

    // Release the first → the second can proceed.
    order.push('first-released');
    firstCtx!.release();

    const secondCtx = await secondPromise;
    secondCtx.release();

    expect(secondResolved).toBe(true);
    expect(order).toEqual(['first-acquired', 'first-released', 'second-acquired']);
    // Still the same single context — never two live at once.
    expect(glFactory).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the singleton after markBroken()', async () => {
    const a = await acquireSharedContext(32, 32);
    const glA = a!.gl;
    a!.markBroken();
    a!.release(); // broken → dispose under the lock

    const b = await acquireSharedContext(32, 32);
    const glB = b!.gl;
    b!.release();

    expect(glA).not.toBe(glB); // fresh context after a broken render
    expect(glFactory).toHaveBeenCalledTimes(2);
  });
});
