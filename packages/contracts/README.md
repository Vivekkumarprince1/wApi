# @connectsphere/contracts

Shared TypeScript types between the ConnectSphere services and frontend.

## What lives here

- **worker-bridge.ts** — request/response shapes for `POST /api/internal/worker-bridge`.
- **automation-actions.ts** — action types + payload shape posted to `POST /api/internal/actions`.
- **billing-events.ts** — BullMQ saga events between billing/campaign services and the billing pub/sub envelope.
- **billing-internal.ts** — REST request/response shapes for billing preflight, reserve, settle, and release calls.
- **bsp.ts** — REST request/response shapes for BSP onboarding, provider message dispatch, template sync, and normalized webhooks.
- **campaign-events.ts** — campaign execution and progress events emitted by the campaign-messaging service.
- **socket-events.ts** — names + payload shapes for Socket.io events.
- **common.ts** — shared envelope (`ApiResponse`, `PaginationInfo`, `ObjectIdString`).

## Adoption

The contracts package is wired into the monorepo but call-sites still
hold private duplicates. Migrate one at a time:

1. Replace local types in `automation-service/src/services/external/index.ts`
   with `AutomationActionType` + `AutomationActionEnvelope`.
2. Replace local types in `campaign-service/src/lib/microservice-worker-client.ts`
   with `WorkerBridgeRequest` discriminated union.
3. Replace ad-hoc payload types in `frontend/src/components/layout/socket-hub.tsx`
   with the named payload interfaces.

Each step keeps the wire format identical — only the call-site loses its
copy of the type.
