# Gupshup Partner API Reference: Authentication & Token Management

Base URL: `https://partner.gupshup.io`

---

## 1. Get Partner Token
**`POST /partner/account/login`**

Authenticates and logs in to the Partner Portal. Supports both UI-based login (with cookies) and API-based login (with JWT tokens). Returns comprehensive partner info including permissions, billing details, and feature flags.

### Headers
| Header | Value |
|--------|-------|
| `Content-Type` | `application/x-www-form-urlencoded` |

### Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | string | Yes | Partner email |
| `password` | string | Yes | Partner password |
| `clientSecret` | string | Yes | Client secret from Portal Settings |

### Example Request (cURL)
```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/account/login \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data 'email=your@email.com&password=yourPassword&clientSecret=YOUR_CLIENT_SECRET'
```

### Example Response (200 OK)
```json
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "partner": {
    "partnerId": "abc123",
    "email": "partner@example.com",
    "name": "Partner Name",
    "permissions": [...],
    "billingDetails": {...},
    "featureFlags": {...}
  }
}
```

### Notes
- Token is a JWT and should be stored securely.
- Use this token in `Authorization` header for all subsequent API calls.
- Token has an expiry; implement refresh logic.

[Source](https://partner-docs.gupshup.io/reference/post_partner-account-login)

---

## 2. Get Access Token for an App
**`GET /partner/app/{appId}/token`**

Generates or retrieves an access token for a specific partner application. Used for authenticating API calls to WhatsApp Business API. Idempotent: if a token exists, returns it; otherwise generates a new one.

### Headers
| Header | Value |
|--------|-------|
| `Authorization` | Partner Token |

### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `appId` | string | Yes | The Gupshup App ID |

### Example Request (cURL)
```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/token \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

### Example Response (200 OK)
```json
{
  "status": "success",
  "token": {
    "token": "sk_xxxxxxxxxxxxxxxxxxxxxxxx",
    "type": "app_access_token"
  }
}
```

### Notes
- This token is used for sending messages and managing templates.
- Different from the Partner Token — this is per-app.

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-token)
