# wApi — Tooling & Library Recommendations

> Review date: 2026-05-31. Architecture: 7 deployables (frontend + 6 Node services) + `packages/contracts`, BullMQ workers, Redis, MongoDB/Mongoose, Socket.io.
>
> ✅ **All versions below were checked against the live npm registry on 2026-05-31** (`npm view <pkg> version`). They are real.

---

## 0. TL;DR — do these in order

1. **Unify versions across services** (§1) — your versions are *real and current*, the problem is they're **inconsistent**: `server`, `api-gateway`, `websocket-service` lag a major version behind the newer services on TS, Mongoose, Express, and zod.
2. **Adopt pnpm workspaces + Turborepo** (§2) — replaces `controlled-build.js`, caches builds, fixes your 8GB-RAM build pain, and makes version drift structurally impossible via a `catalog:`.
3. **Centralize queue names & job payloads in `packages/contracts`** (§3) — kills the "must match name in monolith" fragility. *(PoC applied this pass.)*
4. **Use BullMQ's native, cluster-aware rate-limiter + Bull Board dashboard** (§3) — replaces the hand-rolled `setTimeout` throttle.
5. **Standardize logging on pino** and validation on **zod v4** everywhere (§4).
6. **Add a test runner (Vitest) and CI** (§5) — right now every backend `test` script is `exit 1`.

---

## 1. Version consistency (verified against npm 2026-05-31)

Latest published versions today:

| Package | ✅ Latest on npm | Your newest service | Your laggard service(s) |
|---|---|---|---|
| typescript | **6.0.3** | `^6.0.3` (automation, campaign, billing) | `^5.3.x` (server, api-gateway, websocket) |
| mongoose | **9.6.3** | `^9.6.0` (automation, campaign, billing) | `^8.0.0` (server) |
| express | **5.2.1** | `^5.2.1` (automation, campaign, billing) | `^4.x` (server, api-gateway*, websocket) |
| zod | **4.4.3** | `^4.3.6` (automation) | `^3.x` (server, api-gateway, websocket, frontend) |
| @types/node | **25.9.1** | `^25.6.0` (newer services) | `^20.x` (server, gateway, ws) |
| bullmq | **5.77.6** | `^5.76.x` | `^5.0.0` (server) |
| fastify | **5.8.5** | — | `^4.26.2` (api-gateway is on **Fastify 4**) |

**So the numbers in your package.json are NOT fake** (my first pass was wrong about that — they're all real, current releases). The actual risk is **split versions across services**:

- **TypeScript 5 vs 6** — TS 6 has stricter defaults and some breaking flag changes. Mixing means `packages/contracts` (currently TS 5) could emit types one service's compiler rejects.
- **Mongoose 8 vs 9** — `server` on 8, microservices on 9. Schema/query API differences; shared model assumptions can break.
- **Express 4 vs 5** — different routing, `req.query` is a getter in 5, async error propagation differs. This is the most error-prone split.
- **zod 3 vs 4** — incompatible if a v3 schema and a v4 schema are shared through `packages/contracts`. Pick one (v4).

### Recommended canonical versions (pin identically across ALL backend services)

```jsonc
"typescript":  "~6.0.3",      // contracts package too
"mongoose":    "^9.6.3",
"express":     "^5.2.1",      // migrate server off Express 4 deliberately
"zod":         "^4.4.3",
"bullmq":      "^5.77.6",
"ioredis":     "^5.10.1",
"@types/node": "^25.9.1"      // see Node note below
"fastify":     "^5.8.5"       // api-gateway: bump from Fastify 4
```

**Node runtime:** you reported running **Node v26**. `@types/node@25.9.1` is the current types line, which tracks recent Node. Confirm your actual `node -v` on the deploy target and pin `engines` to match, e.g.:

```jsonc
"engines": { "node": ">=22" }
```

Add a root `.nvmrc` so every machine/CI uses the same Node.

> The cleanest enforcement is a pnpm **`catalog:`** (§2): declare each version once, reference `"mongoose": "catalog:"` in every service. Drift then can't happen.

### Migration order to avoid breakage
1. **zod 3 → 4** in server/gateway/ws (mostly mechanical; check `.parse`/error shape changes).
2. **Express 4 → 5** in `server` (biggest one — test routing & error middleware).
3. **Mongoose 8 → 9** in `server`.
4. **TS 5 → 6** last, repo-wide, in one commit (so `contracts` + consumers move together).
5. **Fastify 4 → 5** in `api-gateway`.

---

## 2. Monorepo build tooling — replace `controlled-build.js`

`controlled-build.js` (sequential `tsc` with `--max-old-space-size` caps) exists to survive low RAM. A real monorepo toolchain does this better and faster.

### Recommended: **pnpm 11 workspaces + Turborepo 2.9**

- **pnpm** — content-addressed store: one copy of each dependency on disk instead of duplicating `node_modules` across 7 services (a major win on your 8GB machine).
- **Turborepo** — caches `build`/`lint`/`test`; only rebuilds what changed. `--concurrency=1` reproduces your memory-safe sequential build, but with caching, and it derives build order from the dependency graph (no hand-maintained `SERVICES` array).

```yaml
# pnpm-workspace.yaml (repo root)
packages:
  - "frontend"
  - "api-gateway"
  - "server"
  - "automation-service"
  - "campaign-service"
  - "billing-service"
  - "websocket-service"
  - "packages/*"

# single source of truth for shared versions — fixes §1 permanently
catalog:
  typescript: ~6.0.3
  mongoose: ^9.6.3
  express: ^5.2.1
  zod: ^4.4.3
  bullmq: ^5.77.6
  ioredis: ^5.10.1
```

```jsonc
// turbo.json (repo root)
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev":   { "cache": false, "persistent": true },
    "lint":  {},
    "test":  { "dependsOn": ["^build"] }
  }
}
```

Low-RAM build becomes: `turbo run build --concurrency=1` (contracts builds first automatically).

> Keep `controlled-build.js` until the migration is verified end-to-end, then delete it.

**Lighter alternative:** native **npm workspaces** (you're on npm 11). Removes duplicated installs and gives `npm run build -w <service>`, but no build caching.

---

## 3. Workers / Queue architecture

You already use BullMQ well (chunking, attempts, exponential backoff, sensible `removeOnComplete/Fail`). Four concrete upgrades:

### 3a. Move queue names + payloads into `packages/contracts` ✅ *(PoC applied)*
`'campaign-engine'`, `'bulk-messages'`, etc. were string literals duplicated across services — [campaign-queue.ts](campaign-service/src/lib/campaign-queue.ts) literally commented *"Must match name in monolith."* I added [packages/contracts/src/queues.ts](packages/contracts/src/queues.ts) with a `QUEUE_NAMES` const + typed `QueuePayloads` map and exported it from the package index. Refactor producers/consumers to import these — a typo'd queue name becomes a **compile error** instead of a silently-dead job.

### 3b. Use BullMQ's native rate-limiter instead of `setTimeout`
[bulkMessageWorker.ts](server/src/workers/bulkMessageWorker.ts) throttles with a manual `chunkPause()`/`setTimeout`. BullMQ's built-in limiter is **cluster-aware** — your hand-rolled one isn't, so two worker processes would each send at the full rate, **doubling** your real throughput against WhatsApp:

```ts
import { QUEUE_NAMES } from "@wapi/contracts";
new Worker(QUEUE_NAMES.BULK_MESSAGES, processor, {
  connection,
  concurrency: WORKER_CONCURRENCY,
  limiter: { max: 80, duration: 1000 }, // 80 msg/s — WhatsApp high tier
});
```

For **per-workspace** limits (each tenant has its own WhatsApp throughput tier), use BullMQ job groups / `Worker.rateLimit()` keyed by `workspaceId`. WhatsApp Cloud API tiers are 1k → 10k → 100k → unlimited **per phone number**; bursting triggers errors 131056 / 130429.

### 3c. Add **Bull Board** (`@bull-board/api` 7.1.5 + `@bull-board/express`)
You have a custom `setInterval` failure-monitor in [worker-registry.ts](server/src/services/worker-registry.ts). Keep the alerting, add a UI behind admin auth at `/admin/queues`: see waiting/active/failed/DLQ jobs, retry from the UI, inspect payloads. Replaces a lot of `console.log` debugging.

### 3d. Dead-letter handling
`removeOnFail: { count: 5000, age: 7d }` keeps failures around (good). Add an explicit DLQ: on final-attempt failure, push the job to a `*-dlq` queue with the error so failures are queryable and replayable rather than just sitting in the failed set until TTL.

---

## 4. Cross-cutting library standardization

| Concern | Today | Recommendation |
|---|---|---|
| **Logging** | `server` uses **Winston**; campaign/queue code uses `console.log` | Standardize on **pino 10.3.1** (faster, structured JSON). `pino-http` for request logs, `pino-pretty` in dev only. One shared logger (e.g. `packages/logger` or inside contracts). |
| **Validation** | zod 3 (server/gw/ws/frontend) + zod 4 (automation) | **zod 4.4.3** everywhere; share schemas via `packages/contracts`. v4 is meaningfully faster on hot webhook paths. |
| **HTTP client** | axios everywhere (consistent) | Fine to keep. `undici`/native `fetch` is built into modern Node if you want to drop a dep — not urgent. |
| **Config/env** | mixed `dotenv` + `@dotenvx/dotenvx` (billing only) | Pick one. Then validate env with a zod schema at boot so a missing `REDIS_URL` fails fast, not at first job. |
| **Dates** | `date-fns` v4 everywhere (consistent ✅) | Keep — good choice. |
| **Resilience** | `p-retry` in server only | Standardize; consider `cockatiel` for circuit-breaking around BSP/Gupshup calls. |
| **IDs** | — | `uuid` v7 / `ulid` for time-sortable correlation IDs across services. |

---

## 5. Testing, CI & DX (currently missing)

- **Every backend `test` script is `exit 1`.** Add **Vitest 4.1.7** + **supertest** for routes. Start with highest-risk code: webhook processing, billing/wallet math, campaign batching.
- **CI:** GitHub Actions running `turbo run lint test build` on PRs — fast thanks to Turbo cache.
- **Lint/format:** frontend has ESLint 9; backends have none. Add a shared ESLint flat config + Prettier — or **Biome** (one fast Rust binary doing lint+format, great on low-RAM).
- **Type-check in CI:** `tsc --noEmit` per service blocks type errors at merge.
- **Pre-commit:** `lefthook` (light) or `husky` + `lint-staged`.
- **Bundling backends:** consider **tsup 8.5.1** (esbuild) instead of `tsc` for build — dramatically faster and lower memory than `tsc`, which directly helps your 8GB constraint. Keep `tsc --noEmit` for type-checking only.

---

## 6. Frontend notes

Stack is **modern and healthy**: Next **16.2.x** (latest 16.2.6), React **19.2.x**, Tailwind 4, TanStack Query 5, zustand 5, React Compiler enabled. Minor:

- `lucide-react` `^1.8.0` looks **mispinned** — lucide-react publishes on the 0.x line. Verify with `npm view lucide-react version`; likely should be `^0.4xx`.
- `@google/generative-ai` is the **deprecated** Gemini SDK; migrate to **`@google/genai`** (unified SDK).
- You build with `--webpack`; evaluate **Turbopack** (the Next 16 default) for faster, lower-memory builds.
- Align frontend zod (v3) with backend (v4) once schemas are shared via `packages/contracts`.

---

## 7. Suggested rollout order

1. **Unify versions** in one service first (PoC target: `campaign-service` is already newest — use `server` as the migration guinea pig instead). Verify install + build.
2. Refactor `campaign-service` + `server` workers to import `QUEUE_NAMES` from `@wapi/contracts` (file already added).
3. Roll version unification to remaining services.
4. Introduce pnpm workspace + `catalog:` + Turborepo; delete `controlled-build.js`.
5. Swap manual throttle → BullMQ limiter; mount Bull Board.
6. pino everywhere; zod v4 everywhere.
7. Vitest + CI; optionally tsup for backend builds.

---

## ⚠️ Found during PoC: broken bullmq install in campaign-service
`campaign-service/node_modules/bullmq/package.json` declares `"types": "./dist/esm/index.d.ts"` but **that file does not exist on disk** — the install is partial/corrupted (consistent with the 8GB-RAM installs freezing mid-way, see the build-constraints note). This produces 9 pre-existing `tsc --noEmit` errors (TS7016 + cascading TS7006 implicit-any) that have nothing to do with the queue refactor. The `dev`/`build` scripts hide it by using `ts-node-dev --transpile-only` / not running a strict typecheck. **Fix:** clean reinstall (`rm -rf node_modules && pnpm install` once the workspace is adopted) so bullmq's bundled types land. Until then, full `tsc` type-checking of this service will report those 9 errors regardless of source code.

## PoC applied in this pass (safe, additive only)
- **`packages/contracts/src/queues.ts`** — new: typed `QUEUE_NAMES` registry + `QueuePayloads`/`JobPayload<>` map + `CAMPAIGN_JOB_TYPES`.
- **`packages/contracts/src/index.ts`** — added `export * from './queues'`.

### Workspace + queue wiring applied this pass
- **`package.json`** (root, new) — pnpm workspace root: `turbo run build --concurrency=1` (memory-safe), keeps `controlled-build.js` as `build:legacy`.
- **`pnpm-workspace.yaml`** (new) — workspace globs + version **catalog** (TS, Mongoose, Express, zod, bullmq, ioredis, @types/node, fastify).
- **`turbo.json`** (new) — build/dev/lint/test pipeline with `^build` ordering (contracts builds first automatically).
- **`.nvmrc`** (new) — pins Node 22.
- **`campaign-service/package.json`** — added `"@wapi/contracts": "workspace:*"`.
- **`campaign-service/node_modules/@wapi/contracts`** — symlink → `packages/contracts` (manual stand-in for what `pnpm install` will create; lets it compile now without a full reinstall).
- **`campaign-service/src/lib/campaign-queue.ts`** — uses `QUEUE_NAMES.CAMPAIGN_ENGINE`; `JOB_TYPES` now re-exports `CAMPAIGN_JOB_TYPES` from contracts (existing imports unchanged).
- **`campaign-service/src/workers/CampaignWorker.ts`** — uses `QUEUE_NAMES.CAMPAIGN_ENGINE`.

**Verification:** `tsc --noEmit` on campaign-service reports **9 errors, all pre-existing** from the broken bullmq install above — **0 from the contracts wiring**. An isolated import probe of `QUEUE_NAMES`/`CAMPAIGN_JOB_TYPES`/`JobPayload` type-checks clean (exit 0). The contracts package itself builds clean.

### To finalize (your call — needs a one-time install)
1. `npm i -g pnpm@11` (pnpm isn't installed yet).
2. From repo root: `pnpm install` — replaces the manual symlink with a real workspace link and fixes the bullmq install.
3. Roll the same `QUEUE_NAMES` wiring into `server/src/services/worker-registry.ts`, `bulkMessageWorker.ts`, webhook/import/snooze workers, and automation-service.
4. Switch each service's shared deps to `"catalog:"` to lock versions.

No service runtime behavior changed (queue name string value is identical: `"campaign-engine"`). Build the contracts package (`npm run build` in `packages/contracts`) any time you edit it.
