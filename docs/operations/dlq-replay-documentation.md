# Dead Letter Queue (DLQ) & Replay Operations Guide

This guide describes the dead letter queue (DLQ) architecture and administrative replay operations in wApi.

---

## 1. DLQ Architecture

When a consumer in any service (e.g., `chat-service`, `service-provider`, or `websocket-gateway`) fails to process a Kafka event:
1. It automatically retries the operation up to **3 times** with exponential backoff.
2. If processing still fails after the maximum retries, the event is redirected to a **Dead Letter Queue (DLQ)**.
3. The DLQ topic name is constructed by appending `-dlq` to the original topic name. For example:
   - `parsed-message-events` $\rightarrow$ `parsed-message-events-dlq`
   - `chat-realtime-sync` $\rightarrow$ `chat-realtime-sync-dlq`
   - `raw-webhook-events` $\rightarrow$ `raw-webhook-events-dlq`
4. The dead-lettered message contains custom header metadata to assist in diagnostics:
   - `x-dead-letter-reason`: The error message that caused the processing failure.
   - `x-dead-letter-attempts`: The number of processing attempts made before giving up.

---

## 2. Replay API

An internal administrative API endpoint is exposed via the API Gateway to replay messages from a DLQ topic back to its primary topic for processing.

- **Endpoint:** `POST /api/internal/dlq/replay` (proxies to `/api/internal/dlq/replay` on `chat-service`)
- **Headers:**
  - `Content-Type: application/json`
  - `x-internal-service-secret`: `<INTERNAL_SERVICE_SECRET>`
- **Request Body:**
  ```json
  {
    "topic": "parsed-message-events-dlq",
    "limit": 50
  }
  ```
- **Response Format:**
  ```json
  {
    "success": true,
    "replayedCount": 42,
    "targetTopic": "parsed-message-events"
  }
  ```

---

## 3. Replay Workflow (Step-by-Step)

The replay process performs the following operations:
1. Initializes a temporary Kafka consumer bound to the consumer group `wapi-dlq-replay-group` (which commits its offsets to avoid processing the same dead-letter twice on subsequent calls).
2. Connects to the specified DLQ topic (e.g., `parsed-message-events-dlq`) and fetches up to the `limit` (default: 50) messages.
3. Publishes the fetched messages back to the primary topic (e.g., `parsed-message-events`).
4. Commits the offsets for the read messages to mark them as successfully replayed and cleared from the DLQ.

---

## 4. Example Replay Command

To manually trigger a replay of up to 100 failed messages:

```bash
curl -X POST http://localhost:5001/api/internal/dlq/replay \
  -H "Content-Type: application/json" \
  -H "x-internal-service-secret: dev-internal-service-secret-change-me" \
  -d '{
    "topic": "parsed-message-events-dlq",
    "limit": 100
  }'
```
