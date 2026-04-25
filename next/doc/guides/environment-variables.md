# Environment Variables Reference

This document lists all environment variables used in the wApi project and their purposes.

## Core Configuration
- `NODE_ENV`: Application environment (`development`, `production`, `test`).
- `PORT`: Server port (default: `3000`).
- `MONGODB_URI`: Connection string for MongoDB.
- `REDIS_URL`: Connection string for Redis (used for BullMQ and Caching).
- `JWT_SECRET`: Secret key for signing authentication tokens.
- `NEXT_PUBLIC_APP_URL`: The public base URL of the application.

## WhatsApp / Gupshup Integration
- `GUPSHUP_API_KEY`: API key for sending messages via Gupshup.
- `GUPSHUP_PARTNER_TOKEN`: Token for Gupshup Partner API access.
- `GUPSHUP_PARTNER_EMAIL` / `GUPSHUP_PARTNER_PASSWORD`: Credentials for partner account.
- `WHATSAPP_WEBHOOK_URL`: The URL where Meta/Gupshup should send events.
- `WHATSAPP_WEBHOOK_SECRET`: Secret used to verify incoming webhook signatures.

## Authentication (Social & OAuth)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: For Google Social Login.
- `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`: For Facebook/Instagram integration.

## Communication & OTP
- `MSG91_AUTH_KEY`: For SMS OTP delivery (if used).
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: For email delivery and verification.
- `EMAIL_FROM`: The sender address for system emails.

## Business Verification
- `BUSINESS_VERIFICATION_MANDATORY`: Boolean flag to enforce business info validation.
- `KARZA_API_KEY`: For PAN/MSME verification services.
- `CLEARTAX_API_KEY`: For GST verification services.

## Payments (Razorpay)
- `RAZORPAY_KEY_ID`: Your Razorpay API Key ID.
- `RAZORPAY_KEY_SECRET`: Your Razorpay API Secret.

## System Flags
- `SKIP_REDIS`: If set to `true`, background workers and caching will be bypassed (development only).
- `COOKIE_SECURE`: Ensures auth cookies are only sent over HTTPS.
- `INTEGRATION_ENCRYPTION_KEY`: Used to encrypt sensitive credentials (like Gupshup app keys) at rest.
