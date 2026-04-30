# Deployment Guide

This document outlines the steps required to deploy wApi to a production environment.

## 1. Production Requirements
- **Node.js Environment**: A server or container capable of running Node.js 18+.
- **Database**: MongoDB Cluster (e.g., MongoDB Atlas).
- **Cache/Queue**: Redis instance (e.g., Upstash or self-hosted).
- **Reverse Proxy**: Nginx or a platform like Vercel/Railway.

## 2. Environment Variables
Ensure all production variables are set. Key differences from local setup:
- `NODE_ENV=production`
- `COOKIE_SECURE=true`
- `NEXT_PUBLIC_APP_URL`: Must be the production domain (HTTPS).
- `MONGODB_URI` & `REDIS_URL`: Use production connection strings.

## 3. Build & Start
```bash
# Install production dependencies
npm ci

# Build the Next.js application
npm run build

# Start the production server
npm start
```

## 4. Background Workers (Critical)
In production, the background workers must run in a persistent process. We recommend using **PM2** or a separate container for this:
```bash
# Example using PM2
pm2 start npm --name "wapi-web" -- start
pm2 start npm --name "wapi-workers" -- run workers
```

## 5. SSL & Webhooks
- **SSL**: Ensure your production domain is served over HTTPS. WhatsApp will not send webhooks to non-secure URLs.
- **Webhook Registration**: After deploying, ensure your `WHATSAPP_WEBHOOK_URL` is correctly registered in the Gupshup/Meta partner dashboard.

## 6. Monitoring
- **Logs**: Use a logging service (like Sentry or Datadog) to monitor for errors.
- **Redis Monitoring**: Keep an eye on job failure rates in the BullMQ queues.
