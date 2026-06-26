# Deploying wApi on Northflank

wApi deploys to Northflank as separate combined services built from this repository's existing Dockerfiles. Use the repository root as the build context for every service, because several services depend on `packages/contracts`.

## Cost Note

This production-style layout is not a free Northflank deployment. It creates 12 services plus data infrastructure, which is intentionally beyond the free Developer Sandbox. For a free dev/demo deployment, use `docs/deployment/northflank-free.md` instead.

## Prerequisites

- A MongoDB connection string for each logical database, or one shared MongoDB cluster with the database names in the example environment file.
- A Redis instance reachable from Northflank.
- Public domains for the customer portal, admin portal, API gateway, socket gateway, and webhook ingestor.
- A Northflank secret group created from `.env.northflank.example`.

## Service Matrix

Create these Northflank combined services from the same Git repository:

| Service | Dockerfile | Port | Public | Health check |
| --- | --- | ---: | --- | --- |
| `api-gateway` | `services/api-gateway/Dockerfile` | `5001` | Yes | `/health` |
| `auth-service` | `services/auth-service/Dockerfile` | `3006` | No | `/health` |
| `contact-service` | `services/contact-service/Dockerfile` | `3007` | No | `/health` |
| `chat-service` | `services/chat-service/Dockerfile` | `3008` | No | `/health` |
| `billing-service` | `services/billing-service/Dockerfile` | `3003` | No | `/health` |
| `campaign-service` | `services/campaign-service/Dockerfile` | `3002` | No | `/health` |
| `automation-service` | `services/automation-service/Dockerfile` | `3001` | No | `/health` |
| `service-provider` | `services/service-provider/Dockerfile` | `3004` | No | `/health` |
| `webhook-ingestor` | `services/webhook-ingestor/Dockerfile` | `3013` | Yes | `/health` |
| `websocket-gateway` | `services/websocket-gateway/Dockerfile` | `3009` | Yes | `/health` |
| `customer-portal` | `apps/customer-portal/Dockerfile` | `3000` | Yes | `/health` |
| `admin-portal` | `apps/admin-portal/Dockerfile` | `3100` | Yes | `/health` |

## Build Settings

For every service:

- Build type: Dockerfile
- Build context: repository root (`.`)
- Dockerfile path: use the path from the matrix
- Health check path: `/health`
- Environment: attach the shared secret group, then add the service-specific values below

## Service Environment

Attach the shared secret group to every service, then set these values per service. When a value says "same as" another variable, paste the actual value from the secret group unless your Northflank project explicitly supports runtime variable expansion.

### `api-gateway`

```env
PORT=5001
AUTH_SERVICE_URL=http://auth-service:3006
CONTACT_SERVICE_URL=http://contact-service:3007
CHAT_SERVICE_URL=http://chat-service:3008
SERVICE_PROVIDER_URL=http://service-provider:3004
AUTOMATION_SERVICE_URL=http://automation-service:3001
BILLING_SERVICE_URL=http://billing-service:3003
CAMPAIGN_SERVICE_URL=http://campaign-service:3002
WEBSOCKET_URL=http://websocket-gateway:3009
WEBHOOK_INGESTOR_URL=http://webhook-ingestor:3013
```

### `auth-service`

```env
PORT=3006
MONGO_URI=<same as MONGO_URI_AUTH>
NEXT_PUBLIC_APP_URL=<same as CUSTOMER_PORTAL_URL>
```

### `contact-service`

```env
PORT=3007
MONGO_URI=<same as MONGO_URI_CONTACT>
AUTH_MONGO_URI=<same as MONGO_URI_AUTH>
```

### `chat-service`

```env
PORT=3008
MONGO_URI=<same as MONGO_URI_CHAT>
BILLING_SERVICE_URL=http://billing-service:3003
```

### `billing-service`

```env
PORT=3003
MONGO_URI=<same as MONGO_URI_BILLING>
BSP_SERVICE_URL=http://service-provider:3004
```

### `campaign-service`

```env
PORT=3002
MONGO_URI=<same as MONGO_URI_CAMPAIGN>
BILLING_SERVICE_URL=http://billing-service:3003
BSP_SERVICE_URL=http://service-provider:3004
MONOLITH_URL=http://api-gateway:5001
```

### `automation-service`

```env
PORT=3001
MONGO_URI=<same as MONGO_URI_AUTOMATION>
MONOLITH_INTERNAL_URL=http://api-gateway:5001
BSP_SERVICE_URL=http://service-provider:3004
```

### `service-provider`

```env
PORT=3004
MONGO_URI=<same as MONGO_URI_BSP>
MAIN_SERVICE_URL=http://api-gateway:5001
CAMPAIGN_SERVICE_URL=http://campaign-service:3002
BILLING_SERVICE_URL=http://billing-service:3003
```

### `webhook-ingestor`

```env
PORT=3013
MONGO_URI=<same as MONGO_URI_WEBHOOK>
```

### `websocket-gateway`

```env
PORT=3009
MONGO_URI=<same as MONGO_URI_WEBSOCKET>
```

### `customer-portal`

```env
PORT=3000
BACKEND_API_URL=http://api-gateway:5001
NEXT_PUBLIC_APP_URL=<same as CUSTOMER_PORTAL_URL>
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SOCKET_URL=<same as PUBLIC_SOCKET_URL>
NEXT_PUBLIC_ADMIN_PORTAL_URL=<same as ADMIN_PORTAL_URL>
```

### `admin-portal`

```env
PORT=3100
GATEWAY_URL=http://api-gateway:5001
BACKEND_API_URL=http://api-gateway:5001
CUSTOMER_PORTAL_URL=<same as CUSTOMER_PORTAL_URL>
NEXT_PUBLIC_APP_URL=<same as ADMIN_PORTAL_URL>
MONGO_URI=<same as MONGO_URI_AUTH>
```

## Deploy Order

1. Create MongoDB and Redis first.
2. Create the backend services with public networking disabled.
3. Deploy `api-gateway`, `webhook-ingestor`, and `websocket-gateway` with public networking enabled.
4. Deploy `customer-portal` and `admin-portal`.
5. Update `ALLOWED_ORIGINS`, `PUBLIC_SOCKET_URL`, and provider webhook URLs to use the final Northflank domains.

## Notes

- Do not deploy the development `mongodb` and `redis` services from `docker-compose.yml` to Northflank. Use managed/persistent services instead.
- Keep `JWT_SECRET`, `INTERNAL_SERVICE_SECRET`, and `INTEGRATION_ENCRYPTION_KEY` identical across all services.
- `api-gateway` refuses to start in production if `ALLOWED_ORIGINS` contains localhost values or if `INTERNAL_SERVICE_SECRET` is shorter than 32 characters.
- If your Northflank internal hostnames differ from service names, replace the `http://service-name:port` URLs with Northflank's internal DNS names.
