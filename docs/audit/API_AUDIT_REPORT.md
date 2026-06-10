# API Audit Report — 2026-06-10

Master inventory: client base = axios `baseURL:'/api/v1'` (customer-portal) → Next rewrites → gateway :5001.
Admin-portal: reads Mongo directly; writes via `gatewayCall()` with internal secret.

## Gateway routing table (post-fix)
| Gateway mount | Target service | Rewrite |
|---|---|---|
| /api/v1/auth | auth :3006 | strip prefix (authRateLimit) |
| /api/v1/super-admin/gupshup | service-provider :3004 | → /internal/v1/bsp/admin (sync-all-webhooks→sync-webhooks) |
| /api/v1/super-admin/plans | billing :3003 | → /api/billing/wallets/admin/plans |
| /api/v1/super-admin/billing | billing :3003 | → /api/billing/wallets/admin |
| /api/v1/super-admin (rest) | auth | → /super-admin (no routes exist — dead fallback) |
| /api/v1/workspace/billing | billing | strip prefix |
| /api/v1/workspace/pricing | billing | → /pricing |
| /api/v1/workspace/{tags,quick-replies} | contact :3007 | full path |
| /api/v1/workspace/{waba,profile,webhooks,whatsapp/health,phone-numbers,connection-status} | service-provider | → /bsp/v1/workspace/* |
| /api/v1/workspace (rest) | auth | → /workspace/* |
| /api/v1/settings/{api-keys→/keys, integrations→/api/v1/integrations} | automation :3001 | rewrites |
| /api/v1/settings/{team,notifications,workspace, rest} | auth | rewrites |
| /api/v1/settings/billing | billing | GET→/info, else→/settings |
| /api/v1/business | auth | strip prefix (→ /info, /verify) |
| /api/v1/{tags, messaging/quick-replies} | contact | full path (legacy) |
| /api/v1/inbox/settings | auth | → /workspace/inbox/settings |
| /api/v1/contacts/:id/send-template | chat :3008 | → /api/v1/inbox/contacts/:id/send-template |
| /api/v1/{contacts,crm,bulk} | contact | full path (bulk has bulkRateLimit) |
| /api/v1/{inbox,conversations,analytics,metrics,support} | chat | full path |
| /api/v1/billing | billing | → /api/billing/wallets |
| /api/v1/commerce | billing | full path |
| /api/v1/campaign | campaign :3002 | → /api/campaign |
| /api/v1/ads | campaign | full path |
| /api/v1/automation | automation | → /api/automation (engine at /api/automation/engine) |
| /api/v1/{flows,widget,developer,integrations} | automation | full path |
| /api/v1/onboarding/provider | service-provider | → /bsp/v1/onboarding |
| /api/v1/onboarding/bsp | service-provider | → /bsp/v1/onboarding |
| /api/v1/onboarding | service-provider | → /bsp/v1/onboarding |
| /api/v1/{templates,upload} | service-provider | full path |
| /api/internal/{billing→/api/billing, contacts→/internal/v1/contacts, provider→/internal/v1/bsp, chat→/api/internal, rest→chat} | various | internal bridge |
| /api/webhooks/razorpay | billing | → /api/billing/webhooks |
| /api/webhooks | webhook-ingestor :3013 | → /webhooks |
| /socket.io (ws:true + server.on('upgrade')) | websocket-gateway :3009 | — |

## Service route surface (counts, post-fix)
- auth-service: ~70 routes (auth/OTP/Google/Facebook, workspace members/teams/roles, notifications, account deletion, internal verify-session)
- contact-service: 50 (contacts CRUD, tags, quick-replies, CRM pipelines/deals/tasks/automation/analytics, bulk ops incl. CSV import jobs, internal contacts API)
- chat-service: ~45 (inbox/conversations/messages/read/action/status ×3 path styles, support tickets/macros, analytics, metrics, internal dispatch)
- billing-service: ~45 (wallets, orders, plans incl. admin, commerce products/orders/catalogs/settings/stats, razorpay webhooks, workspace billing)
- campaign-service: 21 (campaigns lifecycle/messages/export/retarget, segments resolve, ads, internal purge)
- automation-service: ~60 (engine rules/stats/executions+logs/execute, answerbot, ai-intent, instagram-quickflows+toggle, interaktive-list, whatsapp-forms publish/sync/responses, flows, widget, developer keys, integrations incl. Google Sheets aliases)
- service-provider (NestJS): /bsp/v1/workspace (10), /bsp/v1/onboarding (8), /api/v1/templates (~20 incl. rules+analytics), /internal/v1/bsp/{admin,apps,messages,templates,profiles,phones,subscriptions,esb-flow,media,tokens,onboarding,provider-actions}, /webhooks/gupshup, upload (3)
- webhook-ingestor (Fastify): GET/POST /webhooks(/:provider), /internal/v1/webhooks/replay, /health
- websocket-gateway: socket.io only + /health

## Auth model (verified consistent)
- Browser → cookie `auth_token` (or Bearer) → gateway verifies via auth `/internal/v1/auth/verify-session` → injects `x-user-id/x-user-role/x-user-system-role/x-workspace-id/x-permissions/x-impersonating` + `x-internal-service-secret` + `x-internal-service`.
- Services accept gateway headers iff secret matches (billing uses timingSafeEqual; others strict equality), else fall back to local JWT verification.
- NestJS guards require `x-internal-service` name + secret (now supplied by gateway).
- Internal service→service calls go direct with secret + service name (bsp-service-client, microservice-worker-client, bsp-client, internalController) — all paths verified against controllers.
