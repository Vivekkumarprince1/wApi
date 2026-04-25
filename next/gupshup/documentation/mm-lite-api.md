# Marketing Messages Lite (MM Lite) API

MM Lite is an optimized solution for marketing messages, offering better delivery rates and removing the 6% Gupshup markup if used correctly.

## Key Benefits
- **Higher Delivery**: Up to 9% higher delivery observed in India compared to standard Cloud API.
- **Exclusive Features**: Benchmark comparisons, TTL (Time-To-Live) for expiring promotions, and advanced conversion reporting.
- **Easy Transition**: Uses existing templates and phone numbers.

## Implementation Options
- **Option A (Auto-Routing)**: Enable the V2 MM Lite flag. Standard V2 template endpoints will then route through MM Lite.
- **Option B (V3 Endpoint)**: Use the dedicated V3 MM Lite endpoint for marketing messages.

## Onboarding
- Requires acceptance of **Terms of Service (ToS)** at the Business Manager (BMID) level via an Embedded Flow.
- Once joined, a `tos_signed` event is triggered.

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/marketing-messages-lite-mm-lite-api)
