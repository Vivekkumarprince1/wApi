/**
 * Server logger — re-exports the shared `@wapi/contracts` logger with the
 * `wapi-server` service tag. Public surface (`logger`, `withCorrelationId`,
 * `getCorrelationId`, `newCorrelationId`, `correlationIdMiddleware`) is
 * unchanged so existing imports keep working.
 *
 * Set LOGTAIL_SOURCE_TOKEN + LOGTAIL_INGESTING_HOST in env to ship logs to
 * Better Stack. Without those, logs go to stdout only.
 */

import {
  createServiceLogger,
  correlationIdMiddleware as buildCorrelationIdMiddleware,
} from '@wapi/contracts';

const service = createServiceLogger({
  service: process.env.SERVICE_NAME || 'wapi-server',
});

export const logger = service.logger;
export const withCorrelationId = service.withCorrelationId;
export const getCorrelationId = service.getCorrelationId;
export const newCorrelationId = service.newCorrelationId;

export const correlationIdMiddleware = buildCorrelationIdMiddleware(
  service.withCorrelationId,
  service.als,
);
