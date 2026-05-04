# Gupshup Partner API Reference: V3 Meta Passthrough Send Message APIs

Base URL: `https://partner.gupshup.io`

These V3 APIs use Meta's native format for sending WhatsApp messages.

---

## Session Messages (V3)

### 1. Text Message
**`POST /partner/app/{appId}/v3/text/message`**

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/v3/text/message \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "messaging_product": "whatsapp",
    "to": "919876543210",
    "type": "text",
    "text": { "body": "Hello from V3!" }
  }'
```

[Source](https://partner-docs.gupshup.io/reference/passthrough-apis)

---

### 2. Image Message
**`POST /partner/app/{appId}/v3/image/message`**

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/v3/image/message \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "messaging_product": "whatsapp",
    "to": "919876543210",
    "type": "image",
    "image": {
      "link": "https://example.com/image.jpg",
      "caption": "Check this out!"
    }
  }'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-image-message)

---

### 3. Video Message
**`POST /partner/app/{appId}/v3/video/message`**

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/v3/video/message \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "messaging_product": "whatsapp",
    "to": "919876543210",
    "type": "video",
    "video": { "link": "https://example.com/video.mp4" }
  }'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-video-message)

---

### 4. Audio Message
**`POST /partner/app/{appId}/v3/audio/message`**

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/v3/audio/message \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "messaging_product": "whatsapp",
    "to": "919876543210",
    "type": "audio",
    "audio": { "link": "https://example.com/audio.mp3" }
  }'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-audio-message-6)

---

### 5. Sticker Message
**`POST /partner/app/{appId}/v3/sticker/message`**

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/v3/sticker/message \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "messaging_product": "whatsapp",
    "to": "919876543210",
    "type": "sticker",
    "sticker": { "link": "https://example.com/sticker.webp" }
  }'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-sticker-message)

---

### 6. Contact Message
**`POST /partner/app/{appId}/v3/contact/message`**

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-contact-message-6)

### 7. Address Message
**`POST /partner/app/{appId}/v3/address/message`**

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-address-message-2)

### 8. Flow Message (Session)
**`POST /partner/app/{appId}/v3/flow/message`**

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-flow-message-6)

### 9. Interactive Message (Buttons/Lists)
**`POST /partner/app/{appId}/v3/interactive/message`**

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/v3/interactive/message \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "messaging_product": "whatsapp",
    "to": "919876543210",
    "type": "interactive",
    "interactive": {
      "type": "button",
      "body": { "text": "Choose an option" },
      "action": {
        "buttons": [
          { "type": "reply", "reply": { "id": "btn1", "title": "Option A" } },
          { "type": "reply", "reply": { "id": "btn2", "title": "Option B" } }
        ]
      }
    }
  }'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-interactive-message)

### 10. Reaction Message
**`POST /partner/app/{appId}/v3/reaction/message`**

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-reaction-message)

### 11. Voice Notes Message
[Source](https://partner-docs.gupshup.io/reference/voice-notes-message)

### 12. Location Request Message
[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-17)

### 13. Product Card Message
[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-18)

### 14. Media Card Carousel Message
[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-19)

### 15. Call Permission Request
[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-16)

---

## Template Messages (V3)

### 1. Text-Based Template
**`POST /partner/app/{appId}/v3/message`**

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/v3/message \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "messaging_product": "whatsapp",
    "to": "919876543210",
    "type": "template",
    "template": {
      "name": "welcome_message",
      "language": { "code": "en" },
      "components": [
        {
          "type": "body",
          "parameters": [
            { "type": "text", "text": "John" },
            { "type": "text", "text": "MyBrand" }
          ]
        }
      ]
    }
  }'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-14)

### 2. Authentication-Based Template
[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-9)

### 3. Interactive Message Template
[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-10)

### 4. Location-Based Template
[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-11)

### 5. Media-Based Template
[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-12)

### 6. Multi-Product Template
[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-13)

### 7. Flow Template Message
[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-6)

### 8. Product Card Carousel Template
[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-4)

---

## Brazil Payment Messages (V3)

### PIX Session Message
[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-8)

### PIX Template Message
[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-v3-message-7)

### Boleto Message
[Source](https://partner-docs.gupshup.io/reference/boleto-message)

### Boleto Template Message
[Source](https://partner-docs.gupshup.io/reference/boleto-template-message)

### Payment Link Message
[Source](https://partner-docs.gupshup.io/reference/payment-link-message)

### Payment Link Template Message
[Source](https://partner-docs.gupshup.io/reference/payment-link-template-message)
