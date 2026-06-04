# Quick Reference — Automation Service

Paths & ports
- Default port: `3001` (override with `PORT`)
- Swagger UI: `http://localhost:3001/docs`

Important files
- `src/index.ts` — entrypoint, DB connect, scheduler start
- `src/openapi.ts` — OpenAPI document generator
- `src/routes/*.ts` — route registration
- `src/controllers/*` — controllers
- `src/services/*` — core business logic
- `src/models/*` — Mongoose schemas

How to test an internal rule execution

1. Start service with valid `INTERNAL_SERVICE_SECRET` in `.env`.
2. Call the internal execute endpoint (example from `src/openapi.ts`):

```bash
curl -X POST http://localhost:3001/api/automation/engine/execute \
 -H "x-internal-service-secret: ${INTERNAL_SERVICE_SECRET}" \
 -H "Content-Type: application/json" \
 -d '{"workspaceId":"<id>","event":"message.inbound","contactId":"<cid>","payload":{}}'
```

Where to extend
- Add new actions in `src/services/simple-action-executor.ts` and update the flow-executor.
- Add new triggers in `workers/scheduler.ts` or by adding new `trigger` types handled by the engine.

Need more detail?
- Tell me which area you want expanded into an example (rule authoring, sample flow, OpenAPI examples, or a migration script) and I will add a dedicated page.
