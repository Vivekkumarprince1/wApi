# Data Models Reference

This document provides a detailed breakdown of the primary entities in the wApi system. Models are built using Mongoose (MongoDB).

## 1. User Model (`src/lib/models/auth/User.ts`)
Represents an individual person who can log in to the platform.
- **`email` / `phone`**: Primary identifiers (normalized).
- **`role`**: `OWNER`, `ADMIN`, `AGENT`.
- **`accountStatus`**: Tracks onboarding progress (`AWAITING_VERIFICATION`, `COMPLETED`).
- **`workspace`**: The current active workspace ID.
- **`verifiedStates`**: Sub-object tracking email and mobile verification timestamps.

## 2. Workspace Model (`src/lib/models/workspace/Workspace.ts`)
The top-level container for all data (Contacts, Messages, Automations).
- **`appId` / `appToken`**: Gupshup/Meta credentials.
- **`walletBalance` / `walletParkedBalance`**: Integer values in Paise/Cents.
- **`onboardingStatus`**: Tracks the BSP provisioning state (`STAGE1_COMPLETE`, `CONNECTED`).
- **`settings`**: Configuration for business hours, auto-replies, and notification preferences.

## 3. Contact Model (`src/lib/models/messaging/Contact.ts`)
Represents a customer or lead.
- **`phone`**: The unique E.164 number (Primary Key within a workspace).
- **`tags`**: List of strings for segmentation.
- **`leadStatus`**: Current stage in the marketing funnel (`new`, `contacted`, `qualified`, etc.).
- **`customFields`**: Flexible Map for storing business-specific data.
- **`displayName`**: A virtual field that resolves Name, WhatsApp Name, or Phone in order of availability.

## 4. Message Model (`src/lib/models/messaging/Message.ts`)
A single interaction (Inbound or Outbound).
- **`type`**: `text`, `image`, `template`, `interactive`, `flow`.
- **`direction`**: `inbound` or `outbound`.
- **`status`**: `sent`, `delivered`, `read`, `failed`.
- **`providerId`**: The unique ID assigned by Meta/Gupshup (used for status tracking).
- **`automationInfo`**: Metadata if the message was sent by a bot.

## 5. AutomationRule Model (`src/lib/models/automation/AutomationRule.ts`)
Defines the workflow graph.
- **`trigger`**: The event that starts the flow (e.g., `message_received`).
- **`nodes`**: Array of logic, action, or branch nodes.
- **`edges`**: Defines the connections and logic flow between nodes.
- **`isActive`**: Boolean toggle for the rule.

## 6. Campaign Model (`src/lib/models/marketing/Campaign.ts`)
A bulk broadcast instance.
- **`templateId`**: Reference to the pre-approved template used.
- **`segmentId`**: The target audience criteria.
- **`stats`**: Aggregate counts (`sent`, `delivered`, `read`, `failed`).
- **`schedule`**: When the campaign should start executing.
- **`parkedAmount`**: The total wallet balance reserved for this specific run.
