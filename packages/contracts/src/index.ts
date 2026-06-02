/**
 * @wapi/contracts
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

export * from './worker-bridge';
export * from './automation-actions';
export * from './billing-events';
export * from './socket-events';
export * from './common';
export * from './queues';
export * from './roles';
export * from './redis-config';
