# Detailed Messaging Flow

This document explains the end-to-end journey of a message in wApi, from the external webhook to the real-time UI update, and the reverse path for outbound messages.

## 1. Inbound Message Flow (WhatsApp/Instagram/Facebook)

When a customer sends a message, the following sequence occurs:

```mermaid
sequenceDiagram
    participant P as Meta/Gupshup
    participant R as API Route (/api/webhooks/*)
    participant Q as BullMQ (whatsapp-webhooks)
    participant W as WebhookProcessor (Worker)
    participant D as MongoDB
    participant S as SocketService
    participant F as Frontend (React)

    P->>R: POST Webhook Payload
    R->>Q: Add job to queue
    Q-->>W: Pick up job
    W->>D: Resolve Workspace (appId/phoneId)
    W->>D: Upsert Contact & Conversation
    W->>D: Create Message (received)
    W->>D: Increment usage (UsageTracker)
    W->>S: emitNewInboundMessage
    S-->>F: socket.emit("message:new")
    W->>W: Trigger Automation Engine
```

### Key Components:
- **`src/dashboard/api/webhooks/gupshup/route.ts`**: The entry point. It does minimal processing and pushes to the queue to ensure fast response times (preventing webhook timeouts).
- **`src/lib/services/messaging/webhook-processor.ts`**: The core logic.
  - **Normalization**: Converts provider-specific payloads (Gupshup V3, Meta Cloud API) into a unified internal `Message` format.
  - **Deduplication**: Uses `whatsappMessageId` to prevent processing the same webhook twice.
  - **Media Handling**: Extracts media IDs and captions for images, videos, stickers, and documents.
  - **Rich Types**: Handles Interactive (buttons/lists), Flows (NFM), and Locations.
- **`src/lib/services/socket-service.ts`**: Uses `Socket.io` to broadcast the new message only to the relevant workspace and assigned agents.

---

## 2. Outbound Message Flow

When an agent or automation sends a message:

```mermaid
sequenceDiagram
    participant F as Frontend/Automation
    participant S as WabaService
    participant G as GupshupService
    participant L as LedgerService
    participant P as Meta/Gupshup API
    participant D as MongoDB

    F->>S: sendTextMessage(workspaceId, phone, body)
    S->>L: ensureWalletBalance(amount)
    S->>D: Create Message (pending)
    S->>G: sendMessageViaPartner(payload)
    G->>P: POST /partner/dashboard/message
    P-->>G: 200 OK (gsId)
    G-->>S: Success
    S->>L: deduct(amount)
    S->>D: Update Message (sent, gsId)
```

### Key Components:
- **`src/lib/services/messaging/waba-service.ts`**: High-level API for sending Text, Templates, Media, and Interactive messages. It handles the orchestration between the database, billing, and the partner gateway.
- **`src/lib/services/messaging/gupshup-service.ts`**: Handles the low-level HTTP requests to Gupshup, including authentication and response normalization.
- **`src/lib/services/billing/ledger-service.ts`**: Ensures the workspace has enough credits before allowing the message to be sent.

---

## 3. Message Status Updates

Status updates (Sent -> Delivered -> Read) follow a similar path to Inbound messages but call `processStatuses` instead of `processInbound`.

- **Funnel Tracking**: Status updates for campaign messages also update the `Campaign` model's aggregate statistics (`deliveredCount`, `readCount`, etc.) in real-time.
- **Batched Emission**: To prevent socket congestion during high-volume updates, statuses are batched before being emitted to the UI.
