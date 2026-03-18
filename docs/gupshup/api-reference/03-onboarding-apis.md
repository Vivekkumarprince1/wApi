# Gupshup Partner API Reference: Partner Portal Onboarding APIs

Base URL: `https://partner.gupshup.io`

---

## 1. Create App
**`POST /partner/app`**

Creates a new WABA onboarding outside of Gupshup UI. Used for programmatic onboarding of end clients.

### Headers
| Header | Value |
|--------|-------|
| `Authorization` | Partner Token |
| `Content-Type` | `application/json` |

### Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `appName` | string | Yes | Name of the application |
| `enableTemplateMessaging` | boolean | No | Enable template messaging (default: true) |
| `storageRegion` | string | No | Data storage region |

### Example Request (cURL)
```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "appName": "MyClientApp",
    "enableTemplateMessaging": true
  }'
```

### Example Response (200 OK)
```json
{
  "status": "success",
  "app": {
    "appId": "new_app_id_123",
    "name": "MyClientApp",
    "status": "DRAFT"
  }
}
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app)

---

## 2. Update Application from Partner Portal
**`PUT /partner/app/{appId}`**

Updates the WABA onboarding details outside of Gupshup UI.

### Headers
| Header | Value |
|--------|-------|
| `Authorization` | Partner Token |
| `Content-Type` | `application/json` |

### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `appId` | string | Yes | The Gupshup App ID |

### Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `enableTemplateMessaging` | boolean | No | Toggle template messaging |
| `storageRegion` | string | No | Update data storage region |

### Example Request (cURL)
```bash
curl --request PUT \
  --url https://partner.gupshup.io/partner/app/{appId} \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "enableTemplateMessaging": true }'
```

[Source](https://partner-docs.gupshup.io/reference/put_partner-app-appid)

---

## 3. Get App Details Based on AppId
**`GET /partner/app/{appId}/details`**

Fetches detailed information about a specific app.

### Example Request (cURL)
```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/details \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-details)

---

## 4. Filter and Get List of Apps
**`GET /partner/app/list`**

Fetches all apps for the account based on query parameters (search, status, pagination).

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | No | Search by app name |
| `status` | string | No | Filter by status (LIVE, DRAFT, etc.) |
| `limit` | number | No | Items per page |
| `offset` | number | No | Pagination offset |

### Example Request (cURL)
```bash
curl --request GET \
  --url 'https://partner.gupshup.io/partner/app/list?status=LIVE&limit=10&offset=0' \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-list)

---

## 5. Set Contact Details for an App
**`PUT /partner/app/{appId}/onboarding/contact`**

Sets contact details (email, business info) for an app during onboarding.

### Example Request (cURL)
```bash
curl --request PUT \
  --url https://partner.gupshup.io/partner/app/{appId}/onboarding/contact \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "email": "client@example.com", "name": "Client Name" }'
```

[Source](https://partner-docs.gupshup.io/reference/put_partner-app-appid-onboarding-contact)

---

## 6. Resend Verification Link
**`POST /partner/app/{appId}/onboarding/contact/email/resend`**

Triggers a verification email to the end client.

### Example Request (cURL)
```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/onboarding/contact/email/resend \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-onboarding-contact-email-resend)

---

## 7. Generate Embed Signed Link
**`GET /partner/app/{appId}/onboarding/embed/link`**

Creates the link for the Meta Embedded Signup flow. This is used to let end-clients complete Meta WABA onboarding within the partner's UI.

### Example Request (cURL)
```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/onboarding/embed/link \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

### Example Response (200 OK)
```json
{
  "status": "success",
  "link": "https://partner.gupshup.io/embed/signup?token=SIGNED_TOKEN..."
}
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-onboarding-embed-link)

---

## 8. Mark App for Migration
**`POST /partner/app/{appId}/onboarding/phoneMigration`**

Used when migrating from another BSP to sync templates and phone numbers.

### Example Request (cURL)
```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/onboarding/phoneMigration \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-onboarding-phonemigration)
