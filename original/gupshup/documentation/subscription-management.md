# Subscription Management & V3 Payloads

To manage subscriptions effectively, use the Subscription API. Gupshup now supports V3 (Meta Cloud) payloads for statuses and messages.

## Event - V3 - Status
Triggered when a message status changes (sent, delivered, read, etc.).
```json
{
  "entry": [
    {
      "changes": [
        {
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "918375031069",
              "phone_number_id": "207437372456043"
            },
            "statuses": [
              {
                "gs_id": "3de985af-d06e-41e1-acaf-c379b429668a",
                "id": "fc46fadf-5075-4bb6-9cff-f3ff8c6f6478",
                "recipient_id": "919970754444",
                "status": "read",
                "timestamp": "1705574869"
              }
            ]
          }
        }
      ],
      "id": "216141188246170"
    }
  ],
  "gs_app_id": "bf9ee64c-3d4d-4ac4-8668-732e577007c4",
  "object": "whatsapp_business_account"
}
```

## Event - V3 - Message
Triggered when a new message is received from a customer.
```json
{
  "entry": [
    {
      "changes": [
        {
          "field": "messages",
          "value": {
            "contacts": [
              {
                "profile": { "name": "Sneha" },
                "wa_id": "91997075****"
              }
            ],
            "messages": [
              {
                "from": "91997075***",
                "id": "wamid.HBgMOTE5OTcwNzU0NDQ0FQIAEhgUM0E1NjIzMTY1N0VGNUE5NjY1M0EA",
                "text": { "body": "Hi" },
                "timestamp": "1705574871",
                "type": "text"
              }
            ],
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "918375031069",
              "phone_number_id": "207437372456043"
            }
          }
        }
      ],
      "id": "216141188246170"
    }
  ],
  "gs_app_id": "bf9ee64c-3d4d-4ac4-8668-732e577007c4",
  "object": "whatsapp_business_account"
}
```

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/set-callback-url-1)
