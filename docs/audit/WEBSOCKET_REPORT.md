# WebSocket Report — 2026-06-10

## Transport
- Single socket.io server (websocket-gateway :3009) behind the gateway's only `ws:true` proxy at `/socket.io`; `server.on('upgrade')` wired explicitly (websocket-first clients work). ✅ verified reachable.
- Handshake auth: `auth.token` → `Authorization: Bearer` → `auth_token` cookie; JWT verified with shared JWT_SECRET. Frontend (`use-socket.ts`) connects via NEXT_PUBLIC_SOCKET_URL=127.0.0.1:5001 → proxied. ✅
- Redis adapter for fan-out; Kafka consumer feeds room emissions.

## Client→server events (frontend emits / server handles)
| Event | Server handler | Status |
|---|---|---|
| workspace:join / workspace:leave | ✅ (membership check, `socket:error` on forbidden) | OK |
| conversation:join / conversation:leave | ✅ (workspace check) | OK |
| typing | ✅ → `conversation:typing` + `inbox:typing` | OK |

## Server→client events
Emitted & consumed: `server:ping`, `inbox:message_new`, `inbox:message_status`, `inbox:conversation_updated`, `conversation:updated`, `conversation:status-updated`, `contact:updated`, `automation:*`, `billing:event`, `wallet:recharged`, `campaign:event`, `inbox:sync`, `platform:event`, `agent:online`.

## Dead listeners (frontend listens; server never emits — no functional loss, covered by other events)
- `inbox:message_sent` (inbox/page.tsx — `inbox:message_new` already fires for outbound)
- `inbox:status_batch` (per-message `inbox:message_status` fires instead)
- `campaign:message_status_batch` (socket-hub.tsx — server emits `campaign:event`)

Recommendation: either emit these aliases from websocket-gateway's Kafka handlers or remove the listeners; left as-is (harmless) and documented.
