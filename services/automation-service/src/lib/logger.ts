/**
 * Automation service logger — uses the shared @connectsphere/contracts logger so
 * every service emits the same JSON shape and ships to Better Stack when
 * LOGTAIL_SOURCE_TOKEN is configured.
 */

import {
  createServiceLogger,
  correlationIdMiddleware as buildCorrelationIdMiddleware,
} from '@connectsphere/contracts';

const service = createServiceLogger({
  service: process.env.SERVICE_NAME || 'automation-service',
});

export const logger = service.logger;
export const withCorrelationId = service.withCorrelationId;
export const getCorrelationId = service.getCorrelationId;
export const newCorrelationId = service.newCorrelationId;

export const correlationIdMiddleware = buildCorrelationIdMiddleware(
  service.withCorrelationId,
  service.als,
);
