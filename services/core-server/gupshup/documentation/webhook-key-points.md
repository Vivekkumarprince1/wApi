# Webhook Key Points

A webhook is an HTTP/HTTPS callback triggered by events like incoming messages or status updates.

## Critical Requirements
- **Response**: Must return `HTTP_SUCCESS (2xx)` with an empty response.
- **Timeout**: Must respond within 10 seconds, otherwise it's considered a failure and Gupshup will retry.
- **Asynchronous Processing**: High recommended to process messages asynchronously but acknowledge (send 200 OK) synchronously and instantly (<100ms preferred, max 500-1000ms).
- **Headers**: Must accept `User-Agent` header.
- **Events**: Should handle the `sandbox-start` user event.
- **Public Access**: Must have public access. Whitelisting Gupshup's inbound IPs is recommended for security.

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/webhook-key-points)
