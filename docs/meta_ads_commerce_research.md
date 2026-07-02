# Meta Ads and Commerce Research Mapping

## Scope Researched

Meta Ads and Commerce for this project maps to four operational areas:

1. **Marketing API publishing**
   - Campaigns
   - Ad sets
   - Ad creatives
   - Ads
   - Delivery status
   - Insights
2. **Customer Meta asset onboarding**
   - OAuth login
   - Ad accounts
   - Facebook Pages
   - Instagram business actors
   - WhatsApp Business phone numbers
3. **Commerce catalog assets**
   - Product catalogs
   - Product sets
   - Product feeds
   - Product items
4. **WhatsApp commerce handoff**
   - Click-to-WhatsApp ad destination
   - WhatsApp prefill message
   - Catalog/product context for commerce teams

## Meta Surfaces Implemented

### OAuth and Asset Discovery

Implemented in `automation-service`:

- `ads_management`
- `ads_read`
- `business_management`
- `catalog_management`
- `pages_show_list`
- `pages_read_engagement`
- `whatsapp_business_management`

Discovery now collects:

- `/me/adaccounts`
- `/me/accounts`
- `/me/businesses`
- `owned_whatsapp_business_accounts`
- `client_whatsapp_business_accounts`
- `owned_product_catalogs`
- `client_product_catalogs`
- `/{product_catalog_id}/product_sets`

### Click-to-WhatsApp Ads

Implemented in `campaign-service`:

- `/{ad_account_id}/campaigns`
- `/{ad_account_id}/adsets`
- `/{ad_account_id}/adcreatives`
- `/{ad_account_id}/ads`
- `/{ad_id}` status update
- `/{ad_id}/insights`

Local storage:

- Meta campaign ID
- Meta ad set ID
- Meta creative ID
- Meta ad ID
- Meta status
- Spend, reach, clicks, CTR, CPC, CPM, results, quality rankings
- Sync logs and Meta request IDs
- Selected product catalog/product-set context

### Commerce Catalog Sync

Implemented in `automation-service` and `customer-portal`:

- List Meta catalog products from `/{product_catalog_id}/products`
- Create a product item through `/{product_catalog_id}/products`
- Update a known Meta product item through `/{product_item_id}`
- Create product sets through `/{product_catalog_id}/product_sets`

Local product sync metadata:

- Meta catalog ID/name
- Meta product item ID
- Retailer ID
- Last sync timestamp
- Last sync status/error

## Project API Mapping

### Customer Portal to Automation Service

- `GET /api/v1/integrations/meta-ads/status`
- `GET /api/v1/integrations/meta-ads/auth-url`
- `GET /api/v1/integrations/meta-ads/callback`
- `POST /api/v1/integrations/meta-ads/refresh-assets`
- `POST /api/v1/integrations/meta-ads/config`
- `GET /api/v1/integrations/meta-ads/catalogs/:catalogId/products`
- `POST /api/v1/integrations/meta-ads/catalogs/:catalogId/products/sync`
- `POST /api/v1/integrations/meta-ads/catalogs/:catalogId/product-sets`

### Customer Portal to Campaign Service

- `GET /api/v1/ads`
- `POST /api/v1/ads`
- `GET /api/v1/ads/meta/readiness`
- `POST /api/v1/ads/meta/sync-all`
- `POST /api/v1/ads/:id/publish`
- `POST /api/v1/ads/:id/status`
- `POST /api/v1/ads/:id/sync`

### Customer Portal to Billing Commerce

- `GET /api/v1/commerce/products`
- `POST /api/v1/commerce/products`
- `PUT /api/v1/commerce/products/:id`
- `DELETE /api/v1/commerce/products/:id`

## Current Deliberate Boundaries

Not implemented in this pass:

- Scheduled product feed ingestion hosted from our platform.
- Catalog-sales dynamic ads.
- Product-set-driven ad creative templates.
- WhatsApp interactive product-list outbound messages.
- Conversions API / Pixel event mapping.

Those should be separate work because they require product URLs/media hosting, privacy/event policy checks, and sales-objective campaign decisions beyond the existing Click-to-WhatsApp ads workflow.

## Screenshot Sidebar Coverage

The Meta Ads-Commerce sidebar sections shown in the July 2 screenshots are mapped as follows.

| Meta docs area | Project status | Where it maps |
| --- | --- | --- |
| Ads with Pages | Supported | Meta Ads integration requires Facebook Page selection and uses `page_id` in creatives/promoted object. |
| Ads with Mixed Placements | Supported, basic | Ad creation supports Facebook/Instagram publisher platforms and mobile device placement. |
| Add Call-To-Action | Supported for Click-to-WhatsApp | Creative payload uses `WHATSAPP_MESSAGE` CTA with WhatsApp destination. |
| Get Ad Preview | Backend supported | `GET /api/v1/ads/:id/preview` calls Meta ad previews for published ads. |
| Get Ad Insights | Supported | `POST /api/v1/ads/:id/sync` and `POST /api/v1/ads/meta/sync-all`. |
| Use Posts as Instagram Ads | Planned | Needs page/IG post selector and promoted post creative flow. |
| Instagram Advantage+ Catalog Ads | Partially mapped | Catalog/product-set discovery exists; full Advantage+ catalog campaign flow is planned. |
| Carousel Ads | Supported for Click-to-WhatsApp creative | Ad creation accepts carousel cards and maps them to creative child attachments. |
| Reminder Ads | Planned | Needs event/reminder objective and creative flow. |
| Post Moderation | Not ads scope yet | Better mapped to social publishing/moderation service if added. |
| Use URL Tags for Tracking | Supported | `url_tags` is stored and sent during creative creation. |
| Customize Stories | Partially mapped | Story/reel placement can be represented through placement fields; per-placement creative customization is planned. |
| Add Interactive Elements | Planned | Needs poll/reminder/interactive creative type support. |
| Requirements / Requirement Guides | Documented | Environment, scopes, and readiness docs are in `meta_ads_customer_enablement.md`. |
| Media Requirements | Partially supported | UI accepts image hash/image URL; full media validation/upload pipeline is planned. |
| Data and Call To Action Requirements | Supported for WhatsApp CTA | CTA and WhatsApp destination are normalized server-side. |
| Threads Ads Guides / Threads Ads / Get Started | Planned | Needs Threads placement/account eligibility and Meta docs-specific flow before exposing in UI. |
