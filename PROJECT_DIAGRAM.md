# wApi — Complete Project Architecture Diagram

---

## 1. HIGH-LEVEL SYSTEM OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          wApi — WhatsApp SaaS Platform                          │
└─────────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐     HTTP/WS      ┌──────────────────────────────────────────┐
  │   Browser   │ ◄─────────────► │         FRONTEND  :3000                  │
  │   (User)    │                  │         Next.js 15 + React               │
  └─────────────┘                  └──────────────────┬───────────────────────┘
                                                       │ REST + WebSocket
                                                       ▼
  ┌─────────────┐    Webhooks      ┌──────────────────────────────────────────┐
  │  Gupshup    │ ─────────────► │                                          │
  │  BSP (WA)   │                  │           SERVER  :5001                  │
  │             │ ◄───────────── │      Express.js Monolith (Main API)      │
  └─────────────┘   API Calls     │      166+ endpoints  │  Socket.IO        │
                                   └───┬──────┬───────┬───┘
  ┌─────────────┐                     │      │       │   internal HTTP
  │  Meta Graph │ ◄───────────────────┘      │       ├──────────────────────────┐
  │  API (FB/IG)│                             │       │                          │
  └─────────────┘                             │       ▼                          ▼
                                              │  ┌────────────┐   ┌────────────────────┐
  ┌─────────────┐                             │  │ AUTOMATION │   │  CAMPAIGN SERVICE  │
  │ Google OAuth│ ◄───────────────────────────┘  │ SERVICE    │   │  :3002             │
  │ Cloudinary  │                                 │ :3001      │   │                    │
  │ Email/SMS   │                                 └─────┬──────┘   └────────┬───────────┘
  └─────────────┘                                       │                   │
                                                        │         ┌─────────▼──────────┐
                                                        │         │  BILLING SERVICE   │
                                                        │         │  :3003             │
                                                        │         └─────────┬──────────┘
                                                        │                   │
                                   ┌────────────────────▼───────────────────▼──────────┐
                                   │                   INFRASTRUCTURE                   │
                                   │  ┌─────────────────────┐  ┌─────────────────────┐ │
                                   │  │   MongoDB  :27017   │  │    Redis  :6379     │ │
                                   │  │  wa_saas (main)     │  │  Sessions / Cache   │ │
                                   │  │  wapi_automation    │  │  BullMQ Queues      │ │
                                   │  │  wa_campaigns       │  │  Socket.IO Pub/Sub  │ │
                                   │  │  wapi_billing       │  │  Rate Limiting      │ │
                                   │  └─────────────────────┘  └─────────────────────┘ │
                                   └───────────────────────────────────────────────────┘
```

---

## 2. FRONTEND  (Next.js 15 — Port 3000)

```
frontend/src/
│
├── app/                         ← Next.js App Router Pages
│   ├── auth/                    ← Login, Signup, OAuth, OTP, Reset Password
│   ├── dashboard/               ← Main dashboard & overview
│   ├── inbox/                   ← Conversation inbox (real-time)
│   ├── contacts/                ← Contact management & CRM
│   ├── crm/                     ← CRM pipeline views
│   ├── campaign/                ← Broadcast campaign manager
│   ├── automation/              ← Chatbot / workflow builder
│   ├── templates/               ← WhatsApp message templates
│   ├── analytics/               ← Reports & analytics dashboards
│   ├── commerce/                ← E-commerce / product catalog
│   ├── integrations/            ← 3rd-party integrations
│   ├── billing/                 ← Plans, wallet, invoices
│   ├── settings/                ← Workspace & profile settings
│   ├── support/                 ← Support tickets
│   ├── ads/                     ← Click-to-WhatsApp Ads
│   ├── widget/                  ← Chat widget embed
│   ├── onboarding/              ← New user onboarding flow
│   └── super-admin/             ← Super-admin panel
│
├── components/
│   ├── ui/                      ← Base UI components (shadcn)
│   ├── layout/                  ← Sidebar, header, shell
│   ├── auth/                    ← Auth forms & guards
│   ├── dashboard/               ← Dashboard widgets
│   ├── automation/              ← Flow / bot builder UI
│   ├── workflows/               ← Workflow editor components
│   ├── billing/                 ← Billing UI
│   ├── integrations/            ← Integration cards
│   ├── modals/                  ← Global modals
│   ├── shared/                  ← Shared components
│   ├── providers/               ← Context providers (Auth, Socket, Theme)
│   ├── landing/                 ← Landing page components
│   └── super-admin/             ← Super-admin components
│
├── store/                       ← Zustand global state
├── hooks/                       ← Custom React hooks
├── lib/                         ← API client, utils, constants
└── config/                      ← App config, env vars

  Connects to:
  ┌──────────────────────────────────────────────┐
  │  NEXT_PUBLIC_API_URL    → http://server:5001  │
  │  NEXT_PUBLIC_SOCKET_URL → http://server:5001  │
  └──────────────────────────────────────────────┘
```

---

## 3. SERVER  (Express.js Monolith — Port 5001)

```
server/src/
│
├── routes/  (25 route files)
│   ├── authRoutes.ts            ← login, signup, OTP, Google, Facebook, invites
│   ├── workspaceRoutes.ts       ← workspace CRUD, members, teams
│   ├── conversationRoutes.ts    ← inbox, assign, snooze, close
│   ├── messageRoutes.ts         ← send/receive messages, media
│   ├── contactRoutes.ts         ← contacts, tags, segments
│   ├── templateRoutes.ts        ← WA template management
│   ├── analyticsRoutes.ts       ← reports, chat analytics
│   ├── campaignRoutes.ts        ← broadcast campaigns (→ campaign-service)
│   ├── flowRoutes.ts            ← WA Flows builder
│   ├── automationRoutes.ts      ← chatbot/automation (→ automation-service)
│   ├── integrationRoutes.ts     ← Google Sheets, Petpooja, webhooks
│   ├── commerceRoutes.ts        ← product catalog, orders
│   ├── billingRoutes.ts         ← plans, subscriptions (→ billing-service)
│   ├── settingsRoutes.ts        ← workspace & channel settings
│   ├── crmRoutes.ts             ← CRM fields, pipelines
│   ├── adsRoutes.ts             ← Click-to-WA ads
│   ├── uploadRoutes.ts          ← media/file uploads (Cloudinary)
│   ├── webhookRoutes.ts         ← inbound WA/FB/IG webhooks
│   ├── supportRoutes.ts         ← support tickets
│   ├── onboardingRoutes.ts      ← WABA onboarding
│   ├── adminRoutes.ts           ← admin controls
│   ├── internalRoutes.ts        ← service-to-service internal endpoints
│   ├── developerRoutes.ts       ← API keys, developer tools
│   ├── metricsRoutes.ts         ← system metrics
│   ├── widgetRoutes.ts          ← chat widget endpoints
│   ├── bulkOperationsRoutes.ts  ← bulk import/export
│   ├── healthRoutes.ts          ← health check
│   └── compatRoutes.ts          ← legacy compatibility
│
├── controllers/                 ← Request handlers (per route)
│
├── services/                    ← Business Logic
│   ├── messaging/
│   │   ├── gupshup-service.ts   ← Send WA via Gupshup BSP
│   │   ├── facebook-service.ts  ← Facebook Messenger
│   │   ├── instagram-service.ts ← Instagram DM
│   │   ├── waba-service.ts      ← WABA management
│   │   ├── conversation-service.ts
│   │   ├── contact-service.ts
│   │   ├── inbox-service.ts
│   │   ├── webhook-processor.ts ← Inbound event processing
│   │   ├── webhook-queue.ts     ← BullMQ webhook queue
│   │   ├── email-service.ts
│   │   ├── sms-service.ts
│   │   ├── auto-assign-service.ts
│   │   └── meta-graph-client.ts
│   ├── bsp/
│   │   ├── gupshup-partner-service.ts
│   │   ├── gupshup-token-service.ts
│   │   └── gupshup-app-assignment-service.ts
│   ├── integrations/
│   │   ├── google-sheets-service.ts
│   │   ├── petpooja-service.ts
│   │   └── integration-orchestrator.ts
│   ├── auth/                    ← JWT, OAuth, OTP, sessions
│   ├── workspace/               ← workspace, teams, members
│   ├── automation/              ← automation bridge → automation-service
│   ├── billing/                 ← billing bridge → billing-service
│   ├── marketing/               ← campaign orchestration
│   ├── commerce/                ← catalog, orders
│   ├── security/                ← rate limiting, audit logs
│   ├── onboarding/              ← WABA onboarding steps
│   ├── shared/                  ← common utilities
│   ├── super-admin/
│   ├── socket-service.ts        ← Socket.IO room/event management
│   ├── socket-bridge.ts         ← Bridge to microservices
│   ├── real-time-event-service.ts
│   ├── notification-service.ts
│   ├── microservice-event-bridge.ts
│   └── activity-logging-service.ts
│
├── models/  (MongoDB Schemas)
│   ├── messaging/
│   │   ├── Contact.ts           ← CRM contacts
│   │   ├── Conversation.ts      ← Chat threads
│   │   ├── Message.ts           ← Individual messages
│   │   ├── Tag.ts
│   │   ├── QuickReply.ts
│   │   ├── WhatsAppFlow.ts
│   │   └── FormSubmission.ts
│   ├── auth/
│   │   ├── User.ts
│   │   ├── Role.ts
│   │   ├── Permission.ts
│   │   ├── Plan.ts
│   │   └── OtpChallenge.ts
│   ├── workspace/
│   │   ├── Workspace.ts
│   │   ├── Team.ts
│   │   └── WorkspaceInvitation.ts
│   ├── template/                ← WA message templates
│   ├── bsp/                     ← BSP configs
│   ├── commerce/                ← Products, orders
│   ├── analytics/               ← Analytics snapshots
│   ├── integration/             ← Integration configs
│   ├── onboarding/              ← Onboarding state
│   ├── support/                 ← Support tickets
│   ├── system/                  ← System settings
│   ├── super-admin/             ← Super-admin models
│   └── ActivityLog.ts           ← Audit trail
│
├── middlewares/
│   ├── authMiddleware.ts        ← JWT authentication
│   ├── rateLimitMiddleware.ts   ← Per-route rate limiting
│   └── ...
│
├── workers/
│   ├── bulkMessageWorker.ts     ← BullMQ: bulk message sending
│   └── importWorker.ts          ← BullMQ: contact CSV import
│
├── sockets/
│   └── socketHandler.ts         ← Socket.IO (Redis adapter for scale)
│
└── config/                      ← DB, Redis, env configuration
```

---

## 4. AUTOMATION SERVICE  (Port 3001)

```
automation-service/src/
│
├── routes/
│   ├── engineRoutes.ts          ← Automation engine (trigger/execute flows)
│   ├── aiIntentRoutes.ts        ← AI intent detection
│   ├── answerBotRoutes.ts       ← Answer bot / FAQ bot
│   ├── whatsappFormRoutes.ts    ← WA Forms automation
│   ├── instagramQuickflowRoutes.ts ← Instagram quick-reply flows
│   └── interaktiveListRoutes.ts ← Interactive list message flows
│
├── services/
│   ├── automation-service.ts    ← Core automation orchestrator
│   ├── workflow-service.ts      ← Workflow CRUD & versioning
│   ├── flow-executor.ts         ← Step-by-step flow execution engine
│   ├── ai-intent-service.ts     ← NLP / intent classification
│   ├── answer-bot-service.ts    ← FAQ matching & response
│   ├── answerbot-crawler-service.ts ← Web crawl for answer bot KB
│   ├── auto-reply-service.ts    ← Keyword-based auto replies
│   ├── variable-service.ts      ← Template variables & substitution
│   ├── safety-guards.ts         ← Loop prevention, rate guards
│   ├── simple-action-executor.ts ← Simple action runner
│   └── external/                ← Calls back to server:5001
│
├── workers/
│   └── scheduler.ts             ← Scheduled / delayed automation triggers
│
├── models/                      ← Automation-specific MongoDB models
└── lib/                         ← Shared utilities

  DB: mongodb://mongo:27017/wapi_automation
  Calls back to: http://server:5001 (internal)
```

---

## 5. CAMPAIGN SERVICE  (Port 3002)

```
campaign-service/src/
│
├── routes/
│   ├── campaignRoutes.ts        ← Create, schedule, send campaigns
│   └── segmentRoutes.ts         ← Audience segmentation
│
├── services/
│   └── (campaign execution logic)
│
├── workers/
│   └── CampaignWorker.ts        ← BullMQ: broadcast message delivery
│
├── lib/
│   └── events/                  ← Event emitters for campaign status
│
└── models/                      ← Campaign & segment MongoDB models

  DB:         mongodb://mongo:27017/wa_campaigns
  Calls to:   http://server:5001   (monolith internal)
              http://billing-service:3003 (credit checks)
```

---

## 6. BILLING SERVICE  (Port 3003)

```
billing-service/src/
│
├── routes/
│   ├── walletRoutes.ts          ← Wallet balance, top-up, deduction
│   ├── commerceRoutes.ts        ← Plan purchase, subscription
│   └── webhookRoutes.ts         ← Payment gateway webhooks
│
├── services/
│   └── (billing, wallet, subscription logic)
│
├── events/                      ← Billing event pub/sub
├── models/                      ← Billing MongoDB models
└── lib/                         ← Stripe / payment gateway clients

  DB: mongodb://mongo:27017/wapi_billing
```

---

## 7. SHARED PACKAGES

```
packages/
└── contracts/                   ← Shared TypeScript types & interfaces
    ├── src/                     ← Event contracts between services
    └── package.json             ← Internal package (@wapi/contracts)

gupshup/                         ← Gupshup BSP Documentation & API Reference
    ├── documentation/           ← Gupshup partner API concepts
    │   ├── introduction.md
    │   ├── whatsapp-messages.md
    │   ├── inbound-events.md
    │   ├── billing-events.md
    │   ├── onboarding-apis.md
    │   ├── flow-management-apis.md
    │   └── ... (30+ docs)
    └── api-reference/           ← Endpoint reference docs
```

---

## 8. INFRASTRUCTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                          MongoDB :27017                         │
│                                                                 │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │   wa_saas    │  │ wapi_automation  │  │  wa_campaigns    │  │
│  │  (main DB)   │  │                 │  │                  │  │
│  │  Users       │  │  Workflows      │  │  Campaigns       │  │
│  │  Workspaces  │  │  AutomationLogs │  │  Segments        │  │
│  │  Contacts    │  │  IntentModels   │  │  BroadcastLogs   │  │
│  │  Messages    │  │  AnswerBotKB    │  │                  │  │
│  │  Templates   │  └─────────────────┘  └──────────────────┘  │
│  │  Flows       │                                              │
│  │  Analytics   │  ┌──────────────────┐                       │
│  │  Plans/Roles │  │  wapi_billing    │                       │
│  └──────────────┘  │  Wallets         │                       │
│                     │  Transactions    │                       │
│                     │  Subscriptions   │                       │
│                     └──────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                           Redis :6379                           │
│                                                                 │
│  ┌──────────────────┐  ┌───────────────┐  ┌─────────────────┐ │
│  │  BullMQ Queues   │  │  Socket.IO    │  │  Rate Limiting  │ │
│  │  webhook-queue   │  │  Redis Adapter│  │  Sessions/Cache │ │
│  │  bulk-msg-queue  │  │  (pub/sub)    │  │  OTP Codes      │ │
│  │  import-queue    │  │               │  │                 │ │
│  │  campaign-queue  │  └───────────────┘  └─────────────────┘ │
│  │  scheduler-queue │                                          │
│  └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. EXTERNAL INTEGRATIONS

```
┌──────────────────────────────────────────────────────────────────┐
│                      External Services                          │
│                                                                  │
│  ┌──────────────────┐   ┌──────────────────┐                   │
│  │  Gupshup BSP     │   │  Meta Graph API  │                   │
│  │  partner.gupshup │   │  graph.facebook  │                   │
│  │  .io             │   │  .com/v18.0/     │                   │
│  │                  │   │                  │                   │
│  │  • Send WA msgs  │   │  • WA Business   │                   │
│  │  • WABA onboard  │   │  • Facebook Page │                   │
│  │  • Token mgmt    │   │  • Instagram DM  │                   │
│  │  • Billing evts  │   │  • Ads Manager   │                   │
│  │  • WA Flows API  │   │  • Click-to-WA   │                   │
│  └──────────────────┘   └──────────────────┘                   │
│                                                                  │
│  ┌──────────────────┐   ┌──────────────────┐                   │
│  │  Google APIs     │   │  Cloudinary      │                   │
│  │                  │   │                  │                   │
│  │  • OAuth 2.0     │   │  • Media upload  │                   │
│  │  • Google Sheets │   │  • Image/video   │                   │
│  │  • Gmail (email) │   │    storage & CDN │                   │
│  └──────────────────┘   └──────────────────┘                   │
│                                                                  │
│  ┌──────────────────┐   ┌──────────────────┐                   │
│  │  Petpooja        │   │  Email / SMS      │                   │
│  │  (Restaurant POS │   │                  │                   │
│  │   integration)   │   │  • OTP delivery  │                   │
│  └──────────────────┘   │  • Notifications │                   │
│                          └──────────────────┘                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 10. DATA & EVENT FLOW

```
── INBOUND MESSAGE FLOW ──────────────────────────────────────────

  WhatsApp User
       │ sends message
       ▼
  Gupshup BSP ──webhook──► server:5001/api/webhooks
                                    │
                            webhook-processor.ts
                            webhook-queue.ts (BullMQ)
                                    │
                          ┌─────────┴──────────┐
                          │                    │
                   Save to MongoDB      Trigger Automation
                   (Message model)             │
                          │                    ▼
                   Emit via Socket      automation-service:3001
                   (real-time to UI)    (check flows/triggers)
                          │
                   frontend/inbox
                   (real-time update)


── OUTBOUND MESSAGE FLOW ─────────────────────────────────────────

  Agent (via UI)
       │
       ▼
  frontend ──POST──► server:5001/api/messages
                              │
                      gupshup-service.ts
                      (or facebook/instagram)
                              │
                              ▼
                       Gupshup BSP / Meta API
                              │
                              ▼
                       WhatsApp User ✓


── CAMPAIGN BROADCAST FLOW ───────────────────────────────────────

  User creates campaign (UI)
       │
       ▼
  server:5001 ──HTTP──► campaign-service:3002
                                │
                        Check billing credit
                        ──HTTP──► billing-service:3003
                                │
                        Enqueue CampaignWorker (BullMQ)
                                │
                        Batch send via server:5001
                                │
                        Gupshup BSP → Users


── AUTOMATION TRIGGER FLOW ───────────────────────────────────────

  Inbound webhook received
       │
       ▼
  server:5001 ──HTTP──► automation-service:3001
                                │
                        ai-intent-service (classify)
                        flow-executor (run steps)
                        variable-service (fill vars)
                                │
                        ──HTTP──► server:5001/internal
                                (send reply messages)
```

---

## 11. DOCKER SERVICES SUMMARY

```
┌──────────────────────────────────────────────────────────────────┐
│                      docker-compose.yml                          │
├─────────────────────┬────────────┬──────────────────────────────┤
│  Service            │  Port      │  MongoDB DB                  │
├─────────────────────┼────────────┼──────────────────────────────┤
│  frontend           │  3000      │  —                           │
│  server             │  5001      │  wa_saas                     │
│  automation-service │  3001      │  wapi_automation             │
│  campaign-service   │  3002      │  wa_campaigns                │
│  billing-service    │  3003      │  wapi_billing                │
│  mongo              │  27017     │  (all DBs)                   │
│  redis              │  6379      │  —                           │
└─────────────────────┴────────────┴──────────────────────────────┘

Service Dependencies:
  frontend           → server
  server             → mongo, redis
  automation-service → mongo, redis, server
  campaign-service   → mongo, redis, server, billing-service
  billing-service    → mongo, redis
```

---

## 12. AUTHENTICATION & SECURITY FLOW

```
  ┌─────────────────────────────────────────────────────────┐
  │                  Auth Methods                           │
  │                                                         │
  │  Email + Password ──► OTP verify ──► JWT issued         │
  │  Google OAuth     ──► callback  ──► JWT issued          │
  │  Facebook OAuth   ──► callback  ──► JWT issued          │
  │  Mobile OTP       ──► verify    ──► JWT issued          │
  │  Invitation Link  ──► token     ──► JWT issued          │
  └─────────────────────────────────────────────────────────┘

  JWT Flow:
    Client ──[Authorization: Bearer <token>]──► server
                                                   │
                                          authMiddleware.ts
                                          verifies JWT
                                                   │
                                          Role/Permission check
                                          (RBAC: Role, Permission models)
                                                   │
                                          ✅ Proceed to controller
```

---

## 13. FEATURE MAP

```
┌──────────────────────────────────────────────────────────────────┐
│                        Core Features                            │
│                                                                  │
│  📨 INBOX           Real-time multi-channel inbox               │
│                     (WhatsApp, Facebook, Instagram)             │
│                                                                  │
│  👥 CONTACTS        CRM contact management, tags, segments      │
│                                                                  │
│  📢 CAMPAIGNS       Broadcast messaging, scheduling, analytics  │
│                                                                  │
│  🤖 AUTOMATION      Chatbot flows, AI intent, answer bot        │
│                     WhatsApp Forms, keyword triggers            │
│                                                                  │
│  📝 TEMPLATES       WhatsApp Business message templates         │
│                                                                  │
│  📊 ANALYTICS       Chat reports, agent performance, metrics    │
│                                                                  │
│  🛒 COMMERCE        Product catalog, orders via WhatsApp        │
│                                                                  │
│  🔗 INTEGRATIONS    Google Sheets, Petpooja POS, Webhooks       │
│                                                                  │
│  💳 BILLING         Plans, wallet, usage-based billing          │
│                                                                  │
│  🏢 WORKSPACE       Multi-workspace, teams, roles, permissions  │
│                                                                  │
│  📡 ADS             Click-to-WhatsApp ad management            │
│                                                                  │
│  🔧 WIDGET          Embeddable chat widget for websites         │
│                                                                  │
│  🛡️ SUPER-ADMIN     Platform-level admin & management          │
└──────────────────────────────────────────────────────────────────┘
```

---

*Generated: 2026-05-12 | Project: wApi WhatsApp SaaS Platform*
