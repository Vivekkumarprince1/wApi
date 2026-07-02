# Meta Ads Customer Enablement

This implementation enables customer-owned Click-to-WhatsApp ads through Meta OAuth, encrypted credential storage, and campaign-service publishing.

## Customer Flow

1. Open **Integrations > Meta Ads**.
2. Click **Connect Meta Ads** and authorize the customer Meta account.
3. Select:
   - Ad account
   - Facebook Page
   - Optional Instagram actor
   - WhatsApp phone number, either discovered from Meta or entered manually
   - Optional Meta commerce product catalog and product set
4. Open **Ads** and create a Click-to-WhatsApp ad.
5. Launch as `PAUSED` for review or `ACTIVE` for immediate delivery.

## Environment

Automation service:

```env
META_ADS_CLIENT_ID=
META_ADS_CLIENT_SECRET=
META_ADS_REDIRECT_URI=
META_ADS_API_VERSION=v25.0
META_ADS_SCOPES=ads_management,ads_read,business_management,catalog_management,pages_show_list,pages_read_engagement,whatsapp_business_management
```

Campaign service:

```env
AUTOMATION_SERVICE_URL=http://localhost:3001
META_ADS_API_VERSION=v25.0
```

## API Surface

Customer-facing integration endpoints:

- `GET /api/v1/integrations/meta-ads/status`
- `GET /api/v1/integrations/meta-ads/auth-url`
- `GET /api/v1/integrations/meta-ads/callback`
- `POST /api/v1/integrations/meta-ads/refresh-assets`
- `POST /api/v1/integrations/meta-ads/config`
- `GET /api/v1/integrations/meta-ads/catalogs/:catalogId/products`
- `POST /api/v1/integrations/meta-ads/catalogs/:catalogId/products/sync`
- `POST /api/v1/integrations/meta-ads/catalogs/:catalogId/product-sets`

Campaign endpoints:

- `GET /api/v1/ads/meta/readiness`
- `POST /api/v1/ads`
- `POST /api/v1/ads/:id/publish`
- `POST /api/v1/ads/:id/status`
- `GET /api/v1/ads/:id/preview`
- `POST /api/v1/ads/:id/sync`

Internal-only credential handoff:

- `GET /internal/v1/integrations/meta-ads/:workspaceId`

The internal endpoint requires `x-internal-service-secret` and returns decrypted credentials only to backend services.

## Meta Assets Discovered

OAuth discovery stores safe metadata for:

- Ad accounts
- Pages and linked Instagram business accounts
- WhatsApp Business phone numbers
- Business-owned and client product catalogs
- Product sets for discovered catalogs

## Meta Objects Created

Publishing creates:

- Campaign with `OUTCOME_ENGAGEMENT`
- Ad set with WhatsApp destination and conversation optimization
- Ad creative with WhatsApp CTA, URL tags, and optional carousel child attachments
- Ad in `PAUSED` or `ACTIVE` state

Local Meta IDs, selected catalog/product-set context, insights metrics, and sync logs are stored on `WhatsAppAd`.

## Commerce Product Sync

Commerce products can be pushed from **Commerce > Catalog** to the configured Meta product catalog.

The sync maps local product fields to Meta product item fields:

- Local product `_id` -> Meta `retailer_id`
- `name` -> `name`
- `description` -> `description`
- `price` and `currency` -> Meta price string
- `stock` -> `inventory` and `availability`
- Primary image URL -> `image_url`
- Category -> `category` and `product_type`

The local product stores Meta catalog/product IDs and the last sync status so operators can tell whether a product is local-only, synced, or in error.
