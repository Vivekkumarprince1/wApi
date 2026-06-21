# Render Deployment

This repo is configured for Render Blueprints through `render.yaml`.

## Shape

- Public web services: `wapi-api-gateway`, `wapi-customer-portal`, `wapi-admin-portal`, `wapi-webhook-ingestor`, `wapi-websocket-gateway`.
- Private services: auth, contact, chat, campaign, billing, automation, and service-provider.
- Shared Render Key Value: `wapi-redis`.
- Shared generated secrets: `JWT_SECRET`, `INTERNAL_SERVICE_SECRET`, `INTEGRATION_ENCRYPTION_KEY`.

Render injects internal service addresses as `*_HOSTPORT` values. `scripts/render-build.sh` and `scripts/render-start.sh` convert those into normal `http://...` URL environment variables before building or starting the app.

## Values To Fill In Render

Set these `sync: false` values when applying the Blueprint:

- MongoDB Atlas connection strings:
  `MONGO_URI` for each backend service, plus admin portal `MONGODB_URI`, `MONGODB_URI_BILLING`, `MONGODB_URI_CAMPAIGN`, and `MONGODB_URI_AUTOMATION`.
- Public origins:
  `ALLOWED_ORIGINS` on the API gateway, auth service, and websocket gateway.
- Customer portal:
  `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ADMIN_PORTAL_URL`, `NEXT_PUBLIC_SOCKET_URL`.
- Admin portal:
  `NEXT_PUBLIC_APP_URL`, `CUSTOMER_PORTAL_URL`.
- Auth service:
  `NEXT_PUBLIC_APP_URL`, SMTP settings, and Google OAuth settings if those flows are enabled.
- Webhooks:
  `WEBHOOK_SECRET` and either `WEBHOOK_VERIFY_TOKEN` or `VERIFY_TOKEN`.
- Billing:
  `PUBLIC_API_URL` should be the public API gateway origin. Set Razorpay keys when payments are enabled.
- Service provider:
  Gupshup credentials, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `WHATSAPP_WEBHOOK_URL`, and `ESB_CALLBACK_URL`.

Recommended public URL values:

- `ALLOWED_ORIGINS`: comma-separated customer and admin origins.
- `NEXT_PUBLIC_SOCKET_URL`: public `wapi-websocket-gateway` origin.
- `PUBLIC_API_URL`: public `wapi-api-gateway` origin.
- `WHATSAPP_WEBHOOK_URL`: public `wapi-api-gateway` origin.
- `ESB_CALLBACK_URL`: public API gateway origin plus `/api/v1/onboarding/bsp/callback`.

## Notes

- The Blueprint uses `starter` plans because private networking is part of the production topology. Downgrading internal services to public free web services exposes the microservices and should only be done for throwaway testing.
- Keep MongoDB outside Render, for example Atlas, because this app expects MongoDB and Render does not provision MongoDB through this Blueprint.
- First deploys may fail until every required `sync: false` value is filled. That is expected; these values are intentionally not committed.
