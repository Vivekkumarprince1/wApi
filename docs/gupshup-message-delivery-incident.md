# Gupshup Message Delivery Incident Fix

## Root cause summary

The delivery pipeline had three primary defects:

1. The central outbound transport was posting Meta Cloud-style payloads to the Gupshup Partner V3 endpoint. The correct Gupshup partner envelope is:
   - `channel`
   - `source`
   - `destination`
   - `src.name`
   - nested `message`

2. Several controller and fallback paths marked messages as `sent` immediately after receiving a provider acceptance ID. That made the SaaS UI show success even when no downstream delivery webhook ever confirmed `sent`, `delivered`, or `read`.

3. Retry handling existed for request-time failures, but provider delivery failures and webhook timeouts were not automatically re-queued.

## Implemented fixes

### Transport fixes

- Updated `server/src/services/bsp/gupshupService.js` to send text, template, media, and interactive messages using the Gupshup Partner V3 envelope.
- Removed the hardcoded partner URL in template send and standardized on `bspConfig.partnerBaseUrl`.
- Added auth header fallbacks for partner calls and stable provider message ID extraction.
- Ensured media and interactive sends use the same decrypted app credential flow as text/template sends.

### Delivery state machine fixes

- Outbound messages now remain `queued` on provider acceptance.
- `sentAt` is only set after webhook confirmation of `sent`.
- Controller, inbox, campaign, and workflow fallback paths no longer stamp `sent` optimistically.
- Provider acceptance timestamps are stored in metadata as `providerAcceptedAt` for diagnostics.

### Retry and monitoring fixes

- Failed delivery webhooks now enqueue retries with the existing exponential backoff queue.
- Queued messages that never receive a webhook transition to `unknown` and are re-queued automatically.
- Message metrics now expose:
  - queue backlog
  - stuck queued messages
  - failure rate
  - top failure reasons
  - message-type mix
  - country distribution
  - provider configuration checks
- The main dashboard surfaces delivery health so operators can detect patterns without digging through logs.

## Account validation checklist

Verify the following in every affected workspace:

1. `partnerAppId` exists for the active Gupshup connection.
2. `gupshupIdentity.appApiKey` is stored and decrypts correctly.
3. `bspPhoneNumberId` is present and maps to the active routed number.
4. The webhook URL is public HTTPS and reachable by Gupshup.
5. The workspace is `bspManaged` and `whatsappConnected`.
6. Business/WABA status is `VERIFIED`, `APPROVED`, or `LIVE`.
7. Template sends use templates whose local `partnerAppId` matches the current workspace app.
8. Local template status is `APPROVED` before dispatch.

## Recommended live test matrix

Run these tests after deployment:

1. Session text to one domestic number and one international number.
2. Approved utility template to one new contact and one existing contact.
3. Media sends for image and document using public HTTPS assets.
4. Delivery checks for `queued -> sent -> delivered -> read` transitions.
5. Forced failure test using an invalid recipient or expired template to confirm retry queue behavior.

## Files changed

- `server/src/services/bsp/gupshupService.js`
- `server/src/services/bsp/bspMessagingService.js`
- `server/src/controllers/bsp/gupshupWebhookController.js`
- `server/src/controllers/messaging/messageController.js`
- `server/src/services/messaging/inboxMessageService.js`
- `server/src/services/automation/workflowExecutionService.js`
- `server/src/services/campaign/campaignWorkerService.js`
- `server/src/controllers/analytics/metricsController.js`
- `client/components/dashboard/HomeDashboard.tsx`