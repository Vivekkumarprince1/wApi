# Billing Events

Billing events inform whether a conversation is billable and detail the deductions.

## Sample Payload Structure
```json
{
  "entry": [
    {
      "changes": [
        {
          "field": "billing-event",
          "value": {
            "billing": {
              "deductions": {
                "billable": "true/false",
                "conversation_type": "MESSAGE/CALL",
                "source": "whatsapp/gupshup",
                "category": "marketing/service/etc"
              },
              "references": {
                "id": "CONVERSATION_OR_CALL_ID",
                "destination": "RECIPIENT_PHONE",
                "direction": "USER_INITIATED/BUSINESS_INITIATED",
                "duration": "seconds (for calls)"
              }
            }
          }
        }
      ]
    }
  ],
  "gs_app_id": "APP_ID"
}
```

## Key Notes
- **Service Conversations**: As of Nov 1st, Meta fees are not charged for service conversations (`billable: false`).
- **Source**: Can be `whatsapp` (Meta fees) or `gupshup` (Gupshup markup/fees).

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/billing-events)
