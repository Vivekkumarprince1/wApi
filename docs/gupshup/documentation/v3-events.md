# Inbound Events (V3)

V3 events provide meta-native status structures and payloads.

## Enqueued Event (V3)
```json
{
  "entry": [
    {
      "changes": [
        {
          "field": "messages",
          "value": {
            "statuses": [
              {
                "gs_id": "GS_ID",
                "id": "WAMID",
                "status": "enqueued",
                "timestamp": 1710941393420
              }
            ]
          }
        }
      ]
    }
  ]
}
```

## Sent Event (V3)
Includes conversation expiration markers and Meta-specific IDs.
```json
{
  "statuses": [
    {
      "conversation": { "expiration_timestamp": "...", "id": "..." },
      "gs_id": "...",
      "status": "sent"
    }
  ]
}
```

## Failed Event (V3)
Includes detailed Meta error codes and descriptions.
```json
{
  "statuses": [
    {
      "errors": [
        { "code": 131047, "title": "Message failed to send..." }
      ],
      "status": "failed"
    }
  ]
}
```

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/events)
