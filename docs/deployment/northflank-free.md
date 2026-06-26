# Free Northflank Sandbox Deployment

Northflank's free Developer Sandbox is only suitable for a dev/demo deployment. The full production layout in `docs/deployment/northflank.md` uses too many services to be free.

This free setup uses:

- Service 1: bundled backend from `Dockerfile.northflank-free-backend`
- Service 2: customer portal from `apps/customer-portal/Dockerfile`
- Addon 1: MongoDB, or use an external free MongoDB provider
- Redis: ephemeral Redis running inside the bundled backend container

Do not use this layout for production. Redis data disappears when the backend container restarts, all backend services share one container, and the admin portal is intentionally omitted to stay within the free service count.

## Backend Service

Create one Northflank combined service:

- Name: `wapi-free-backend`
- Build type: Dockerfile
- Build context: repository root (`.`)
- Dockerfile path: `Dockerfile.northflank-free-backend`
- Port: `5001`
- Public: yes
- Health check: `/health`

Set these environment variables:

```env
NODE_ENV=production
PORT=5001
MONGO_URI=<your MongoDB addon or external MongoDB URI>
JWT_SECRET=<64+ random characters>
INTERNAL_SERVICE_SECRET=<64+ random characters>
INTEGRATION_ENCRYPTION_KEY=<random encryption key>
ALLOWED_ORIGINS=https://<customer-portal-domain>
NEXT_PUBLIC_APP_URL=https://<customer-portal-domain>
WEBHOOK_SECRET=<random webhook secret>
VERIFY_TOKEN=<random verify token>
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<random verify token>
RAZORPAY_KEY_ID=dummy-for-free-sandbox
RAZORPAY_KEY_SECRET=dummy-for-free-sandbox
RAZORPAY_WEBHOOK_SECRET=dummy-for-free-sandbox
GUPSHUP_PARTNER_EMAIL=dummy@example.com
GUPSHUP_PARTNER_CLIENT_SECRET=dummy-for-free-sandbox
GUPSHUP_WEBHOOK_SECRET=dummy-for-free-sandbox
```

Use real Razorpay/Gupshup values only if you are testing those flows.

## Customer Portal Service

Create the second Northflank combined service:

- Name: `wapi-free-customer-portal`
- Build type: Dockerfile
- Build context: repository root (`.`)
- Dockerfile path: `apps/customer-portal/Dockerfile`
- Port: `3000`
- Public: yes
- Health check: `/health`

Set these environment variables:

```env
NODE_ENV=production
PORT=3000
BACKEND_API_URL=https://<backend-domain>
NEXT_PUBLIC_APP_URL=https://<customer-portal-domain>
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SOCKET_URL=https://<backend-domain>
NEXT_PUBLIC_APP_NAME=wApi
NEXT_PUBLIC_BUSINESS_VERIFICATION_MANDATORY=false
```

## Free Checklist

- Create no more than two Northflank services.
- Create no more than one Northflank addon.
- Keep the admin portal, separate microservice layout, managed Redis, and extra public webhook/socket services out of the sandbox deployment.
- Stop or delete the sandbox services when you are done testing.
