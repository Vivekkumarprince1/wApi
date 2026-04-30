# Gupshup Partner API Reference: App Management

Base URL: `https://partner.gupshup.io`

---

## 1. Get Partner Apps
**`GET /partner/account/api/partnerApps`**

Retrieves the list of partner applications linked to the authenticated partner's account, including health status from DockerDetails and capping information from CappingDetails.

### Headers
| Header | Value |
|--------|-------|
| `Authorization` | Partner Token |

### Example Request (cURL)
```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/account/api/partnerApps \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

### Example Response (200 OK)
```json
{
  "status": "success",
  "partnerApps": [
    {
      "appId": "abc123",
      "name": "My WhatsApp App",
      "phone": "919876543210",
      "currentLimit": "TIER_10K",
      "qualityRating": "GREEN",
      "status": "LIVE",
      "DockerDetails": { "health": "RUNNING" },
      "CappingDetails": { "dailyLimit": 10000, "used": 500 }
    }
  ]
}
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-account-api-partnerapps)

---

## 2. Link App with Partner
**`POST /partner/account/api/appLink`**

Links a Gupshup application to the partner's account using an API key and app name.

### Headers
| Header | Value |
|--------|-------|
| `Authorization` | Partner Token |
| `Content-Type` | `application/x-www-form-urlencoded` |

### Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiKey` | string | Yes | gupshup.io API key |
| `appName` | string | Yes | Name of the app to link |

### Example Request (cURL)
```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/account/api/appLink \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data 'apiKey=YOUR_API_KEY&appName=myAppName'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-account-api-applink)

---

## 3. Register Phone for an App
**`POST /partner/app/{appId}/register/phone`**

Registers a Phone Number (PN) for WhatsApp Business onboarding. This is a critical operation that initiates the registration process with WhatsApp services, linking a phone number to the partner application.

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
| `phoneNumber` | string | Yes | Phone number to register (with country code) |

### Example Request (cURL)
```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/register/phone \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "phoneNumber": "919876543210" }'
```

[Source](https://partner-docs.gupshup.io/reference/registerphoneapp)

---

## 4. Deregister Phone for an App
**`POST /partner/app/{appId}/deregister/phone`**

Deregisters a Phone Number from WhatsApp Business. Removes the phone number registration from WhatsApp services, disabling WhatsApp Business messaging for that number.

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
| `phoneNumber` | string | Yes | Phone number to deregister |

### Example Request (cURL)
```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/deregister/phone \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "phoneNumber": "919876543210" }'
```

[Source](https://partner-docs.gupshup.io/reference/deregisterphoneapp)
