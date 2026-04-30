# Gupshup Partner API Reference: WABA Management & OBO

Base URL: `https://partner.gupshup.io`

---

## WABA Health & Monitoring

### 1. Check Health
**`GET /partner/app/{appId}/health`**

Returns the WABA health status including container status, API status, and phone quality.

```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/health \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

### Example Response
```json
{
  "status": "success",
  "health": {
    "apiStatus": "RUNNING",
    "phoneQuality": "GREEN",
    "currentLimit": "TIER_10K",
    "namespace": "xxxxxxxx_xxxx_xxxx_xxxx_xxxxxxxxxxxx"
  }
}
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-health)

---

### 2. Get Wallet Balance
**`GET /partner/app/{appId}/wallet/balance`**

Returns the current prepaid wallet balance for an app.

```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/wallet/balance \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-wallet-balance)

---

### 3. Get Quality Rating
**`GET /partner/app/{appId}/ratings`**

Returns phone number quality rating (GREEN, YELLOW, RED, FLAGGED).

```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/ratings \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-ratings)

---

### 4. Get WABA INFO
**`GET /partner/app/{appId}/wabaInfo`**

Retrieves comprehensive WABA details: account status, messaging capabilities, phone quality, ownership, namespace, and errors.

```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/wabaInfo \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

### Example Response
```json
{
  "status": "success",
  "wabaInfo": {
    "wabaId": "waba_123",
    "businessManagerId": "bm_456",
    "phoneNumber": "919876543210",
    "qualityRating": "GREEN",
    "currentLimit": "TIER_10K",
    "namespace": "xxxx",
    "accountStatus": "ACTIVE",
    "verifiedName": "My Business",
    "errors": []
  }
}
```

[Source](https://partner-docs.gupshup.io/reference/get-waba-info)

---

## OBO to Embed Flow

### 1. Whitelist the WABA ID
**`POST /partner/app/{appId}/oboToEmbed/whitelist`**

Whitelists a WABA ID for the Embed Signup flow migration from OBO model.

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/oboToEmbed/whitelist \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "wabaId": "YOUR_WABA_ID" }'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-obotoembed-whitelist)

### 2. Verify and Attach the Credit Line
**`GET /partner/app/{appId}/oboToEmbed/verify`**

Verifies and attaches the credit line after OBO migration.

```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/oboToEmbed/verify \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-obotoembed-verify)

---

## Conversational Components

### 1. Get Conversational Component
**`GET /partner/app/{appId}/conversational/component`**

Retrieves ice breakers, welcome messages, and other conversational settings.

```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/conversational/component \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-conversational-component)

### 2. Set Conversational Component
**`POST /partner/app/{appId}/conversational/component`**

Sets ice breakers, commands, and welcome messages.

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/conversational/component \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "iceBreakers": ["What is your menu?", "Track my order"],
    "welcomeMessage": "Welcome! How can I help you today?"
  }'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-conversational-component)

---

## WhatsApp Profile Name Management

### 1. Get WhatsApp Profile Display Name
**`GET /partner/app/{appId}/profile/displayName`**

```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/profile/displayName \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/getprofilename)

### 2. Update WhatsApp Profile Display Name
**`POST /partner/app/{appId}/profile/displayName`**

Submits a new display name for review.

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/profile/displayName \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "displayName": "New Business Name" }'
```

[Source](https://partner-docs.gupshup.io/reference/updateprofilename)
