# Tier Based Pricing (V3)

Beginning October 2025, Meta triggers a V3 webhook for pricing tier updates.

## Webhook: VOLUME_BASED_PRICING_TIER_UPDATE
Received when a WABA moves to a new volume-based pricing tier in a market.

### Payload Fields
- **effective_month**: e.g., "2025-11".
- **pricing_category**: UTILITY, MARKETING, etc.
- **region**: INDIA, NORTH_AMERICA, etc.
- **tier**: The volume range (e.g., 25000001:50000000).
- **tier_update_time**: Unix timestamp.

[Source: Gupshup Documentation](https://partner-docs.gupshup.io/docs/tier-based-pricing-1)
