# Gupshup API Call Sequence

This document details the exact API calls made during onboarding, mapped to Gupshup endpoints.

## Sequence Steps

1. **Partner Login**
   - `POST /partner/account/login`
   - Returns JWT token (cache in Redis, refresh on expiry).

2. **Create App** (one-time per workspace)
   - `POST /partner/dashboard`
   - Body: `{ appName: "waba{workspaceId}{suffix}" }`
   - Returns `{ appId }`

3. **Set Contact Details**
   - `PUT /partner/dashboard/{appId}/onboarding/contact`
   - Body: `{ email, name, phone }`

4. **Get App Token**
   - `GET /partner/dashboard/{appId}/token`
   - Returns `{ token: "sk_xxx" }`
   - Encrypt with AES-256-CBC, store in `workspace.gupshupIdentity.appApiKey`.

5. **Set V3 Subscriptions**
   - `POST /partner/dashboard/{appId}/subscription`
   - Body: `{ url: webhookUrl, version: "v3", events: ["message-event", "user-event", "billing-event", "system-event"] }`

6. **Generate Embed Link**
   - `GET /partner/dashboard/{appId}/onboarding/embed/link`
   - Returns `{ link: "https://partner.gupshup.io/embed/signup?token=..." }`

7. **[After callback] Whitelist WABA**
   - `POST /partner/dashboard/{appId}/oboToEmbed/whitelist`
   - Body: `{ wabaId }`

8. **[After callback] Verify Credit Line**
   - `GET /partner/dashboard/{appId}/oboToEmbed/verify`

9. **[Post-onboarding] Sync WABA Info**
   - `GET /partner/dashboard/{appId}/wabaInfo`
   - `GET /partner/dashboard/{appId}/health`
   - `GET /partner/dashboard/{appId}/wallet/balance`
