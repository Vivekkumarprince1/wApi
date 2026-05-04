# Data Models (Database Schema)

This document maps the core MongoDB collections managed via Mongoose.

## 1. Workspace & Users
The foundation of the multi-tenant architecture.
- **User**: `src/lib/models/auth/User.ts` (Profile, credentials, account status).
- **Workspace**: `src/lib/models/workspace/Workspace.ts` (Business info, BSP identity, subscription state).
- **Member**: `src/lib/models/workspace/Member.ts` (Role-based access mapping between Users and Workspaces).

## 2. Messaging
Data related to conversations and content.
- **Conversation**: `src/lib/models/messaging/Conversation.ts` (Thread metadata, last message, labels).
- **Message**: `src/lib/models/messaging/Message.ts` (Individual chat entries, status tracking).
- **Template**: `src/lib/models/template/Template.ts` (WhatsApp approved message formats).

## 3. Automation
Storage for workflows and execution logs.
- **AutomationFlow**: `src/lib/models/automation/AutomationFlow.ts` (The graph definition of a chatbot flow).
- **FlowExecution**: `src/lib/models/automation/FlowExecution.ts` (History and current state of a running flow).

## 4. Marketing
- **Campaign**: `src/lib/models/campaign/Campaign.ts` (Broadcast settings, audience, results).
- **Contact**: `src/lib/models/shared/Contact.ts` (Individual customer records).

## 5. Billing
- **Subscription**: `src/lib/models/billing/Subscription.ts` (Plan details, expiry).
- **Transaction**: `src/lib/models/billing/Transaction.ts` (Ledger entries for wallet/payments).

## 6. Super Admin
- **GlobalConfig**: `src/lib/models/system/GlobalConfig.ts` (Platform-wide settings).
- **BSPProvider**: `src/lib/models/bsp/BSPProvider.ts` (Credentials and status for partner gateways).
