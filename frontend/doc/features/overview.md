# Project Features & Functionalities

This document maps the user-facing features of wApi to their respective frontend components and backend logic.

## 1. Unified Inbox
Real-time messaging interface supporting WhatsApp, Instagram, and Facebook.
- **Frontend**: `src/dashboard/dashboard/inbox/`
- **Backend Service**: `src/lib/services/messaging/inbox-service.ts`
- **Socket Logic**: `src/lib/services/socket-service.ts`
- **Key Files**:
  - `ChatWindow.tsx`: Main messaging UI.
  - `ConversationList.tsx`: Sidebar for active chats.
  - `webhook-processor.ts`: Handles incoming messages.

## 2. Automation & AI
Workflow builder, auto-replies, and AI-powered chat assistants.
- **Frontend**: `src/dashboard/dashboard/automation/`
- **Backend Service**: `src/lib/services/automation/`
- **AI Integration**: `src/lib/services/ai/`
- **Key Files**:
  - `flow-builder/`: UI for creating automation flows.
  - `automation-engine.ts`: Logic for executing triggers and actions.

## 3. Marketing & Campaigns
Bulk messaging, scheduled broadcasts, and WhatsApp Ads.
- **Frontend**: `src/dashboard/dashboard/campaign/` & `src/dashboard/dashboard/ads/`
- **Backend Service**: `src/lib/services/marketing/`
- **Key Files**:
  - `broadcast-service.ts`: Handles high-volume message delivery.
  - `campaign-model.ts`: Schema for marketing campaigns.

## 4. CRM & Contact Management
Lead tracking, custom fields, and customer segmentation.
- **Frontend**: `src/dashboard/dashboard/contacts/` & `src/dashboard/dashboard/crm/`
- **Backend Service**: `src/lib/services/workspace/contact-service.ts`
- **Key Files**:
  - `ContactTable.tsx`: Searchable contact list.
  - `ContactProfile.tsx`: Detailed view with history and notes.

## 5. E-commerce
WhatsApp Catalogs, order management, and payment processing.
- **Frontend**: `src/dashboard/dashboard/commerce/`
- **Backend Service**: `src/lib/services/commerce/`
- **Key Files**:
  - `catalog-sync.ts`: Syncs products with Meta/Gupshup.
  - `order-service.ts`: Manages checkout flows.

## 6. Billing & Wallet
Subscription management and credit-based wallet for messaging costs.
- **Frontend**: `src/dashboard/dashboard/billing/`
- **Backend Service**: `src/lib/services/billing/`
- **Key Files**:
  - `razorpay-service.ts`: Payment gateway integration.
  - `wallet-transaction.ts`: Ledger for credit usage.

## 7. Templates
Management of WhatsApp-approved message templates.
- **Frontend**: `src/dashboard/dashboard/templates/`
- **Backend Service**: `src/lib/services/messaging/waba-service.ts`
- **Key Files**:
  - `TemplateEditor.tsx`: Creator for rich media templates.
  - `template-sync-worker.ts`: Background sync with Meta.
