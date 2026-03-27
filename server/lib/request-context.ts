/**
 * Request Context using AsyncLocalStorage
 *
 * Provides request-scoped context (userId, requestId) without global state.
 * Solves race conditions in concurrent requests (e.g., MCP server).
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';

export interface RequestContext {
  userId: string | null;
  userEmail?: string;
  requestId: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

// AsyncLocalStorage instance - single source of truth
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function within a request context.
 * All code within the callback (including async) has access to the context.
 */
export function runWithContext<T>(
  context: Partial<RequestContext>,
  fn: () => T
): T {
  const fullContext: RequestContext = {
    userId: context.userId ?? null,
    userEmail: context.userEmail,
    requestId: context.requestId ?? randomUUID(),
    startTime: context.startTime ?? Date.now(),
    metadata: context.metadata,
  };

  return asyncLocalStorage.run(fullContext, fn);
}

/**
 * Get the current request context.
 * Returns undefined if called outside of a request context.
 */
export function getContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get the current user ID from context.
 * Returns null if no user or outside of context.
 */
export function getCurrentUserId(): string | null {
  return asyncLocalStorage.getStore()?.userId ?? null;
}

/**
 * Get the current request ID.
 * Returns 'no-context' if called outside of a request context.
 */
export function getRequestId(): string {
  return asyncLocalStorage.getStore()?.requestId ?? 'no-context';
}

/**
 * Add metadata to the current context.
 */
export function addContextMetadata(key: string, value: unknown): void {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.metadata = store.metadata ?? {};
    store.metadata[key] = value;
  }
}

/**
 * Get elapsed time since request started (ms).
 */
export function getElapsedTime(): number {
  const store = asyncLocalStorage.getStore();
  if (!store) return 0;
  return Date.now() - store.startTime;
}

/**
 * Express middleware to wrap requests in context.
 */
export function contextMiddleware() {
  return (req: any, res: any, next: () => void) => {
    const context: Partial<RequestContext> = {
      userId: req.userId ?? null,
      userEmail: req.userEmail,
      requestId: req.headers['x-request-id'] as string ?? randomUUID(),
      startTime: Date.now(),
    };

    runWithContext(context, () => {
      // Set request ID header for tracing
      res.setHeader('x-request-id', context.requestId);
      next();
    });
  };
}
