# System Events

System events are platform-generated notifications for state changes in templates or accounts.

## Template Events
Triggered when a template is approved, rejected, deleted, or paused.
- **Status**: approved, rejected, deleted, disabled, in_appeal, paused.
- **Pause Reason**: e.g., "Paused for 3 hours... because it had issues."

## Account Events
Triggered for WABA or phone number updates.
- **review-event**: APPROVED or REJECTED statuses for WABA.
- **status-event**: ACCOUNT_VIOLATION, ACCOUNT_DISABLE, ACCOUNT_VERIFIED, ACCOUNT_RESTRICTED.
- **pndn-event**: Display name/Phone status updates (INVALID_FORMAT, NAME_NOT_CONSISTENT, etc.).
- **tier-event**: Phone quality status updates (UPGRADE, DOWNGRADE, FLAGGED, UNFLAGGED).
- **capability-event**: Updates on messaging limits (e.g., `maxDailyConversationPerPhone`).

## Go-Live Event
Sent to the callback when an app completes onboarding.
```json
{
  "app": "APP_NAME",
  "type": "onboarding-event",
  "payload": {
    "type": "docker-status-event",
    "payload": {
      "status": "live",
      "waId": "WABA_ID",
      "namespace" : "META-NAMESPACE"
    }
  }
}
```

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/system-events)
