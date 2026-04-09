# Onboarding End-to-End Audit

## Scope

This audit covers the onboarding path after business info is saved successfully, through WhatsApp/BSP setup, stage-1 completion, sync, and the final completed state.

Relevant implementation files:

- [frontend-wapi/app/onboarding/business-info/page.jsx](frontend-wapi/app/onboarding/business-info/page.jsx)
- [frontend-wapi/app/onboarding/verify-mobile/page.jsx](frontend-wapi/app/onboarding/verify-mobile/page.jsx)
- [frontend-wapi/app/onboarding/verify-email/page.jsx](frontend-wapi/app/onboarding/verify-email/page.jsx)
- [frontend-wapi/app/dashboard/page.jsx](frontend-wapi/app/dashboard/page.jsx)
- [frontend-wapi/components/modals/ConnectNumberModal.jsx](frontend-wapi/components/modals/ConnectNumberModal.jsx)
- [frontend-wapi/app/dashboard/settings/whatsapp-profile/page.jsx](frontend-wapi/app/dashboard/settings/whatsapp-profile/page.jsx)
- [frontend-wapi/store/authStore.js](frontend-wapi/store/authStore.js)
- [frontend-wapi/lib/api/onboarding.js](frontend-wapi/lib/api/onboarding.js)
- [server/src/controllers/workspace/onboardingController.js](server/src/controllers/workspace/onboardingController.js)
- [server/src/controllers/bsp/bspOnboardingController.js](server/src/controllers/bsp/bspOnboardingController.js)
- [server/src/controllers/bsp/gupshupWebhookController.js](server/src/controllers/bsp/gupshupWebhookController.js)

## Current Flow

### 1) Business Info Saved

The business-info page saves the workspace profile first, then routes the user to the dashboard.

Backend behavior:

- `saveBusinessInfo()` updates workspace business fields
- it marks `workspace.onboarding.businessInfoCompleted = true`
- it sets `workspace.onboarding.businessInfoCompletedAt`
- if WhatsApp business-account data exists, it may also submit business verification to the provider

This means business info completion is not the end of onboarding. It is the start of the WhatsApp/BSP connection phase.

### 2) Route After Business Info

The frontend sends the user to `/dashboard` after saving.

From there, onboarding continues via entry points like:

- dashboard connect actions
- `?connectWhatsApp=1`
- WhatsApp profile settings
- feature gates that redirect to connect flow

### 3) WhatsApp Connect Modal

`ConnectNumberModal` is the primary user-facing continuation of onboarding.

It does three things:

1. Starts BSP onboarding with `bspStart()`
2. Opens the provider flow in a popup
3. Polls `bspStage1Status()` until the connection is considered complete

Completion detection currently accepts any of these signals:

- `stage1.complete`
- a connected/active phone status
- `stage1.checklist.phoneConnected`

Once completion is detected, the modal:

- calls `bspSync()`
- refetches auth/session state
- closes itself

### 4) BSP Callback and Completion

The BSP backend flow is split into callback + completion:

- `startBspOnboarding()` generates the provider URL and stores a state value in Redis
- `handleCallback()` returns a bridge page that hands `code` and `state` back to the frontend
- `completeOnboarding()` exchanges the provider code, updates workspace fields, and persists connection state
- `triggerSync()` can refresh the workspace after completion

### 5) Final State

The backend final state is spread across multiple fields:

- `workspace.whatsappConnected`
- `workspace.connectedAt`
- `workspace.onboardingStatus`
- `workspace.esbFlow.status`
- `workspace.esbFlow.completedAt`
- `workspace.onboarding.wabaConnectionCompleted`
- `workspace.onboarding.wabaConnectionCompletedAt`

Webhook processing can also promote the workspace to connected/live:

- `gupshupWebhookController` sets `workspace.onboardingStatus = 'LIVE'`
- it marks `workspace.whatsappConnected = true`
- it sets `workspace.esbFlow.status = 'completed'`

## Features Present

### User Flow Features

- Business profile capture and save
- Mobile verification step before business info
- WhatsApp/BSP embedded signup
- Popup-based provider flow
- Automatic polling for completion
- Runtime sync after connection
- WhatsApp profile management and deregistration

### System Features

- Redis-backed BSP state tracking
- Stage-1 status endpoint
- Provider callback bridge page
- Event-driven webhook completion handling
- Post-onboarding automation trigger
- Role and feature gating based on completion state

## Correctness Audit

### High Priority Issues

1. There is no single source of truth for “onboarding complete.”

The app currently uses several different completion signals:

- `businessInfoCompleted`
- `wabaConnectionCompleted`
- `esbFlow.status`
- `whatsappConnected`
- `stage1.complete`
- `phoneStatus`
- `onboardingStatus`

Impact:

- UI can disagree with backend state
- one page may say onboarding is done while another still shows it as incomplete
- debugging becomes hard because the final state is derived, not explicit

2. The frontend considers several partial states as “connected.”

`dashboard/page.jsx` treats `stage1Complete` or an active phone status as connected.

That is a useful UX shortcut, but it is not equivalent to final onboarding completion.

Impact:

- users may see connected status before the backend has fully synced
- downstream features may unlock early
- state can appear successful while provider sync is still pending

3. `ConnectNumberModal` can close before the backend is fully settled.

The modal closes after stage-1 polling detects success, then it triggers `bspSync()` in the background.

Impact:

- if sync fails, the UI still looks finished
- connection metadata may lag behind the visible success state
- completion is optimistic instead of authoritative

4. The provider callback bridge splits the completion path between popup and dashboard.

The backend bridge page posts a message or redirects back with `code` and `state`, while the modal also polls stage-1 status.

Impact:

- two completion mechanisms can race each other
- callback success, polling success, and sync success are not unified
- errors are harder to reason about when they happen mid-transition

5. Completion depends on status values that are not normalized everywhere.

The frontend checks multiple phone-status strings, while backend controllers persist both workflow state and live provider state.

Impact:

- case sensitivity and status drift can produce false positives or false negatives
- onboarding may complete in one view but not another

### Medium Priority Issues

6. The WhatsApp profile page pulls from three sources at once.

It reads:

- `/auth/me`
- `/onboarding/bsp/stage1-status`
- `/settings/waba`
- runtime profile

Impact:

- extra round trips
- stale combinations of persisted and live data
- more complexity in a page that should mostly render final state

7. `saveBusinessInfo()` may silently do extra provider work.

After saving workspace details, it may submit business verification to the provider if tokens are present.

Impact:

- a simple profile save can trigger hidden external side effects
- failures in provider submission are masked as non-fatal
- users may not know whether the business submission actually happened

8. The backend completion path mixes persistence and post-processing.

`completeOnboarding()` updates workspace state, and webhooks can later update the same workspace again.

Impact:

- duplicate completion writes are possible
- the final completion timestamp may move depending on which path won the race
- the data model is harder to trust for auditing

## Performance Audit

### Main Bottlenecks

1. Polling-based completion detection.

`ConnectNumberModal` polls every 5 seconds for stage-1 status.

2. Multiple fetches to build one page state.

WhatsApp profile and dashboard both combine session, stage-1, runtime, and settings reads.

3. Extra refetch after completion.

The modal does completion detection, then sync, then session refetch, then close.

### Fast Wins

- Use one normalized onboarding status response for all onboarding pages.
- Replace broad polling with a provider callback acknowledgement plus one server-side status refresh.
- Cache the final completion state and only refresh runtime fields when the user enters the WhatsApp profile page.
- Keep live provider reads separate from persisted onboarding state.
- Make `bspSync()` explicit and user-visible instead of silently backgrounded.

## Improvement Plan

### Phase 1: Define the End State

1. Add one authoritative onboarding completion flag.

Recommended shape:

- `onboarding.status = 'completed' | 'in_progress' | 'blocked' | 'not_started'`
- `onboarding.completedAt`
- `onboarding.currentStep`
- `onboarding.blockers[]`

2. Derive all UI from that single status.

The dashboard, WhatsApp profile page, and feature gates should read the same completion source.

3. Keep provider-specific details as supporting data, not the status source.

### Phase 2: Simplify the Transition Chain

1. Make the modal responsible for starting the flow, not deciding the final truth.

It should:

- launch provider onboarding
- receive callback payload
- ask the server to finalize
- wait for the finalized result

2. Make backend finalization idempotent.

`completeOnboarding()` and webhook-driven completion should both be safe to call more than once.

3. Avoid treating `stage1.complete` as the same thing as final completion.

`stage1` should only mean the phone connection is ready, not that the whole onboarding journey is finished.

### Phase 3: Optimize Runtime Behavior

1. Collapse repeated state reads.

Dashboard and WhatsApp profile should not each rebuild the same onboarding picture from four endpoints.

2. Prefer event-driven completion updates.

When the provider callback arrives or the webhook confirms activation, update the backend once and let the client refresh a single status endpoint.

3. Separate persisted data from live provider state.

Persisted onboarding completion should be stable.
Live runtime profile should be fetched only when the user needs diagnostics.

### Phase 4: Make the UX Clear

1. Show a clear onboarding timeline after business info is saved.

The user should see:

- Business info saved
- Mobile verified
- WhatsApp signup in progress
- Phone activation pending or connected
- Onboarding complete

2. Make the final success page explicit.

Once the backend considers onboarding complete, route the user to a final success state, not just the dashboard.

3. Distinguish “connected” from “completed.”

Connected means the WhatsApp flow is live.
Completed means the onboarding journey is finished and the workspace is ready.

## Recommended Target Model

The cleanest end-state model is:

- `businessInfoCompleted` for profile save
- `phoneVerified` for mobile validation
- `whatsappConnected` for provider connection
- `onboarding.completed` for final completion

That makes each step measurable and avoids overloading stage-1 status with final onboarding semantics.

## Bottom Line

The post-business-info onboarding path is functional, but the current implementation is too distributed. The biggest problem is that “done” is inferred from a mix of partial states instead of a single authoritative completion record.

If we normalize the final onboarding state, make completion idempotent, and reduce the polling/refetch chain, the flow becomes much easier to trust and faster to finish.