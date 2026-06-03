# Gupshup Partner API Reference: Template Management

Base URL: `https://partner.gupshup.io`

---

## 1. Apply For Templates
**`POST /partner/app/{appId}/templates`**

Creates and submits a template for approval to Meta.

### Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `elementName` | string | Yes | Unique template name (lowercase, underscores) |
| `languageCode` | string | Yes | e.g., `en`, `en_US` |
| `category` | string | Yes | `MARKETING`, `UTILITY`, `AUTHENTICATION` |
| `templateType` | string | Yes | `TEXT`, `IMAGE`, `VIDEO`, `DOCUMENT`, `LOCATION` |
| `body` | string | Yes | Template body text with {{1}} placeholders |
| `header` | string | No | Header text or media handle |
| `footer` | string | No | Footer text (max 60 chars) |
| `buttons` | array | No | CTA or Quick Reply buttons |
| `example` | string | No | Example values for variables |

### Example Request (cURL)
```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/templates \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "elementName": "welcome_message",
    "languageCode": "en",
    "category": "MARKETING",
    "templateType": "TEXT",
    "body": "Hello {{1}}, welcome to {{2}}!",
    "example": "Hello John, welcome to MyBrand!"
  }'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-templates-6)

---

## 2. Apply For Templates with Sample Media
**`POST /partner/app/{appId}/templates`** (multipart)

Creates templates with media header samples (image, video, document).

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-templates)

---

## 3. Get Templates
**`GET /partner/app/{appId}/templates`**

Retrieves all templates for an app, including status (APPROVED, PENDING, REJECTED).

### Example Request (cURL)
```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/templates \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

### Example Response (200 OK)
```json
{
  "status": "success",
  "templates": [
    {
      "id": "template_123",
      "elementName": "welcome_message",
      "languageCode": "en",
      "category": "MARKETING",
      "status": "APPROVED",
      "meta": { "templateId": "1234567890" },
      "body": "Hello {{1}}, welcome to {{2}}!",
      "createdOn": 1710941393420
    }
  ]
}
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-templates)

---

## 4. Upload Template Media
**`POST /partner/app/{appId}/upload/media`**

Uploads media for use in template headers. Returns a media handle used in template creation.

```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/upload/media \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: multipart/form-data' \
  --form 'file=@/path/to/image.jpg' \
  --form 'file_type=image/jpeg'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-upload-media-1)

---

## 5. Edit Template
**`PUT /partner/app/{appId}/templates/{templateId}`**

Edits an existing template (only allowed for approved templates of certain categories).

```bash
curl --request PUT \
  --url https://partner.gupshup.io/partner/app/{appId}/templates/{templateId} \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{ "category": "UTILITY", "body": "Updated body text {{1}}" }'
```

[Source](https://partner-docs.gupshup.io/reference/put_partner-app-appid-templates-templateid-1)

---

## 6. Delete Template
**`DELETE /partner/app/{appId}/template/{elementName}`**

Deletes a template by its element name.

```bash
curl --request DELETE \
  --url https://partner.gupshup.io/partner/app/{appId}/template/{elementName} \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/delete_partner-app-appid-template-elementname)

---

## 7. Delete Template by Template ID and Element Name
**`DELETE /partner/app/{appId}/template/{elementName}/{templateId}`**

Deletes a specific language variation of a template.

```bash
curl --request DELETE \
  --url https://partner.gupshup.io/partner/app/{appId}/template/{elementName}/{templateId} \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/delete_partner-app-appid-template-elementname-templateid)

---

## 8. Sync Templates for an App
**`GET /partner/app/{appId}/templates/sync`**

Forces a sync of templates from Meta to refresh local state.

```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/templates/sync \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/synctemplate)

---

## Template Creation Examples

Templates can be created for various header types:

| Type | Endpoint Ref |
|------|-------------|
| GIF | [/reference/creategiftemplate](https://partner-docs.gupshup.io/reference/creategiftemplate) |
| Text | [/reference/post_partner-app-appid-template-text](https://partner-docs.gupshup.io/reference/post_partner-app-appid-template-text) |
| Image | [/reference/post_partner-app-appid-template-image](https://partner-docs.gupshup.io/reference/post_partner-app-appid-template-image) |
| Video | [/reference/post_partner-app-appid-templates-video](https://partner-docs.gupshup.io/reference/post_partner-app-appid-templates-video) |
| Location | [/reference/post_partner-app-appid-templates-location](https://partner-docs.gupshup.io/reference/post_partner-app-appid-templates-location) |
| Product | [/reference/post_partner-app-appid-templates-product](https://partner-docs.gupshup.io/reference/post_partner-app-appid-templates-product) |
| Catalog | [/reference/post_partner-app-appid-templates-catalog](https://partner-docs.gupshup.io/reference/post_partner-app-appid-templates-catalog) |
| Carousel (Image) | [/reference/post_partner-app-appid-templates-carouselimage](https://partner-docs.gupshup.io/reference/post_partner-app-appid-templates-carouselimage) |
| Carousel (Video) | [/reference/post_partner-app-appid-templates-carouselvideo](https://partner-docs.gupshup.io/reference/post_partner-app-appid-templates-carouselvideo) |
| Document | [/reference/post_partner-app-appid-templates-document](https://partner-docs.gupshup.io/reference/post_partner-app-appid-templates-document) |
| LTO | [/reference/post_partner-app-appid-templates-lto](https://partner-docs.gupshup.io/reference/post_partner-app-appid-templates-lto) |
| Flow | [/reference/post_partner-app-appid-create-flow-8](https://partner-docs.gupshup.io/reference/post_partner-app-appid-create-flow-8) |
| PIX | [/reference/post_partner-app-appid-templates-8](https://partner-docs.gupshup.io/reference/post_partner-app-appid-templates-8) |

---

## Template Analytics

### Get Template Analytics
**`GET /partner/app/{appId}/template/analytics`**

```bash
curl --request GET \
  --url 'https://partner.gupshup.io/partner/app/{appId}/template/analytics?templateId={templateId}&startDate=2025-01-01&endDate=2025-01-31' \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-template-analytics)

### Enable Template Analytics Setting
**`POST /partner/app/{appId}/template/analytics`**

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-template-analytics)

### Disable Button Click Analytics
**`POST /partner/app/{appId}/template/analytics/buttonclick`**

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-template-analytics-buttonclick)

### Template Comparison API
**`GET /partner/app/{appId}/template/analytics/{templateId}/compare`**

[Source](https://partner-docs.gupshup.io/reference/get_partner-app-appid-template-analytics-templateid-compare)

---

## Meta Utility Template Library

### Get Templates from Library
**`GET /partner/app/{appId}/templates/library`**

Browse pre-approved utility templates from Meta's library.

[Source](https://partner-docs.gupshup.io/reference/gettemplatesfromlibrary)

### Create Template from Library
**`POST /partner/app/{appId}/templates/library`**

Clone a template from Meta's library into your account.

[Source](https://partner-docs.gupshup.io/reference/createtemplatefromlibrary)
