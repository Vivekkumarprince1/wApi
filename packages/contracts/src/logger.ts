/**
 * Shared structured logger for ConnectSphere services.
 *
 * - Production: JSON to stdout + (optional) Better Stack / Logtail HTTP transport
 * - Development: colourised single-line console output
 * - Every entry carries `service`, `correlationId`, and timestamp so traces
 *   can be reconstructed across HTTP → BullMQ → worker hops.
 *
 * Usage in a service:
 *   import { createServiceLogger, correlationIdMiddleware } from '@connectsphere/contracts/logger';
 *   export const { logger, withCorrelationId, getCorrelationId } =
 *     createServiceLogger({ service: 'campaign-service' });
 *
 *   app.use(correlationIdMiddleware(withCorrelationId));
 *
 * To ship to Better Stack, set:
 *   LOGTAIL_SOURCE_TOKEN=...
 *   LOGTAIL_INGESTING_HOST=s1234567.eu-nbg-2.betterstackdata.com
 *
 * Without those env vars, logs only go to stdout — safe default for local dev.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';
import { createLogger, format, transports, type Logger } from 'winston';

type Store = { correlationId?: string };

export interface LoggerOptions {
  /** Service name stamped on every log line (e.g. 'campaign-service'). */
  service: string;
  /** Override the env-derived log level. */
  level?: string;
}

export interface ServiceLogger {
  logger: Logger;
  withCorrelationId: <T>(correlationId: string | undefined, fn: () => Promise<T> | T) => Promise<T> | T;
  getCorrelationId: () => string | undefined;
  newCorrelationId: () => string;
  als: AsyncLocalStorage<Store>;
}

/**
 * Lazily resolve the Logtail transport so services that don't install
 * `@logtail/winston` (or don't set the token) still work.
 */
function buildLogtailTransport(service: string): any | null {
  const token = process.env.LOGTAIL_SOURCE_TOKEN;
  const host = process.env.LOGTAIL_INGESTING_HOST;
  if (!token || !host) return null;

  try {
    // Optional dependency — only loaded if the service installed it.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LogtailTransport } = require('@logtail/winston');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Logtail } = require('@logtail/node');
    const logtail = new Logtail(token, { endpoint: `https://${host}` });
    return new LogtailTransport(logtail, {
      // Attach the service tag at the transport level too, so Better Stack
      // can filter by service even if a log entry forgot to set it.
      metadata: { service },
    });
  } catch (err) {
    // Either the packages aren't installed in this service or runtime
    // initialization failed. Fall back to stdout-only — never crash bootstrap
    // just because remote logging isn't available.
    // eslint-disable-next-line no-console
    console.warn(
      `[logger] Better Stack disabled for ${service}: ${(err as Error).message}. ` +
        `Install @logtail/winston @logtail/node and set LOGTAIL_SOURCE_TOKEN/LOGTAIL_INGESTING_HOST to enable.`,
    );
    return null;
  }
}

export function createServiceLogger(opts: LoggerOptions): ServiceLogger {
  const als = new AsyncLocalStorage<Store>();
  const isProd = process.env.NODE_ENV === 'production';

  const baseFormat = format.combine(
    format.timestamp(),
    format((info) => {
      const store = als.getStore();
      if (store?.correlationId && !info.correlationId) {
        info.correlationId = store.correlationId;
      }
      info.service = opts.service;
      return info;
    })(),
  );

  const consoleTransport = new transports.Console({
    format: isProd
      ? format.combine(baseFormat, format.json())
      : format.combine(
          baseFormat,
          format.colorize(),
          format.printf(({ timestamp, level, message, correlationId, service, ...rest }) => {
            const ctx = correlationId ? ` [${correlationId}]` : '';
            const extras = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
            return `${timestamp} ${level} (${service})${ctx} ${message}${extras}`;
          }),
        ),
  });

  const allTransports: any[] = [consoleTransport];
  const logtail = buildLogtailTransport(opts.service);
  if (logtail) allTransports.push(logtail);

  const logger = createLogger({
    level: opts.level || process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
    // Always emit JSON to the underlying logger; the console transport
    // re-formats for humans in dev.
    format: format.combine(baseFormat, format.json()),
    transports: allTransports,
  });

  function withCorrelationId<T>(correlationId: string | undefined, fn: () => Promise<T> | T): Promise<T> | T {
    if (!correlationId) return fn();
    return als.run({ correlationId }, fn as any) as any;
  }

  function getCorrelationId(): string | undefined {
    return als.getStore()?.correlationId;
  }

  function newCorrelationId(): string {
    return crypto.randomUUID();
  }

  return { logger, withCorrelationId, getCorrelationId, newCorrelationId, als };
}

/**
 * Express middleware factory. Reads incoming `x-correlation-id`, echoes it
 * on the response, and binds it into AsyncLocalStorage for the request scope.
 *
 * Pass the `withCorrelationId` returned by `createServiceLogger` so the
 * middleware shares the same ALS instance as the logger.
 */
export function correlationIdMiddleware(
  _withCorrelationId: ServiceLogger['withCorrelationId'],
  als: AsyncLocalStorage<Store>,
) {
  return function (req: any, res: any, next: any) {
    const incoming = (req.headers['x-correlation-id'] || req.headers['x-request-id']) as string | undefined;
    const id =
      incoming && typeof incoming === 'string' && incoming.length <= 128
        ? incoming
        : crypto.randomUUID();
    res.setHeader('x-correlation-id', id);
    als.run({ correlationId: id }, () => next());
  };
}
