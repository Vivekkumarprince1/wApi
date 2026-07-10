# Instagram Customer Onboarding

This is the customer-facing flow for selling Instagram as a paid ConnectSphere add-on, similar to products that let a business connect Meta channels without handling API setup themselves.

## Meta Setup

Create or reuse one Meta app for ConnectSphere and configure:

- Instagram API setup with Instagram Login.
- Business Login for Instagram.
- OAuth redirect URI: `https://YOUR_API_DOMAIN/api/v1/integrations/instagram/callback`.
- Webhooks callback URL on your public API domain.
- Webhooks verify token in the Meta App Dashboard and in your webhook receiver.
- Advanced Access for every permission you request in production.

Recommended scopes:

```txt
instagram_business_basic
instagram_business_manage_messages
instagram_business_manage_comments
```

Recommended webhook fields:

```txt
messages,message_reactions,message_echoes,comments
```

## ConnectSphere Environment

Set Meta provider credentials on `service-provider`:

```env
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
INSTAGRAM_API_VERSION=v25.0
INSTAGRAM_SCOPES=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments
INSTAGRAM_SUBSCRIBED_FIELDS=messages,message_reactions,message_echoes,comments
```

Set customer onboarding and pricing values on `automation-service`:

```env
INSTAGRAM_REDIRECT_URI=https://YOUR_API_DOMAIN/api/v1/integrations/instagram/callback
INSTAGRAM_ADDON_PLAN_SLUG=instagram-business
INSTAGRAM_ADDON_PRICE_PAISE=0
INSTAGRAM_ADDON_CURRENCY=INR
BSP_SERVICE_URL=http://service-provider:3004
```

## Customer Flow

1. Customer buys your Instagram plan/add-on in ConnectSphere billing.
2. Customer opens `Integrations -> Instagram Business`.
3. ConnectSphere sends the customer to Meta Business Login for Instagram.
4. Meta redirects back with an authorization code.
5. `automation-service` sends the OAuth code to `service-provider`.
6. `service-provider` exchanges the code for a short-lived token, exchanges that for a 60-day token, fetches the profile, and subscribes webhook fields.
7. `automation-service` stores the returned long-lived token encrypted in the existing `Integration` model.
8. ConnectSphere stores profile metadata and the provider webhook subscription result.
9. The customer sees either `Ready` or `Needs webhook setup`.

## Important Behavior

- OAuth success and webhook success are tracked separately.
- If Meta rejects webhook subscription, the integration is saved as `pending` with the exact Meta error in metadata.
- Token refresh is available from the customer modal, and the integration scheduler refreshes expiring tokens daily during the final 7 days before expiry.
- Incoming Meta webhook delivery still requires the public webhook receiver to route payloads by Instagram account ID to the matching workspace.

## Billing Note

The integration exposes `INSTAGRAM_ADDON_PLAN_SLUG`, price, and currency to the customer portal. The modal only starts Meta OAuth when the current workspace plan slug matches the add-on slug or the plan includes the `INSTAGRAM` or `ALL` feature.
