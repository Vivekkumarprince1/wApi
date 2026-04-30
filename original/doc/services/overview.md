# Backend Services & Logic

This document details the core services that power the wApi engine, their responsibilities, and key files.

## 1. Messaging Engine
Responsible for handling webhooks, processing messages, and delivery via BSPs.
- **Webhook Processor**: `src/lib/services/messaging/webhook-processor.ts` (Handles incoming events from Gupshup/Meta).
- **WABA Service**: `src/lib/services/messaging/waba-service.ts` (High-level WhatsApp Business API operations).
- **Gupshup Service**: `src/lib/services/messaging/gupshup-service.ts` (Specific implementation for Gupshup integration).
- **Worker System**: `src/lib/services/messaging/snooze-worker.ts` & `src/lib/services/messaging/webhook-queue.ts`.

## 2. Authentication & Security
Manages user sessions, registration, and access control.
- **Auth Flow**: `src/lib/services/auth/auth-flow-service.ts` (Onboarding-aware authentication).
- **OTP Service**: `src/lib/services/auth/otp-service.ts` (Email and Mobile verification).
- **Access Control**: `src/lib/services/workspace-access-service.ts` (Permission checks for workspace members).

## 3. Automation Core
The brain behind chatbots and automated workflows.
- **Automation Engine**: `src/lib/services/automation/automation-engine.ts` (Executes flows based on triggers).
- **Node Handlers**: `src/lib/services/automation/nodes/` (Logic for specific flow steps like "Send Message", "Condition", "Wait").
- **AI Service**: `src/lib/services/ai/ai-service.ts` (Integration with LLMs for smart replies).

## 4. Billing & Ledger
Handles financial transactions, subscriptions, and usage credits.
- **Ledger Service**: `src/lib/services/billing/ledger-service.ts` (Maintains a precise history of credit usage).
- **Razorpay Service**: `src/lib/services/billing/razorpay-service.ts` (Integration with the payment gateway).
- **Usage Tracker**: `src/lib/services/billing/usage-tracker.ts` (Real-time monitoring of billable events).

## 5. Real-time Infrastructure
Powered by WebSockets for instant UI updates.
- **Socket Service**: `src/lib/services/socket-service.ts` (Manages socket connections).
- **Socket Emitter**: `src/lib/services/socket-emitter.ts` (Utility for broadcasting events from anywhere in the backend).

## 6. BSP (Business Solution Provider) Layer
Interface for managing partner-level relationships (specifically Gupshup).
- **Provisioning**: `src/lib/services/bsp/gupshup-provisioning-service.ts` (Creates apps and sets up WABAs).
- **Partner Client**: `src/lib/services/bsp/gupshup-partner-service.ts` (Low-level API client for Gupshup Partner APIs).
