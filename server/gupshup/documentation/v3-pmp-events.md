# PMP Events (V3)

New event structures for the July 2025 Per Message Pricing rollout using V3 payloads.

## Key Payload Changes
- **pricing_model**: Updated value to `PMP`.
- **category**: Now included in the `pricing` object (e.g., marketing, service).
- **conversation**: Includes an `origin` object with the conversation type.

## Billing Payload (V3)
```json
{
  "field": "billing-event",
  "value": {
    "billing": {
      "deductions": {
        "billable": true,
        "model": "PMP",
        "category": "marketing"
      },
      "references": {
        "gs_id": "...",
        "id": "..."
      }
    }
  }
}
```

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/pmp-events)
