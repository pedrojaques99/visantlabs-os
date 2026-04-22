/**
 * Shared chat execution utilities — used by adminChat and plugin routes.
 */

/** One retry on timeout/5xx/429/ECONNRESET errors, 2s backoff. */
export async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    if (!/timeout|503|429|ECONNRESET/i.test(e.message || '')) throw e;
    console.warn(`[Chat] Retrying ${label}:`, e.message);
    await new Promise(r => setTimeout(r, 2000));
    return fn();
  }
}
