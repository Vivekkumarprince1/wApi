# Onboarding Optimization Audit

## Scope
This audit covers the path from business info save through Gupshup provisioning, embedded signup, webhook sync, stage 1 completion, and the dashboard fallback path.

The goal is to make onboarding faster, more reliable, and easier to resume without changing the business outcome.

## Executive Summary
The current flow works, but it is split across multiple state sources and two onboarding implementations:
- `saveBusinessInfo` starts background provisioning immediately after the local save.
- `bspOnboardingController` has a more complete BSP flow with stateful embed handling, stage 1 sync, and callback bridging.

That split creates the main risk: the UI can say onboarding is done or in progress while the Gupshup side is still creating the app, updating contact data, or generating the embed link. The result is extra polling, unclear failure states, and avoidable retry loops.

## Current Flow
1. User verifies email and mobile, then reaches business info.
2. Business info is saved locally and `workspace.onboarding.businessInfoCompleted` is set.
3. Background provisioning starts and tries to:
   - create or reuse a Gupshup app,
   - update onboarding contact details,
   - fetch the app-scoped token,
   - configure webhook subscriptions,
   - generate the embedded signup link.
4. Frontend redirects to `/dashboard?connectWhatsApp=1` unless stage 1 is already complete.
5. Dashboard opens the connect modal, and onboarding status is polled until WhatsApp is connected.
6. After the Gupshup callback, stage 1 completion is finalized and the app is routed back to the dashboard.

## Main Findings

### 1. Business info is marked complete before provisioning is actually complete
`saveBusinessInfo` saves the workspace and immediately marks `businessInfoCompleted`, then fires provisioning in the background.

This is fast, but it is optimistic. If app creation, contact update, webhook setup, or embed-link generation fails, the user still sees a mostly-complete onboarding state even though the Gupshup side is not ready.

Relevant code paths:
- [server/src/controllers/workspace/onboardingController.js](server/src/controllers/workspace/onboardingController.js)
- [server/src/services/auth/signupProvisioningService.js](server/src/services/auth/signupProvisioningService.js)
- [frontend-wapi/app/auth/business-info/page.jsx](frontend-wapi/app/auth/business-info/page.jsx)

### 2. Onboarding state is spread across too many fields
The code currently mixes:
- `workspace.onboarding.businessInfoCompleted`
- `workspace.onboarding.completed`
- `workspace.esbFlow.status`
- `workspace.whatsappConnected`
- `workspace.stage1.complete`
- `workspace.bspPhoneStatus`

This makes redirects and permissions harder to reason about. The frontend and backend are not using a single authoritative state machine, so edge cases can easily fall through the cracks.

### 3. The dashboard fallback can trap users in a waiting loop
The dashboard opens the connect modal when `connectWhatsApp=1` is present or when a callback payload exists. If WhatsApp is not yet connected, the user stays in the onboarding loop until state changes.

There is no hard timeout, no explicit retry budget, and no clear escape hatch when provisioning is delayed or partially failed.

Relevant code paths:
- [frontend-wapi/app/dashboard/page.jsx](frontend-wapi/app/dashboard/page.jsx)
- [frontend-wapi/bekar/components/features/BspOnboarding.jsx](frontend-wapi/bekar/components/features/BspOnboarding.jsx)

### 4. Polling is fixed and unbounded
The BSP onboarding component polls status every 10 seconds when not connected, and every 30 seconds for pending phone activation. That is acceptable for a short-lived flow, but there is no timeout or backoff strategy.

If a Gupshup step stalls, the app can keep polling indefinitely with no actionable message.

### 5. The implementation should converge on the more complete BSP flow
The current onboarding controller already contains a more complete flow that:
- bridges the Gupshup callback,
- persists ESB state durably,
- completes onboarding from callback code and state,
- stores stage 1 completion in a dedicated endpoint.

That flow is better aligned with Gupshup's onboarding model and should become the single source of truth.

## App Reuse Deep Dive

The app reuse feature exists in two places, and they do not behave the same way.

### Where reuse happens
1. [server/src/services/bsp/bspOnboardingServiceV2.js](server/src/services/bsp/bspOnboardingServiceV2.js) checks both `workspace.gupshupAppId` and `workspace.gupshupIdentity.partnerAppId` first. If either exists, it reuses the existing app and skips creation.
2. [server/src/services/bsp/gupshupProvisioningService.js](server/src/services/bsp/gupshupProvisioningService.js) also checks for an existing app before creating a new one, but it is part of the older background provisioning path.
3. [server/src/controllers/bsp/bspOnboardingController.js](server/src/controllers/bsp/bspOnboardingController.js) later treats either `gupshupAppId` or `gupshupIdentity.partnerAppId` as the active app for sync and completion.

### How the reuse decision works
- If a workspace already has an app ID, the code prefers reuse over creation.
- If the app ID is missing, a new app is created and then written back into both `gupshupAppId` and `gupshupIdentity.partnerAppId` in the BSP V2 flow.
- Downstream messaging, template submission, sync, and webhook routing also resolve the app from the same fallback chain.

### Why this is important
This is the right idea for performance and stability because Gupshup apps are not meant to be recreated on every retry.

Reuse reduces:
- partner API calls,
- collision risk from duplicate app names,
- onboarding time on retry,
- the chance of orphaned embed links or partially configured apps.

### What is weak today
The code still has two different app-creation styles:
- the legacy background service creates an app first and assumes the rest of the flow will succeed later,
- the BSP V2 flow reuses existing app IDs more explicitly and is better structured for returning users.

That means app reuse is present, but not yet canonical. A retry may still go through a different path, and that can re-run contact updates, subscription setup, or embed-link generation even when the app already exists.

### Recommended reuse policy
Make the BSP V2 reuse path the only canonical path:
- reuse any existing app ID immediately,
- create only if no app exists,
- keep app creation idempotent,
- only regenerate embed links when the callback or onboarding state requires it,
- never let a retry create a second app for the same workspace.

### Best supporting signals for reuse
The following fields should decide reuse and recovery:
- `gupshupIdentity.partnerAppId`
- `gupshupAppId`
- `esbFlow.status`
- `whatsappConnected`
- `bspPhoneStatus`

If those fields disagree, treat the workspace as needing reconciliation, not fresh app creation.

## Sandbox vs New App Creation

If your question is whether to continue with a sandbox app that already exists when the user record is missing, the answer is:

- Use the sandbox app only for a shared demo, test, or fallback environment.
- Do not use the sandbox app as the real tenant-owned app for onboarding.
- Create or reuse a workspace-bound app when the goal is a real customer onboarding.

### Why
The sandbox path is good for speed, but it breaks tenant isolation:
- multiple users would share the same app identity,
- webhook routing becomes ambiguous,
- app status and contact data can be overwritten,
- you lose a clean one-workspace-one-app mapping.

### Best rule for this product
1. If the workspace already has `gupshupAppId` or `gupshupIdentity.partnerAppId`, reuse it.
2. If the workspace does not have an app, create one for that workspace.
3. Only fall back to a sandbox app when you are explicitly in demo mode or the account is not yet provisioned for live onboarding.

### Practical implementation rule
Treat sandbox as a mode flag, not as the primary onboarding identity. The real onboarding flow should always attach to a workspace-owned app record.

## Gupshup Alignment

The current implementation should follow the partner flow described in Gupshup's onboarding docs:
1. Create app.
2. Set contact details.
3. Configure webhook subscriptions.
4. Generate the embedded signup link.
5. Complete Meta embedded signup.

Gupshup also expects:
- a public webhook endpoint,
- a fast webhook response,
- V3 subscription support for Meta passthrough events,
- rate-limit awareness,
- reuse/whitelisting when migrating from OBO to Embed.

Relevant docs:
- [gupshup/api-reference/03-onboarding-apis.md](gupshup/api-reference/03-onboarding-apis.md)
- [gupshup/api-reference/04-subscription-management.md](gupshup/api-reference/04-subscription-management.md)
- [gupshup/api-reference/08-waba-management.md](gupshup/api-reference/08-waba-management.md)
- [gupshup/documentation/onboarding-apis.md](gupshup/documentation/onboarding-apis.md)
- [gupshup/documentation/create-your-first-app.md](gupshup/documentation/create-your-first-app.md)
- [gupshup/documentation/webhook-key-points.md](gupshup/documentation/webhook-key-points.md)
- [gupshup/documentation/partner-rate-limits.md](gupshup/documentation/partner-rate-limits.md)
- [gupshup/documentation/what-is-sp-tp.md](gupshup/documentation/what-is-sp-tp.md)

## Recommended Target State

### Authoritative state machine
Use one onboarding state machine with explicit transitions such as:
- `business_info_saved`
- `app_ready`
- `contact_synced`
- `subscriptions_ready`
- `embed_ready`
- `embed_started`
- `callback_received`
- `stage1_complete`
- `failed`

Derive UI behavior from that machine only.

### Idempotent provisioning
Make provisioning safe to retry:
- reuse `gupshupAppId` if it already exists,
- do not recreate the app on every retry,
- re-run contact and subscription setup safely,
- regenerate the embed link only when needed.

### Progress, not just success/failure
Expose provisioning progress back to the frontend so the dashboard can show a real step tracker instead of a generic connect modal.

### Better fallback UX
If provisioning fails or times out:
- show the failure reason,
- keep the user on the dashboard,
- show a retry CTA,
- preserve the last successful step,
- allow support to resume from the last good state.

## Optimization Plan

### Phase 1: Make the flow reliable
1. Unify onboarding state into a single source of truth.
2. Make the business-info save response include provisioning status, not just `workspace`.
3. Persist provisioning progress after each Gupshup step.
4. Add a hard timeout and retry budget to the onboarding poller.
5. Make the dashboard fallback show a clear error or retry path.

### Phase 2: Reduce duplicate work
1. Reuse existing Gupshup app IDs when present.
2. Avoid re-running contact updates unless user data changed.
3. Skip embed regeneration unless the callback or app state changed.
4. Cache the last successful subscription and only reconcile drift.

### Phase 3: Optimize for Gupshup partner behavior
1. Use the public webhook URL and keep webhook handlers fast.
2. Prefer V3 subscriptions for passthrough event handling.
3. Keep onboarding steps rate-limit aware and retry-friendly.
4. For OBO-to-Embed migrations, whitelist the WABA and verify the credit-line attachment before embed.

## Suggested Product Rules

- If business info saves successfully but embed generation fails, do not call the onboarding finished.
- If Gupshup contact or webhook setup fails, keep the app in a recoverable provisioning state.
- If stage 1 is incomplete, show a visible reconnect CTA rather than a silent background loop.
- If the callback is received but the stage 1 sync is delayed, keep the user on a status page with a refresh action.

## Fastest Safe Improvement Path
If you want the shortest path to a better onboarding experience, do these first:
1. Point the UI to a single onboarding state machine.
2. Make the provisioning job idempotent.
3. Add explicit provisioning error states and retry UI.
4. Add a poll timeout with a backoff curve.
5. Reuse the existing BSP controller flow as the canonical path.

## Bottom Line
The fastest and safest improvement is not to make onboarding more optimistic. It is to make it more explicit.

Save business info locally, then show real provisioning progress, then start embed only when the Gupshup app, contact, subscription, and callback state are actually ready. That will make the app feel faster to users because it becomes more predictable, not because it hides the waiting.