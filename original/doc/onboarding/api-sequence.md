# Gupshup API Call Sequence

This document details the exact API calls made during onboarding, mapped to Gupshup endpoints.

## Sequence Steps

1. **Partner Login**
   - `POST /partner/account/login`
   - Returns JWT token (cache in Redis, refresh on expiry).

2. **Create App** (one-time per workspace)
   - `POST /partner/app`
   - Body: `{ appName: "waba{workspaceId}{suffix}" }`
   - Returns `{ appId }`

3. **Set Contact Details**
   - `PUT /partner/app/{appId}/onboarding/contact`
   - Body: `{ email, name, phone }`

4. **Get App Token**
   - `GET /partner/app/{appId}/token`
   - Returns `{ token: "sk_xxx" }`
   - Encrypt with AES-256-CBC, store in `workspace.gupshupIdentity.appApiKey`.

5. **Set V3 Subscriptions**
   - `POST /partner/app/{appId}/subscription`
   - Body: `{ url: webhookUrl, version: "v3", events: ["message-event", "user-event", "billing-event", "system-event"] }`

6. **Generate Embed Link**
   - `GET /partner/app/{appId}/onboarding/embed/link`
   - Returns `{ link: "https://partner.gupshup.io/embed/signup?token=..." }`

7. **[After callback] Whitelist WABA**
   - `POST /partner/app/{appId}/oboToEmbed/whitelist`
   - Body: `{ wabaId }`

8. **[After callback] Verify Credit Line**
   - `GET /partner/app/{appId}/oboToEmbed/verify`

9. **[Post-onboarding] Sync WABA Info**
   - `GET /partner/app/{appId}/wabaInfo`
   - `GET /partner/app/{appId}/health`
   - `GET /partner/app/{appId}/wallet/balance`
