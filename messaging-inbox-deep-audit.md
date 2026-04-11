# Messaging and Inbox Deep Audit

## Scope

This audit covers the inbox conversation list, message thread, composer, start-conversation flow, template sending, internal notes, media upload, and the shared messaging API wrappers.

Relevant code paths:

- [frontend-wapi/app/dashboard/inbox/page.jsx](frontend-wapi/app/dashboard/inbox/page.jsx)
- [frontend-wapi/components/dashboard/inbox/MessageThread.jsx](frontend-wapi/components/dashboard/inbox/MessageThread.jsx)
- [frontend-wapi/components/dashboard/inbox/ConversationsSidebar.jsx](frontend-wapi/components/dashboard/inbox/ConversationsSidebar.jsx)
- [frontend-wapi/components/dashboard/inbox/ChatInput.jsx](frontend-wapi/components/dashboard/inbox/ChatInput.jsx)
- [frontend-wapi/components/dashboard/inbox/TemplateSelectorModal.jsx](frontend-wapi/components/dashboard/inbox/TemplateSelectorModal.jsx)
- [frontend-wapi/components/dashboard/inbox/StartConversationModal.jsx](frontend-wapi/components/dashboard/inbox/StartConversationModal.jsx)
- [frontend-wapi/components/dashboard/inbox/ContactDetailsSidebar.jsx](frontend-wapi/components/dashboard/inbox/ContactDetailsSidebar.jsx)
- [frontend-wapi/lib/api/messages.js](frontend-wapi/lib/api/messages.js)
- [frontend-wapi/store/socketStore.js](frontend-wapi/store/socketStore.js)
- [server/src/controllers/messaging/messageController.js](server/src/controllers/messaging/messageController.js)
- [server/src/routes/messaging/messageRoutes.js](server/src/routes/messaging/messageRoutes.js)

## Executive Summary

The inbox is broadly functional and has solid realtime wiring, but there are several correctness issues that will show up in normal use:

- media sends from a conversation-less state are routed through the plain text send endpoint, which the backend rejects because it requires a message body,
- internal note deletion calls `del(...)` from the messaging API wrapper without importing it,
- the template sender modal posts to a path that does not match the backend messaging routes,
- quick-reply filtering assumes every reply has `name` and `content`, which makes the composer brittle when malformed data slips through.

The highest-risk item is the media send path, because it breaks a user-facing send action that the UI explicitly supports.

## Main Findings

### 1. Media sends without an active conversation fail at the backend boundary

In the inbox page, the media branch falls back to `POST /messages/send` when there is no `selectedConversationId`. That payload includes `contactId`, `type`, `mediaUrl`, `filename`, and `caption`, but no `body`.

The backend `sendMessage` handler immediately requires `body` and returns `400 Message body is required` before it can process the media payload. So a user can pick a file, upload it, and still fail the send if the conversation has not been persisted yet.

Relevant code:
- [frontend-wapi/app/dashboard/inbox/page.jsx](frontend-wapi/app/dashboard/inbox/page.jsx#L664)
- [server/src/controllers/messaging/messageController.js](server/src/controllers/messaging/messageController.js#L94)

### 2. Deleting a conversation note throws because `del` is not imported

The messaging API wrapper exports `deleteConversationNote`, but the file only imports `post`, `get`, `put`, and `API_URL`. `del` is used at the call site without being imported, which will throw a `ReferenceError` as soon as the delete action runs.

This is a straightforward runtime bug and should be fixed before relying on note cleanup in production.

Relevant code:
- [frontend-wapi/lib/api/messages.js](frontend-wapi/lib/api/messages.js#L1)
- [frontend-wapi/lib/api/messages.js](frontend-wapi/lib/api/messages.js#L54)

### 3. Template sending from the inbox points at the wrong endpoint family

The inbox template modal sends templates with `POST /templates/${selectedTemplate._id}/send`. The backend routes exposed for messaging are `POST /messages/send`, `POST /messages/template`, and `POST /messages/bulk-template`; there is no matching messaging route for `/templates/:id/send` in the inspected route table.

The result is either a dead action or a path that depends on some other hidden route family, which makes the inbox template flow hard to reason about and easy to break.

Relevant code:
- [frontend-wapi/components/dashboard/inbox/TemplateSelectorModal.jsx](frontend-wapi/components/dashboard/inbox/TemplateSelectorModal.jsx#L71)
- [server/src/routes/messaging/messageRoutes.js](server/src/routes/messaging/messageRoutes.js#L16)
- [server/src/routes/messaging/messageRoutes.js](server/src/routes/messaging/messageRoutes.js#L25)
- [server/src/controllers/messaging/messageController.js](server/src/controllers/messaging/messageController.js#L187)

### 4. Quick-reply filtering is not null-safe

The composer filters quick replies with `r.name.toLowerCase()` and `r.content.toLowerCase()`. That assumes both fields always exist and are strings. If the quick-reply API ever returns a partial record, a migrated legacy object, or a reply with only one field populated, typing a slash command can crash the input path.

This is a smaller issue than the send-path bugs, but it is still a user-facing stability risk in a high-frequency interaction surface.

Relevant code:
- [frontend-wapi/components/dashboard/inbox/ChatInput.jsx](frontend-wapi/components/dashboard/inbox/ChatInput.jsx#L43)

## Secondary Risks

- The inbox page mixes `_id` and `id` fallbacks across conversations and contacts. That is pragmatic, but it increases the chance of shape drift between API responses and optimistic UI updates.
- Socket-driven updates are well covered, but the store connection still depends on auth/session state being synchronized correctly before realtime events start flowing.
- The inbox UI has several separate send paths for text, media, notes, templates, and new-conversation bootstrap. That gives users flexibility, but it also multiplies the number of API contracts that can drift.

## Sticker And Quick Reply Notes

Sticker is currently a display concept, not a working send path.

- The webhook parser understands inbound sticker messages.
- The BSP media sender only supports image, video, document, and audio.
- The inbox composer had a smiley control, but it did not launch any actual picker or sticker flow.

Recommended decision:

- keep sticker support out of the inbox composer until the BSP sender can actually send it,
- or replace the smiley control with a real emoji picker if the goal is only to improve text composition.

Quick replies are not created inside inbox. They live in Settings.

- The inbox fetches `GET /quick-replies` on load and renders whatever exists.
- The settings page at [frontend-wapi/app/dashboard/settings/quick-replies/page.jsx](frontend-wapi/app/dashboard/settings/quick-replies/page.jsx) is the actual management surface.
- If the inbox shows zero quick replies, it usually means the workspace has none created yet, or the API returned an empty list for that workspace.

Recommended UX:

- keep the composer quick-reply popover as a consumer of saved replies,
- add a visible link to the quick-replies manager when the list is empty,
- do not duplicate create/edit forms in the inbox unless you want a second source of truth.

## Recommended Fix Order

1. Fix media send handling so the conversation-less branch calls the correct endpoint or includes the required body field.
2. Import `del` into the messaging API wrapper and verify note deletion end to end.
3. Repoint the inbox template modal to the backend messaging template endpoint and confirm payload shape.
4. Harden quick-reply filtering and other inbox list filters against missing fields.

## Fast Validation List

After the fixes, I would verify these flows manually:

- start a brand-new outbound conversation with text and confirm it queues successfully,
- attach media before a conversation exists and confirm the send succeeds,
- create, update, and delete an internal note,
- send an approved template from the inbox modal,
- type slash commands in the composer when quick replies contain partial or malformed data.

## Interakt-Style Direction

If the goal is to make this feel closer to Interakt, the product should lean harder into a single, guided inbox workflow instead of multiple competing entry points.

Recommended direction:

- make the center thread the primary workspace and treat the conversation list as a triage surface only,
- keep the composer state explicit: session reply, internal note, media attachment, or template re-open,
- surface the 24-hour window as a first-class banner with a clear template CTA when the window is closed,
- keep assignment, tags, labels, SLA, and notes in the contact rail, not mixed into the message composer,
- use template selection as the canonical reopen path for cold leads instead of a generic new chat action,
- preserve optimistic updates, but show the server result and session state so agents know what actually happened.

What to avoid:

- a generic "New Chat" entry point that looks like a fresh outbound start but still depends on session-window rules,
- duplicate send paths that expose the same behavior through different endpoints and different UI surfaces,
- empty-state copy that promises actions the backend cannot always complete.

## Target State

The inbox should behave like a structured workbench:

1. Open an existing conversation and respond normally when the 24-hour session is active.
2. When the session is closed, force the agent toward a template-based re-open flow.
3. Keep internal notes clearly separate from customer messages.
4. Keep media upload, tags, labels, and assignment available without changing the meaning of the send action.
5. Make every send path return a visible success or failure state that matches the backend result.

That target state is better aligned with Interakt-like operator UX and reduces the chance that agents think they can start a cold chat when the system will reject it.
