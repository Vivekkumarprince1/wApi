# BSP Service

NestJS microservice for BSP/provider operations. This service owns Gupshup app lifecycle, partner/app tokens, onboarding, subscriptions, provider message dispatch, templates, media, profiles, webhook ingestion, and provider health.

## Local

```bash
npm install
npm run dev
```

Default port: `3004`

## Main Internal APIs

- `POST /internal/v1/bsp/apps`
- `GET /internal/v1/bsp/apps/:appId`
- `DELETE /internal/v1/bsp/apps/:appId`
- `POST /internal/v1/bsp/apps/:appId/token/refresh`
- `POST /internal/v1/bsp/onboarding/start`
- `POST /internal/v1/bsp/onboarding/complete`
- `POST /internal/v1/bsp/phones/register`
- `POST /internal/v1/bsp/subscriptions`
- `DELETE /internal/v1/bsp/subscriptions/:id`
- `POST /internal/v1/bsp/messages/send`
- `POST /internal/v1/bsp/templates/sync`
- `POST /internal/v1/bsp/templates/:id/submit`
- `POST /internal/v1/bsp/media`
- `GET /internal/v1/bsp/profile/:appId`
- `PATCH /internal/v1/bsp/profile/:appId`
- `POST /internal/v1/bsp/provider/actions`
- `POST /webhooks/gupshup`
