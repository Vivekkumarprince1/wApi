# Media Management

Proper handling of media is critical to avoid messaging disruptions.

## Best Practices
- **Mirroring**: Automatically download and store media (S3, Cloudinary) upon receipt.
- **Expiry**: Track media expiry timestamps. Gupshup File Manager links expire and should not be relied upon for long-term storage.
- **Outdated Media**: Do not attempt to fetch media older than 7 days (Cloud API/On-prem).

## Rate Limits (Effective Jan 2025)
- **Invalid Calls**: If an app makes **20+ invalid media calls per hour**, a rate limit is triggered.
- **Cooldown**: 1 hour cooldown period after hitting the limit.
- **Error Codes**: 400/404 with "Invalid Media Id" body indicates an invalid call.

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/media-management)
