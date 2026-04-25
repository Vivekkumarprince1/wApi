# Core Service Functions

This document catalogs the primary functions within the system's service layer, detailing their parameters and responsibilities.

## 1. WabaService (`src/lib/services/messaging/waba-service.ts`)
The primary interface for interacting with the WhatsApp Business API.

- **`sendTextMessage(workspaceId, phone, body)`**: Sends a standard text message. Handles credit checks and ledger deduction.
- **`sendTemplateMessage(workspaceId, phone, templateName, languageCode, components)`**: Sends a pre-approved WhatsApp template with dynamic variables.
- **`sendInteractiveMessage(workspaceId, phone, interactivePayload, options)`**: Sends buttons, lists, or location requests.
- **`sendFlowMessage(workspaceId, phone, flowPayload, options)`**: Dispatches a WhatsApp Flow (Native Forms).
- **`syncTemplates(workspaceId)`**: Fetches the latest template statuses from the provider and updates the local database.

## 2. AuthFlowService (`src/lib/services/auth/auth-flow-service.ts`)
Handles user lifecycle, from registration to session management.

- **`sendAuthOtp(input)`**: Generates and sends a 6-digit OTP for email or phone verification.
- **`verifyAuthOtp(input)`**: Validates an OTP and transitions the user/workspace to the next onboarding state.
- **`loginWithPassword(email, password)`**: Standard credential-based login. Returns a JWT and the `nextStep` onboarding path.
- **`touchLogin(user)`**: Updates the user's `lastLoginAt` and ensures their active workspace is resolved.

## 3. LedgerService (`src/lib/services/billing/ledger-service.ts`)
The financial heart of the platform, managing the workspace wallet.

- **`deduct(workspaceId, amountPaise, metadata)`**: Decrements the wallet balance. Wrapped in a Mongoose session for ACID compliance.
- **`credit(workspaceId, amountPaise, metadata)`**: Increments the wallet balance. Includes idempotency checks via `externalReferenceId`.
- **`park(workspaceId, amountPaise, campaignId)`**: Temporarily reserves funds for a bulk campaign.
- **`resolveCampaign(workspaceId, successAmount, failAmount, campaignId)`**: Settles a campaign, refunding unused parked funds to the main balance.

## 4. AutomationService (`src/lib/services/automation/automation-service.ts`)
Orchestrates automated responses and workflow triggers.

- **`handleInboundMessage(payload)`**: The main hook called by the `WebhookProcessor`. Matches the incoming message against active workflow triggers.
- **`executeRule(ruleId, context)`**: Initiates the execution of a specific graph-based workflow.

## 5. GupshupProvisioningService (`src/lib/services/bsp/gupshup-provisioning-service.ts`)
Manages the partner-level onboarding for new workspaces.

- **`provisionPartnerApp(userId, options)`**: Automates the creation of a Gupshup app, setting up webhooks, and generating the embedded signup link.
- **`syncWabaData(workspace)`**: Periodically fetches WABA health, quality ratings, and wallet balances from the partner API.

## 6. DealService (`src/lib/services/commerce/deal-service.ts`)
Manages the CRM sales pipeline.

- **`createDeal(workspaceId, data)`**: Initializes a new sales deal attached to a contact.
- **`updateDealStage(dealId, stageId)`**: Transitions a deal through the pipeline and logs the activity.
