/**
 * @connectsphere/contracts
 *
 * Shared types between the monolith (`server/`), the microservices
 * (`automation-service/`, `campaign-service/`, `billing-service/`), and
 * the Next.js frontend.
 *
 * Adoption is incremental: services can import from here piece by piece
 * to replace duplicated local definitions. The first targets are the
 * worker-bridge action map, the automation action map, the billing saga
 * events, and the Socket.io event payloads.
 */

export * from './logger';
export * from './openapi';
export * from './worker-bridge';
export * from './automation-actions';
export * from './billing-events';
export * from './internal-identity';
export * from './metrics';
export * from './tracing';
export * from './billing-internal';
export * from './bsp';
export * from './campaign-events';
export * from './socket-events';
export * from './common';
export * from './event-topics';
export * from './errors';
export * from './models';


export * from './queues';
export * from './roles';
export * from './redis-config';
