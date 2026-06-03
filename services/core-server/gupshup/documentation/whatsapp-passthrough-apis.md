# WhatsApp Passthrough APIs (Beta)

Gupshup Passthrough APIs imitate Meta's native format, allowing for faster feature rollouts and easier migration from other BSPs.

## Objective & Scope
- **Format**: Uses Meta's raw JSON structure for sending template and session messages.
- **Webhooks**: Supports a new V3 subscription format for raw incoming events.
- **Billing**: Supports both prepaid and postpaid models.
- **Limitations**: Does not currently support template creation/management in Meta format (out of scope).

## Implementation
- **V3 Subscription**: Mandatory to receive events in Meta format.
- **Deduplication**: If subscribed to both V2 and V3, events may be duplicated. Partners must implement deduplication logic.

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/whatsapp-passthrough-apis-for-partners)
