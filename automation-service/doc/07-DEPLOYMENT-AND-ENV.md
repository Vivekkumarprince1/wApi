# Deployment & Environment — Automation Service

Environment
- See `.env.example` for the canonical environment variables. Important ones:
  - `PORT` — HTTP port (default 3001)
  - `MONGODB_URI_AUTOMATION` — MongoDB connection string
  - `JWT_SECRET` — JWT signing secret for user APIs
  - `INTERNAL_SERVICE_SECRET` — secret required by internal routes
  - `REDIS_URL` — Redis for BullMQ
  - `CHAT_SERVICE_URL`, `BSP_SERVICE_URL` — optional peers

Running locally

1. Install deps

```bash
cd automation-service
npm install
```

2. Start supporting services (MongoDB, Redis)

3. Copy `.env.example` to `.env` and set secrets

4. Run in dev mode

```bash
npm run dev
```

Build & run (production)

```bash
npm run build
npm start
```

Docker
- A `Dockerfile` is provided. Build and run as you would any Node image. Ensure environment variables are supplied.

Scheduler & workers
- The scheduler is started automatically on successful MongoDB connection (see `src/index.ts`).
- BullMQ workers are expected to be started from within the service process or separate worker processes that import the same service worker code.

Health checks & monitoring
- `/health` endpoint returns DB connectivity state used by orchestrators.
- The service logs structured request events using the shared logger configured in `src/lib/logger`.

Common issues
- Startup fails with `FATAL: Database connection error` — verify `MONGODB_URI_AUTOMATION` and DB reachability.
- Scheduler fails to import — check `workers/scheduler.ts` for runtime errors printed to console.
