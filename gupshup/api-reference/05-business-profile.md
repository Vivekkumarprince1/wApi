# Gupshup Partner API Reference: Business Profile & Block User & Analytics

Base URL: `https://partner.gupshup.io`

---

## Business Profile APIs

### 1. Get Profile Details
**`GET /partner/app/{appId}/business/profile`**

Retrieves the WhatsApp Business Profile details for an app.

```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/business/profile \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-business-profile)

### 2. Get Profile About
**`GET /partner/app/{appId}/business/profile/about`**

```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/business/profile/about \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-business-profile-about)

### 3. Update Profile Details
**`PUT /partner/app/{appId}/business/profile`**

Updates address, email, websites, vertical, and description of the business profile.

```bash
curl --request PUT \
  --url https://partner.gupshup.io/partner/app/{appId}/business/profile \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "address": "123 Main St",
    "description": "Premium WhatsApp service",
    "email": "support@business.com",
    "vertical": "RETAIL",
    "websites": ["https://business.com"]
  }'
```

[Source](https://partner-docs.gupshup.io/reference/put_partner-app-appid-business-profile)

### 4. Update Profile About
**`PUT /partner/app/{appId}/business/profile/about`**

```bash
curl --request PUT \
  --url https://partner.gupshup.io/partner/app/{appId}/business/profile/about \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "about": "Your trusted WhatsApp partner" }'
```

[Source](https://partner-docs.gupshup.io/reference/put_partner-app-appid-business-profile-about)

### 5. Get Profile Picture
**`GET /partner/app/{appId}/business/profile/photo`**

```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/business/profile/photo \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-business-profile-photo)

### 6. Update Profile Picture
**`PUT /partner/app/{appId}/business/profile/photo`**

```bash
curl --request PUT \
  --url https://partner.gupshup.io/partner/app/{appId}/business/profile/photo \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: multipart/form-data' \
  --form 'file=@/path/to/photo.jpg'
```

[Source](https://partner-docs.gupshup.io/reference/put_partner-app-appid-business-profile-photo)

---

## Block User APIs

### 1. Block Users
**`POST /partner/app/{appId}/user/block`**

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/user/block \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "phoneNumbers": ["919876543210"] }'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-user-block)

### 2. Get Blocked Users List
**`GET /partner/app/{appId}/user/blocklist`**

```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/user/blocklist \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-user-blocklist)

### 3. Unblock Users
**`POST /partner/app/{appId}/user/unblock`**

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/user/unblock \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "phoneNumbers": ["919876543210"] }'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-user-unblock)

---

## Analytics APIs

### 1. Get App's Daily Usage
**`GET /partner/app/{appId}/usage`**

Retrieves daily usage statistics (messages sent, delivered, read, failed).

```bash
curl --request GET \
  --url 'https://partner.gupshup.io/partner/app/{appId}/usage?startDate=2025-01-01&endDate=2025-01-31' \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-usage)

### 2. Get App's Daily Discount
**`GET /partner/app/{appId}/discount`**

Retrieves daily discount/commission information.

```bash
curl --request GET \
  --url 'https://partner.gupshup.io/partner/app/{appId}/discount?startDate=2025-01-01&endDate=2025-01-31' \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-discount)
