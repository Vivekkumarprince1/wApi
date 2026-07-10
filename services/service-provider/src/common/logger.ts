/**
 * BSP service logger — uses the shared @connectsphere/contracts logger so every
 * service emits the same JSON shape and ships to Better Stack when
 * LOGTAIL_SOURCE_TOKEN is configured.
 *
 * NestJS has its own Logger abstraction; we still need a winston-backed
 * logger for non-Nest contexts (workers, raw scripts). Use this directly
 * or wire it as a custom Nest logger if desired.
 */

import {
  createServiceLogger,
  correlationIdMiddleware as buildCorrelationIdMiddleware,
} from '@connectsphere/contracts';

const service = createServiceLogger({
  service: process.env.SERVICE_NAME || 'bsp-service',
});

export const logger: any = service.logger;
export const withCorrelationId = service.withCorrelationId;
export const getCorrelationId = service.getCorrelationId;
export const newCorrelationId = service.newCorrelationId;

export const correlationIdMiddleware = buildCorrelationIdMiddleware(
  service.withCorrelationId,
  service.als,
);
