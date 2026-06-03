# Gupshup Partner API Reference: Media Management

Base URL: `https://partner.gupshup.io`

---

## 1. Generate Media ID Using File Upload
**`POST /partner/app/{appId}/media`**

Uploads a file and generates a reusable Media ID for use in templates and session messages.

### Headers
| Header | Value |
|--------|-------|
| `Authorization` | Partner Token |
| `Content-Type` | `multipart/form-data` |

### Form Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file` | file | Yes | Media file to upload |
| `file_type` | string | Yes | MIME type (e.g., `image/jpeg`, `video/mp4`, `application/pdf`) |

### Example Request (cURL)
```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/media \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: multipart/form-data' \
  --form 'file=@/path/to/image.jpg' \
  --form 'file_type=image/jpeg'
```

### Example Response (200 OK)
```json
{
  "status": "success",
  "mediaId": "h:xxxxxxxxxxxxxxxxxxxxxx"
}
```

### Notes
- Media IDs are valid for 30 days.
- Use this for template headers that require a media handle.

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-media)

---

## 2. Generate Media ID Using URL
**`POST /partner/app/{appId}/media`** (URL variant)

Generates a Media ID from a publicly accessible URL.

### Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | Public URL of the media file |
| `file_type` | string | Yes | MIME type |

### Example Request (cURL)
```bash
curl --request POST \
  --url https://partner.gupshup.io/partner/app/{appId}/media \
  --header 'Authorization: YOUR_PARTNER_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "url": "https://example.com/image.jpg",
    "file_type": "image/jpeg"
  }'
```

[Source](https://partner-docs.gupshup.io/reference/post_partner-app-appid-media-1)

---

## 3. Download Media
**`GET /partner/app/{appId}/media/{mediaId}`**

Downloads a media file using its ID. Returns the file binary.

### Example Request (cURL)
```bash
curl --request GET \
  --url https://partner.gupshup.io/partner/app/{appId}/media/{mediaId} \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

### Notes
- Media expires after 7 days (Cloud API).
- **Best Practice**: Mirror to your own storage (S3, Cloudinary) immediately upon receipt.

[Source](https://partner-docs.gupshup.io/reference/downloadmedia)

---

## 4. Delete Media by Media ID
**`DELETE /partner/app/{appId}/media/{mediaId}`**

Deletes a specific media file.

### Example Request (cURL)
```bash
curl --request DELETE \
  --url https://partner.gupshup.io/partner/app/{appId}/media/{mediaId} \
  --header 'Authorization: YOUR_PARTNER_TOKEN'
```

[Source](https://partner-docs.gupshup.io/reference/delete_partner-app-appid-media-mediaid)
