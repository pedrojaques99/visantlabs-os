import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { withRequestId } from '../lib/logger.js';
import type { Logger } from 'pino';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation ID — echoed in X-Request-Id response header. */
      reqId: string;
      /** Request-scoped Pino child logger. Bound to reqId automatically. */
      log: Logger;
    }
  }
}

/**
 * Assign a correlation ID per request and bind a child logger to it.
 *
 * Accepts inbound `X-Request-Id` from trusted upstreams (Vercel edge, CF) so
 * traces can span the full edge→origin→downstream chain. Generates a UUID
 * otherwise.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.headers['x-request-id'];
  const reqId = typeof inbound === 'string' && inbound.length > 0 && inbound.length <= 128 ? inbound : randomUUID();

  req.reqId = reqId;
  req.log = withRequestId(reqId);
  res.setHeader('X-Request-Id', reqId);

  if (process.env.NODE_ENV !== 'production') {
    req.log.debug({ method: req.method, url: req.originalUrl }, 'request.start');
    res.on('finish', () => {
      req.log.debug({ status: res.statusCode }, 'request.finish');
    });
  }

  next();
}
