# API Routes Reference

This document provides a comprehensive list of the API endpoints available in wApi, grouped by module. All routes are located in `src/app/api/`.

## 1. Authentication & Session (`/api/auth/*`)
- **`POST /api/auth/login`**: Authenticate with email/password.
- **`POST /api/auth/signup`**: Create a new account.
- **`GET /api/auth/session`**: Retrieve the current user's session and onboarding step.
- **`POST /api/auth/otp/send`**: Dispatch an OTP for email or mobile verification.
- **`POST /api/auth/otp/verify`**: Validate an OTP.
- **`POST /api/auth/logout`**: Terminate the current session.
- **`POST /api/auth/switch-workspace`**: Change the active workspace for the user.
- **`GET /api/auth/workspaces`**: List all workspaces the user has access to.
- **`GET /api/auth/invitation/[token]`**: Validate and accept a team invitation.

## 2. Inbox & Messaging (`/api/inbox/*`, `/api/messaging/*`)
- **`GET /api/inbox`**: Fetch active conversations for the workspace.
- **`GET /api/inbox/[id]/messages`**: Retrieve message history for a specific conversation.
- **`POST /api/inbox/[id]/read`**: Mark a conversation as read.
- **`POST /api/messaging/quick-replies`**: Manage canned responses for agents.
- **`POST /api/upload/media`**: Upload images/videos for use in messaging.

## 3. CRM & Sales (`/api/crm/*`)
- **`GET/POST /api/crm/deals`**: Manage sales deals.
- **`PATCH /api/crm/deals/[id]/stage`**: Move a deal between pipeline stages.
- **`GET /api/crm/pipelines`**: Retrieve sales pipeline configurations.
- **`GET/POST /api/crm/tasks`**: Manage follow-up tasks for contacts.
- **`GET /api/crm/analytics`**: Sales performance metrics.

## 4. Automation & AI (`/api/automation/*`)
- **`GET/POST /api/automation/engine/rules`**: Manage automated workflow rules.
- **`POST /api/automation/engine/rules/[id]/execute`**: Manually trigger a workflow.
- **`GET /api/automation/engine/logs`**: Audit trail of automation executions.
- **`POST /api/automation/answerbot/sources`**: Manage knowledge base sources for the AI bot.
- **`GET /api/automation/ai-intent`**: Manage AI intent classification.

## 5. Marketing & Campaigns (`/api/campaigns/*`, `/api/templates/*`)
- **`POST /api/campaigns/create`**: Launch a new bulk message broadcast.
- **`GET /api/campaigns/[id]/lifecycle`**: Monitor the progress of a running campaign.
- **`GET /api/templates`**: List WhatsApp-approved message templates.
- **`POST /api/templates/sync`**: Manually trigger a template sync with Meta/Gupshup.

## 6. Billing & Wallet (`/api/workspace/billing/*`)
- **`POST /api/workspace/billing/recharge`**: Initiate a wallet top-up via Razorpay.
- **`POST /api/workspace/billing/recharge/verify`**: Verify the payment signature from Razorpay.
- **`GET /api/workspace/billing/plan`**: Retrieve the current subscription plan details.

## 7. Workspace & Team (`/api/workspace/*`)
- **`GET/POST /api/workspace/team`**: Manage team members and invitations.
- **`GET /api/workspace/team/roles`**: Manage RBAC roles and permissions.
- **`POST /api/workspace/business-info`**: Update the business profile.

## 8. Integrations (`/api/integrations/*`)
- **`GET /api/integrations/google/auth-url`**: Start Google OAuth for Sheets integration.
- **`POST /api/integrations/[type]/sync`**: Trigger a manual sync for an integration.

## 9. Super Admin (`/api/super-admin/*`)
- **`GET /api/super-admin/stats`**: Platform-wide usage and revenue metrics.
- **`GET /api/super-admin/workspaces`**: List and manage all workspaces on the platform.
- **`POST /api/super-admin/workspaces/[id]/impersonate`**: Log in as a workspace owner for support.
- **`POST /api/super-admin/plans/seed`**: Initialize the platform subscription plans.

## 10. Webhooks (`/api/webhooks/*`)
- **`POST /api/webhooks/whatsapp`**: Main entry point for all incoming WhatsApp/Instagram events.
- **`POST /api/webhooks/razorpay`**: Receives payment success notifications from Razorpay.
