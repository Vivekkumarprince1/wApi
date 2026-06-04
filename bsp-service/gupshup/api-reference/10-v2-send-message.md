# Gupshup Partner API Reference: V2 Send Message APIs

Base URL: `https://partner.gupshup.io`

The V2 APIs use Gupshup's native format. These are being gradually replaced by V3 passthrough APIs.

---

## 1. Send Message with Template ID
**`POST /partner/app/{appId}/template/msg`**

Sends a template message using the Gupshup V2 format.

### Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source` | string | Yes | Registered phone number (with country code) |
| `destination` | string | Yes | Recipient phone number |
| `template` | object | Yes | Template details (id, params) |

### Example Request (cURL)
```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/template/msg \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "source": "919876543210",
    "destination": "919123456789",
    "template": {
      "id": "template_id_123",
      "params": ["John", "MyBrand"]
    }
  }'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-template-msg)

---

## V2 Template Message Examples

| Template Type | Endpoint |
|--------------|----------|
| GIF | [/reference/sendgiftemplatemessage](https://partner-docs.gupshup.io/reference/sendgiftemplatemessage) |
| Text | [/reference/post_partner-app-appid-template-msg-1](https://partner-docs.gupshup.io/reference/post_partner-app-appid-template-msg-1) |
| Image | [/reference/post_partner-app-appid-template-msg-4](https://partner-docs.gupshup.io/reference/post_partner-app-appid-template-msg-4) |
| Video | [/reference/post_partner-app-appid-template-msg-3](https://partner-docs.gupshup.io/reference/post_partner-app-appid-template-msg-3) |
| Location | [/reference/post_partner-app-appid-msg](https://partner-docs.gupshup.io/reference/post_partner-app-appid-msg) |
| Product | [/reference/post_partner-app-appid-template-msg-9](https://partner-docs.gupshup.io/reference/post_partner-app-appid-template-msg-9) |
| Catalog | [/reference/post_partner-app-appid-template-msg-5](https://partner-docs.gupshup.io/reference/post_partner-app-appid-template-msg-5) |
| Carousel (Image) | [/reference/post_partner-app-appid-template-msg-8](https://partner-docs.gupshup.io/reference/post_partner-app-appid-template-msg-8) |
| Carousel (Video) | [/reference/post_partner-app-appid-template-msg-7](https://partner-docs.gupshup.io/reference/post_partner-app-appid-template-msg-7) |
| Document | [/reference/post_partner-app-appid-template-msg-2](https://partner-docs.gupshup.io/reference/post_partner-app-appid-template-msg-2) |
| LTO | [/reference/post_partner-app-appid-template-msg-6](https://partner-docs.gupshup.io/reference/post_partner-app-appid-template-msg-6) |

---

## Notes
- V2 marketing messages can be auto-routed through MM Lite by enabling the flag.
- V2 template endpoints incur a 6% Gupshup markup on Meta's fee. Use V3 or MM Lite to avoid this.
- Templates must be in APPROVED status before sending.
