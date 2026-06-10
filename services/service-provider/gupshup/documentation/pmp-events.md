# PMP (Per Message Pricing) Events

As of July 2025, Gupshup uses PMP events for detailed billing.

## Billing Event Changes
- **Category Key**: Added to signify the conversation category (marketing, utility, etc.).
- **Model Key**: Changed from `CBP` (Conversation Based Pricing) to `PMP`.
- **References**: Now includes `gsId` (Gupshup ID) and `id` (Meta ID).

## Sent Event Changes
- **Pricing Object**: Policy value is `PMP`.
- **Category**: Specific categories like `marketing_lite`, `authentication_international`, etc.
- **Conversation Object**: Optional, forwarded only if Meta provides it.

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/pmp-events-1)
