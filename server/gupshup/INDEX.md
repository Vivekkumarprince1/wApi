# Gupshup Partner API Reference - Index

Comprehensive documentation of the Gupshup Partner Eco-System API Reference.

Base URL: `https://partner.gupshup.io`

---

## Documentation Files

### Conceptual Documentation (`docs/gupshup/`)
| File | Description |
|------|-------------|
| `introduction.md` | Introduction to the Partner Portal |
| `what-is-sp-tp.md` | Solution Partners & Tech Providers |
| `get-solution-id-from-meta.md` | Obtaining Meta Solution ID |
| `create-your-first-app.md` | First App Guide |
| `generate-secret-and-token.md` | Secret & Token Generation |
| `commissions.md` | Wallet & Commissions |
| `pricing.md` | Pricing Reference |
| `overdraft-limit.md` | Overdraft Management |
| `partner-rate-limits.md` | API Rate Limits |
| `webhook-key-points.md` | Webhook Best Practices |
| `subscription-management.md` | Subscription Management |
| `inbound-events.md` | Event Classification |
| `whatsapp-messages.md` | Message Types & Conversations |
| `whatsapp-passthrough-apis.md` | Meta Passthrough Intro |
| `user-events.md` | User Event Payloads |
| `message-events.md` | Message Status Events |
| `billing-events.md` | Billing Event Payloads |
| `system-events.md` | System Events |
| `pmp-events.md` | PMP Billing Events |
| `tier-based-pricing.md` | Tier Based Pricing |
| `v3-events.md` | V3 Event Payloads |
| `v3-pmp-events.md` | V3 PMP Events |
| `v3-tier-pricing.md` | V3 Tier Pricing |
| `flow-management-apis.md` | Flow Management Guide |
| `onboarding-apis.md` | Onboarding APIs Guide |
| `passthrough-flow-mgmt.md` | Passthrough Flow APIs |
| `media-management.md` | Media Management & Rate Limits |
| `mm-lite-api.md` | MM Lite Overview |
| `brazil-payments.md` | Brazil Payment Methods |
| `typing-indicator.md` | Typing & Read Indicators |
| `whatsapp-profile.md` | Profile Display Name |
| `support-contact.md` | Support Contact Info |

### API Reference (`docs/gupshup/api-reference/`)
| File | Category | Endpoints |
|------|----------|-----------|
| `01-authentication.md` | Authentication | Get Partner Token, Get App Access Token |
| `02-app-management.md` | App Management | Get Apps, Link App, Register/Deregister Phone |
| `03-onboarding-apis.md` | Onboarding | Create/Update/Get App, Set Contact, Embed Link, Migration |
| `04-subscription-management.md` | Subscriptions | Get/Set/Update/Delete Subscriptions |
| `05-business-profile.md` | Profile & Analytics | Business Profile CRUD, Block/Unblock Users, Daily Usage |
| `06-template-management.md` | Templates | Apply/Get/Edit/Delete Templates, Sync, Analytics, Library |
| `07-media-management.md` | Media | Generate Media ID (File/URL), Download, Delete |
| `08-waba-management.md` | WABA & OBO | Health, Wallet, Quality Rating, OBO Migration, Profile Name |
| `09-v3-send-message.md` | V3 Messaging | 15 Session & 8 Template message types (Meta format) |
| `10-v2-send-message.md` | V2 Messaging | Template message types (Gupshup format) |
| `11-mmlite-voice-flow-misc.md` | MM Lite & Misc | MM Lite, Voice, Flow Management, Typing/Read Indicators |

---

## Authentication Flow

```
1. POST /partner/account/login → Partner Token (JWT)
2. GET /partner/app/{appId}/token → App Access Token
3. Use tokens in Authorization header for all subsequent calls
```

## Key API Categories (80+ Endpoints)

### Partner App Management (4 endpoints)
- Get/Link apps, Register/Deregister phone numbers

### Token Management (2 endpoints)
- Partner login, App token generation

### Subscription Management (6 endpoints)
- Full CRUD for webhook subscriptions (V2/V3)

### Block User (3 endpoints)
- Block/Unblock/List blocked users

### Analytics (2 endpoints)
- Daily usage, Daily discount

### Business Profile (6 endpoints)
- Full profile CRUD (details, about, photo)

### Template Management (15+ endpoints)
- Apply, get, edit, delete, sync templates
- Template analytics, comparison, library

### Media Management (4 endpoints)
- Generate media IDs (file/URL), download, delete

### WABA Management (5 endpoints)
- Health check, wallet balance, quality rating, WABA info

### Onboarding APIs (8 endpoints)
- Create/update/get apps, contacts, embed link, migration

### Meta Passthrough V3 (25+ endpoints)
- Session messages: Text, Image, Video, Audio, Sticker, Contact, Address, Flow, Interactive, Reaction, Voice Notes, Location, Product Card, Carousel
- Template messages: Text, Auth, Interactive, Location, Media, Multi-Product, Flow, Carousel
- Brazil payments: PIX, Boleto, Payment Link

### V2 Send Message (12+ endpoints)
- Template messages in Gupshup native format

### MM Lite (6 endpoints)
- Enable flag, send, GIF, ad details, insights, onboarding link

### Flow Management (10 endpoints)
- Full lifecycle: create, get, update, publish, deprecate, delete

### Voice & Misc (3 endpoints)
- Voice toggle, Mark as Read, Typing indicator
