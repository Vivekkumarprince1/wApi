# wApi

WhatsApp Business Platform built as a microservices monorepo. Originally a NestJS monolith; now split into 10 backend services + 2 Next.js apps + a shared `@wapi/contracts` package.

## Layout

```
apps/
  admin-portal/        Next 16 + React 19 — Super Admin Platform (port 3100)
  customer-portal/     Next 16 + React 19 — customer-facing app (Next default 3000)
packages/
  contracts/           @wapi/contracts — shared types, DTOs, event payloads
services/
  api-gateway/         Express + http-proxy-middleware router (5001)
  auth-service/        Express (3006) — identity, JWT, OTP
  automation-service/  (3001) — workflow/automation engine
  billing-service/     Express (3003)
  campaign-service/    Express (3002)
  chat-service/        Express (3008)
  contact-service/     Express (3007)
  service-provider/    NestJS (3004) — BSP/Gupshup app lifecycle, templates, webhooks
  webhook-ingestor/    (3013) — inbound BSP webhooks
  websocket-gateway/   (3009) — realtime fan-out
```

There is no top-level `package.json`. Each service/app installs its own deps; `@wapi/contracts` is linked via `"file:../../packages/contracts"`.

## Running locally

- **All services at once:** `docker compose up --build` from repo root.
- **Single service:** `cd services/<name> && npm run dev`. Same for apps.
- **Build a service:** `npm run build` in the service dir. `service-provider` uses `nest build`; others use `tsc`.
- **Contracts:** changes to `packages/contracts` require `npm run build` there before consumers pick them up (or `npm run dev` for watch).

## Stack notes

- **Runtime:** Node, TypeScript 5 (admin-portal is on TS 6, customer-portal on TS 5).
- **Databases:** MongoDB via Mongoose 8, Redis via ioredis.
- **Eventing:** kafkajs for cross-service events, BullMQ for job queues.
- **HTTP:** Express 4 everywhere except `service-provider` (NestJS 10 + `@nestjs/mongoose`).
- **Logging:** winston + `@logtail/winston` (optional peer in `contracts`).
- **Frontends:** Next 16 (webpack on admin-portal), Tailwind v4, Radix/Base UI, TanStack Query, zustand, zod.

## Memory constraints (8GB dev machine)

Every `dev`/`build` script sets `NODE_OPTIONS=--max-old-space-size=...` (typically 2048–4096). When adding scripts, keep the cap — running multiple services without it OOMs the machine.

## Conventions

- Express services follow `src/{config,controllers,middleware,models,routes,services,utils}/index.ts`.
- `service-provider` follows NestJS module conventions under `src/{admin,channels,common,health,workspace}` with `app.module.ts` + `main.ts` + `config.ts`.
- Cross-service request/response shapes and Kafka event payloads live in `@wapi/contracts` — add new shared types there rather than duplicating across services.
- Admin Portal reads MongoDB directly and writes through `api-gateway`.

## Gotchas

- `service-provider` is the only NestJS service and lags on some Nest 10 versions; treat it as a special case when bumping TS/Mongoose/Express across the repo.
- The `wApi-backup/` directory next to this repo is a separate snapshot — don't edit files there expecting them to apply here.
