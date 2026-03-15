# Gupshup Lean Architecture

## Goal
Build the platform as a multi-tenant WhatsApp SaaS on top of Gupshup Partner APIs while keeping MongoDB as the system of record only for data that Gupshup cannot reliably replay or that is required for tenancy, billing, inbox UX, audit, and automation.

## Storage boundary

### Persist in MongoDB
These records are business-critical and should remain local:

1. **Tenant identity and routing**
   - `workspace._id`
   - `gupshupIdentity.partnerAppId`
   - encrypted `gupshupIdentity.appApiKey`
   - `wabaId`, `phoneNumberId`, `whatsappPhoneNumber`
   - `bspPhoneStatus`, `qualityRating`, `messagingLimitTier`
   - billing, quota, plan, RBAC, audit fields

2. **Inbox source of truth**
   - `Contact`
   - `Conversation`
   - `Message`
   - assignment history, unread state, SLA state, opt-out state

   Rationale: Gupshup Partner APIs do not provide a full replayable shared-inbox history with assignment state. Webhooks are the canonical event source, so the application must persist normalized inbound/outbound conversation history locally.

3. **Template authoring workflow**
   - local `Template` drafts
   - approval status / rejection reason
   - edit history and send history

   Rationale: drafts, forks, review state, and campaign usage are product concerns, not just BSP concerns.

4. **Billing, analytics, and audit**
   - usage ledgers
   - campaign message logs
   - webhook logs with retention TTL
   - admin audit logs

### Fetch live from Gupshup
These should be retrieved on demand instead of mirrored in MongoDB whenever possible:

1. Partner app details
2. WABA health / quality / MM Lite / ownership data
3. Subscription configuration
4. Approved provider template catalog
5. Wallet / rating / health endpoints
6. Business profile details stored by Gupshup
7. Media handles and provider-side template sync state

### Do not duplicate locally
Avoid storing or repeatedly syncing these as durable snapshots:

- full `phoneNumbers` arrays when one routed phone is already stored
- provider app snapshots copied wholesale into `Workspace`
- redundant business profile mirrors from sync jobs
- raw provider template payloads beyond what is needed for local authoring or audit
- message delivery metadata that can be derived from webhook-updated `Message`

## Entity decisions

| Entity | Local DB | Live from Gupshup | Reason |
|---|---|---|---|
| Workspace routing IDs | Yes | No | Required for tenant isolation |
| App token | Encrypted | Refreshable | Required for reliable API execution |
| Inbox messages | Yes | No | No replayable provider inbox API |
| Contact profile | Yes | Partial | Local CRM data extends provider identity |
| Template drafts | Yes | No | Product workflow data |
| Approved template catalog | Cached locally + live sync | Yes | Provider is source of truth for approval |
| WABA health / quality | Optional cache | Yes | Better fetched on demand |
| Subscriptions | No durable mirror | Yes | Configuration is provider-owned |
| Business profile | Optional editable cache | Yes | Provider is operational source |

## Implementation changes in this repository

1. Added a `gupshupDataBoundaryService` to:
   - normalize onboarding / sync payloads into a lean workspace projection
   - expose persisted-vs-live storage policy
   - build a live workspace runtime profile from Gupshup APIs
2. Onboarding completion and autosync now persist the lean projection instead of durable provider snapshots.
3. Added a runtime endpoint so the UI or ops tooling can fetch live app/WABA/subscription/template state without growing the workspace document.
4. Reworked message retry processing to retry via the active Gupshup BSP messaging service instead of legacy Meta-only code.

## Operational guidance

- Treat webhooks as the append-only source for inbox history.
- Treat Gupshup Partner APIs as the source for current app/WABA/subscription/template runtime state.
- Keep webhook logs time-bound with TTL.
- Never duplicate `phone_number_id` mappings across tenants.
- Prefer live reads for provider status screens; prefer local reads for inbox and analytics.














https://partner-docs.gupshup.io/reference/get_partner-app-appid-subscription
https://partner-docs.gupshup.io/reference/get_partner-app-appid-subscription-subscriptionid
https://partner-docs.gupshup.io/reference/setsubscription-api-v3
https://partner-docs.gupshup.io/reference/put_partner-app-appid-subscription-subscriptionid
https://partner-docs.gupshup.io/reference/delete_partner-app-appid-subscription-subscriptionid
https://partner-docs.gupshup.io/reference/delete_partner-app-appid-subscription
https://partner-docs.gupshup.io/reference/passthrough-apis
https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-12
https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-14

https://partner-docs.gupshup.io/reference/post_partner-app-appid-obotoembed-whitelist

https://partner-docs.gupshup.io/reference/get_partner-app-appid-obotoembed-verify
https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-14