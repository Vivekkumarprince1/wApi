# Production Environment

Generate shared production secrets before starting any production service:

```bash
bash scripts/generate-production-secrets.sh
```

Set the generated values in your hosting provider. Do not commit generated values.

`JWT_SECRET` must be the same value for:
- `auth-service`
- `campaign-service`
- `contact-service`
- `chat-service`
- `billing-service`
- `automation-service`
- `service-provider`
- `websocket-gateway`
- `admin-portal`

`INTERNAL_SERVICE_SECRET` must be the same value for:
- `api-gateway`
- `auth-service`
- `campaign-service`
- `contact-service`
- `chat-service`
- `billing-service`
- `automation-service`
- `service-provider`
- `webhook-ingestor`
- `admin-portal`

`INTEGRATION_ENCRYPTION_KEY` must be the same value for services that encrypt integration data:
- `automation-service`
- `service-provider`

The example values in `.env.example` files are placeholders only. Production services intentionally fail fast when these secrets are missing or left as default placeholders.
