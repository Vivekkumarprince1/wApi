/**
 * Billing service logger — uses the shared @wapi/contracts logger so
 * every service emits the same JSON shape and ships to Better Stack when
 * LOGTAIL_SOURCE_TOKEN is configured.
 */

import {
  createServiceLogger,
  correlationIdMiddleware as buildCorrelationIdMiddleware,
} from '@wapi/contracts';

const service = createServiceLogger({
  service: process.env.SERVICE_NAME || 'billing-service',
});

export const logger = service.logger;
export const withCorrelationId = service.withCorrelationId;
export const getCorrelationId = service.getCorrelationId;
export const newCorrelationId = service.newCorrelationId;

export const correlationIdMiddleware = buildCorrelationIdMiddleware(
  service.withCorrelationId,
  service.als,
);
