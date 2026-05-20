# wApi — WhatsApp Business Platform

Monorepo managed by [Turborepo](https://turbo.build/).

## Services

| Workspace | Port | Stack | Purpose |
|---|---|---|---|
| `frontend` | 3000 | Next.js 16 / React 19 | Web UI |
| `server` | 5001 | Express + TypeScript | API gateway + auth + contacts + messaging |
| `automation-service` | 3001 | Express + TypeScript | Workflow / automation engine |
| `campaign-service` | 3002 | Express + TypeScript | Broadcast & template messaging |
| `billing-service` | 3003 | Express + TypeScript | Wallet + Razorpay payments |
| `bsp-service` | 3004 | NestJS | Gupshup BSP provider integration |
| `packages/contracts` | — | TypeScript | Shared types & event contracts |

## Commands

```bash
npm install            # install everything once at root
npm run build          # build all packages (respects dep order)
npm run dev            # run every service in dev mode in parallel
npm run start          # run every service in production mode
npm run lint
npm run test
```

Turbo handles build ordering — `@wapi/contracts` builds first, services build after.

## Per-service commands

```bash
npm run dev --workspace=server
npm run build --workspace=campaign-service
```

## Centralized logging

All services log JSON to stdout and (when `LOGTAIL_SOURCE_TOKEN` is set) ship to
[Better Stack](https://betterstack.com/logs). Set these in `.env`:

```
LOGTAIL_SOURCE_TOKEN=...
LOGTAIL_INGESTING_HOST=s1234567.eu-nbg-2.betterstackdata.com
```

Each log line carries `service`, `correlationId`, and `timestamp` so traces
can be reconstructed across HTTP, BullMQ jobs, and webhook flows.

## API documentation

Swagger UI is exposed by each service:

- `http://localhost:5001/docs` — server
- `http://localhost:3001/docs` — automation-service
- `http://localhost:3002/docs` — campaign-service
- `http://localhost:3003/docs` — billing-service
- `http://localhost:3004/docs` — bsp-service (NestJS Swagger)

The raw OpenAPI JSON is served at `/docs/openapi.json` on each service.
