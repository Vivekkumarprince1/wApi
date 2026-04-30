# Gupshup Partner API Reference: Subscription Management

Base URL: `https://partner.gupshup.io`

---

## 1. Get All Subscriptions
**`GET /partner/app/{appId}/subscription`**

Retrieves all current webhook subscription configurations for a partner application. Returns subscribed event types, webhook URL, status, and metadata.

### Example Request (cURL)
```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/subscription \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

### Example Response (200 OK)
```json
{
  "status": "success",
  "subscriptions": [
    {
      "subscriptionId": "sub_123",
      "version": "v3",
      "url": "https://yourserver.com/webhook",
      "events": ["message-event", "user-event", "billing-event", "system-event"],
      "status": "ACTIVE"
    }
  ]
}
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-subscription)

---

## 2. Get Specific App Subscription
**`GET /partner/app/{appId}/subscription/{subscriptionId}`**

Retrieves details for a specific subscription.

### Example Request (cURL)
```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/subscription/{subscriptionId} \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-subscription-subscriptionid)

---

## 3. Set Subscription for an App (V3)
**`POST /partner/app/{appId}/subscription`**

Creates a new webhook subscription for an app. Use V3 for Meta passthrough format events.

### Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Webhook URL to receive events |
| `version` | string | Yes | `v2` or `v3` |
| `events` | array | Yes | Event types to subscribe to |

### Example Request (cURL)
```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/subscription \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "url": "https://yourserver.com/webhook/v3",
    "version": "v3",
    "events": ["message-event", "user-event", "billing-event", "system-event"]
  }'
```

### Example Response (200 OK)
```json
{
  "status": "success",
  "subscription": {
    "subscriptionId": "sub_new_456",
    "version": "v3",
    "url": "https://yourserver.com/webhook/v3",
    "status": "ACTIVE"
  }
}
```

[Source](https://partner-docs.gupshup.io/reference/setsubscription-api-v3)

---

## 4. Update App Subscription
**`PUT /partner/app/{appId}/subscription/{subscriptionId}`**

Updates an existing subscription's URL or event types.

### Example Request (cURL)
```bash
curl --request PUT \
  --url https://partner.gupshup.io/partner/app/{appId}/subscription/{subscriptionId} \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "url": "https://newserver.com/webhook" }'
```

[Source](https://partner-docs.gupshup.io/reference/put_partner-app-appid-subscription-subscriptionid)

---

## 5. Delete Specific Subscription
**`DELETE /partner/app/{appId}/subscription/{subscriptionId}`**

Removes a specific subscription.

### Example Request (cURL)
```bash
curl --request DELETE \
  --url https://partner.gupshup.io/partner/app/{appId}/subscription/{subscriptionId} \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/delete_partner-app-appid-subscription-subscriptionid)

---

## 6. Delete All Subscriptions
**`DELETE /partner/app/{appId}/subscription`**

Removes all subscriptions for an app.

### Example Request (cURL)
```bash
curl --request DELETE \
  --url https://partner.gupshup.io/partner/app/{appId}/subscription \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/delete_partner-app-appid-subscription)
