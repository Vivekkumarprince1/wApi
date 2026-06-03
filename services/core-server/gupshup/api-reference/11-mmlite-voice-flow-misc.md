# Gupshup Partner API Reference: MM Lite, Voice, Flow Management & Misc APIs

Base URL: `https://partner.gupshup.io`

---

## MM Lite APIs

### 1. Enable MM Lite Messages
**`POST /app/{appId}/mmlite/msg/enable`**

Enables the V2 MM Lite routing flag. Marketing messages sent via V2 will then be auto-routed through MM Lite.

**Rate Limit**: 2 per hour per app.

```bash
curl --request POST \
  --url https://partner.gupshup.io/app/{appId}/mmlite/msg/enable \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/post_app-appid-mmlite-msg-enable)

### 2. MM Lite Send Message (V3)
**`POST /partner/app/{appId}/v3/mmlite/message`**

Dedicated V3 endpoint for MM Lite marketing messages. Uses the same payload format as V3 send message API.

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/v3/mmlite/message \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "messaging_product": "whatsapp",
    "to": "919876543210",
    "type": "template",
    "template": {
      "name": "marketing_template",
      "language": { "code": "en" },
      "components": [...]
    }
  }'
```

[Source](https://partner-docs.gupshup.io/reference/mmlitesendmessage)

### 3. Send MM Lite Message with GIF Template
[Source](https://partner-docs.gupshup.io/reference/sendmmlitegiftemplatemessage)

### 4. Get Template Ad Details
**`GET /partner/app/{appId}/template/adDetails`**

Returns MM Lite ad-related metadata for a template.

[Source](https://partner-docs.gupshup.io/reference/gettemplateaddetails)

### 5. Get Template Ad Insight
**`GET /partner/app/{appId}/template/insights`**

Returns MM Lite performance metrics: sent, delivered, read, clicks, spend, CPD, CPClick, add-to-cart, purchases.

```bash
curl --request GET \
  --url 'https://partner.gupshup.io/partner/app/{appId}/template/insights?templateName=my_template&startDate=2025-01-01&endDate=2025-01-31' \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/gettemplateinsights)

### 6. Get MM Lite Link (On-boarding for Live App)
**`GET /partner/app/{appId}/mmlite/link`**

Returns the MM Lite onboarding link for an already live application.

[Source](https://partner-docs.gupshup.io/reference/getmmlitelink)

---

## WhatsApp Voice APIs

### Enable/Disable WhatsApp Voice Calling
**`POST /partner/app/{appId}/voice`**

Toggles WhatsApp voice calling capability for an application.

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/voice \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "enabled": true }'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-voice)

---

## Flow Management APIs (Meta Passthrough V3)

| Operation | Method | Endpoint | Source |
|-----------|--------|----------|--------|
| Create Flow | POST | `/partner/app/{appId}/flow` | [Ref](https://partner-docs.gupshup.io/reference/createflow) |
| Get Flow | GET | `/partner/app/{appId}/flow/{flowId}` | [Ref](https://partner-docs.gupshup.io/reference/getflowbyid) |
| Get All Flows | GET | `/partner/app/{appId}/flow` | [Ref](https://partner-docs.gupshup.io/reference/getallflow) |
| Update Flow | PUT | `/partner/app/{appId}/flow/{flowId}` | [Ref](https://partner-docs.gupshup.io/reference/updateflow) |
| Get Flow JSON | GET | `/partner/app/{appId}/flow/{flowId}/json` | [Ref](https://partner-docs.gupshup.io/reference/getflowjson) |
| Update Flow JSON | PUT | `/partner/app/{appId}/flow/{flowId}/json` | [Ref](https://partner-docs.gupshup.io/reference/updateflowjson) |
| Get Preview URL | GET | `/partner/app/{appId}/flow/{flowId}/preview` | [Ref](https://partner-docs.gupshup.io/reference/getpreviewurl) |
| Publish Flow | POST | `/partner/app/{appId}/flow/{flowId}/publish` | [Ref](https://partner-docs.gupshup.io/reference/publishflow) |
| Deprecate Flow | POST | `/partner/app/{appId}/flow/{flowId}/deprecate` | [Ref](https://partner-docs.gupshup.io/reference/deprecateflow) |
| Delete Flow | DELETE | `/partner/app/{appId}/flow/{flowId}` | [Ref](https://partner-docs.gupshup.io/reference/deleteflow) |

---

## Mark as Read / Typing Indicator

**`POST /partner/app/{appId}/v3/message/action`**

Marks a message as read and/or sends a typing indicator.

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/v3/message/action \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "messaging_product": "whatsapp",
    "status": "read",
    "message_id": "wamid.HBgLMTIzNDU2Nzg5MAA..."
  }'
```

### Typing Indicator
```json
{
  "messaging_product": "whatsapp",
  "status": "typing",
  "message_id": "wamid.HBgLMTIzNDU2Nzg5MAA..."
}
```

**Duration**: Auto-dismissed after 25 seconds or when a response is sent.

[Source](https://partner-docs.gupshup.io/reference/voicecallaction-1)

---

## WABA Management Portal API

### Get WABA Management Details
**`GET /partner/app/{appId}/waba/management`**

[Source](https://partner-docs.gupshup.io/reference/waba-management-1)
