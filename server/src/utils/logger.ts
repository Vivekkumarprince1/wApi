import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import { createLogger, format, transports, type Logger } from 'winston';

/**
 * Structured logger with request-id correlation.
 *
 * - Production: JSON output to stdout (pipe-friendly for any log sink).
 * - Development: colourised single-line output.
 * - Every log entry automatically includes the active correlation id and
 *   service name so HTTP → BullMQ → worker traces can be stitched
 *   together by `correlationId`.
 *
 * Usage:
 *   import { logger, withCorrelationId } from '@/utils/logger';
 *   logger.info('something happened', { foo: 1 });
 *
 *   // To run a worker job with a specific correlation id:
 *   await withCorrelationId(job.data.correlationId, async () => { ... });
 */

type Store = { correlationId?: string };
const als = new AsyncLocalStorage<Store>();

const SERVICE_NAME = process.env.SERVICE_NAME || 'wapi-server';

const baseFormat = format.combine(
  format.timestamp(),
  format((info) => {
    const store = als.getStore();
    if (store?.correlationId && !info.correlationId) {
      info.correlationId = store.correlationId;
    }
    info.service = SERVICE_NAME;
    return info;
  })()
);

const isProd = process.env.NODE_ENV === 'production';

export const logger: Logger = createLogger({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  format: isProd
    ? format.combine(baseFormat, format.json())
    : format.combine(
        baseFormat,
        format.colorize(),
        format.printf(({ timestamp, level, message, correlationId, service, ...rest }) => {
          const ctx = correlationId ? ` [${correlationId}]` : '';
          const extras = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
          return `${timestamp} ${level} (${service})${ctx} ${message}${extras}`;
        })
      ),
  transports: [new transports.Console()],
});

/** Run `fn` with `correlationId` available to all `logger` calls inside. */
export function withCorrelationId<T>(correlationId: string | undefined, fn: () => Promise<T> | T): Promise<T> | T {
  if (!correlationId) return fn();
  return als.run({ correlationId }, fn as any) as any;
}

export function getCorrelationId(): string | undefined {
  return als.getStore()?.correlationId;
}

export function newCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Express middleware. Reads the incoming `x-correlation-id` header (falls
 * back to a fresh UUID), echoes it on the response, and sets it as the
 * AsyncLocalStorage value so logger calls within the request scope are
 * automatically stamped.
 */
export function correlationIdMiddleware(req: any, res: any, next: any) {
  const incoming = (req.headers['x-correlation-id'] || req.headers['x-request-id']) as string | undefined;
  const id = incoming && typeof incoming === 'string' && incoming.length <= 128 ? incoming : newCorrelationId();
  res.setHeader('x-correlation-id', id);
  als.run({ correlationId: id }, () => next());
}
