# Tier Based Pricing

Gupshup supports volume-based pricing tiers that update based on usage.

## Pricing Tier Update Webhook
Received when an account's pricing tier changes.
- **effectiveMonth**: When the new pricing takes effect.
- **pricingCategory**: applicable category.
- **region**: Geographical region.
- **tier**: e.g., `25000001:50000000` (represents message volume range).

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/tier-based-pricing)
