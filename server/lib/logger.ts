import pino, { type Logger } from 'pino';
import { env } from '../config/env.js';

/**
 * Structured JSON logger with PII redaction and correlation-ID support.
 *
 * Why Pino: fastest JSON logger on Node, first-class redaction, tiny footprint.
 *
 * Migration path from console.log:
 *   console.log('User', email)             → logger.info({ email }, 'user lookup')
 *   console.error('Boom', err)             → logger.error({ err }, 'boom')
 *   console.log('Request:', { method,url}) → req.log.info({ method, url }, 'request')
 *
 * Fields listed in `redact` are replaced with `[REDACTED]` in every emitted
 * line. Add a path here the moment you log a new sensitive field — don't rely
 * on developer discipline.
 */
const redactPaths = [
  'password',
  '*.password',
  'req.body.password',
  'req.body.newPassword',
  'req.body.currentPassword',
  'body.password',
  'token',
  '*.token',
  'authorization',
  'req.headers.authorization',
  'req.headers.cookie',
  'apiKey',
  '*.apiKey',
  'stripeSecretKey',
  'JWT_SECRET',
  'encryptedGeminiApiKey',
  'encryptedSeedreamApiKey',
  'encryptedFigmaToken',
];

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'visant-os', env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  // Pretty print only in local dev — keeps prod logs as structured JSON.
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname,service,env' },
        }
      : undefined,
});

/**
 * Child logger bound to a correlation ID.
 *
 * Attach the returned logger to `req.log` in middleware so every log line
 * emitted during that request carries the same `reqId`.
 */
export function withRequestId(reqId: string): Logger {
  return logger.child({ reqId });
}
