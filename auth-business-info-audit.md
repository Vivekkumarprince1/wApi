# Auth and Business Info Deep Audit

## Scope

This audit covers the current path from authentication through onboarding and business-info completion into the dashboard and WhatsApp/BSP setup.

Relevant implementation files:

- [frontend-wapi/app/auth/register/page.jsx](frontend-wapi/app/auth/register/page.jsx)
- [frontend-wapi/app/auth/login/page.jsx](frontend-wapi/app/auth/login/page.jsx)
- [frontend-wapi/app/auth/google/callback/page.jsx](frontend-wapi/app/auth/google/callback/page.jsx)
- [frontend-wapi/app/onboarding/business-info/page.jsx](frontend-wapi/app/onboarding/business-info/page.jsx)
- [frontend-wapi/store/authStore.js](frontend-wapi/store/authStore.js)
- [frontend-wapi/lib/api/auth.js](frontend-wapi/lib/api/auth.js)
- [frontend-wapi/lib/api/onboarding.js](frontend-wapi/lib/api/onboarding.js)
- [server/src/controllers/auth/authController.js](server/src/controllers/auth/authController.js)
- [server/src/controllers/workspace/onboardingController.js](server/src/controllers/workspace/onboardingController.js)
- [server/src/controllers/bsp/bspOnboardingController.js](server/src/controllers/bsp/bspOnboardingController.js)

## Current Flow

### 1) Authentication Entry

The app supports the following auth paths:

- Email/password signup
- Email/password login
- Google sign-in
- Facebook sign-in
- OTP-based auth flows that remain available in the backend

The important shift is that the backend now owns the session bootstrap contract. It sets the `auth_token` cookie and returns a unified `/auth/session` response that includes user, workspace, phone, onboarding, stage-1, and `nextStep` data.

### 2) Session Bootstrap

`/auth/session` is the key orchestration endpoint.

It provides:

- user identity and verification flags
- workspace hydration data
- phone verification state
- stage-1 WhatsApp/BSP completion state
- a server-derived `nextStep`

That means the frontend no longer has to guess the next screen from a collection of local conditions. The server already decides whether the user should go to:

- email verification
- mobile verification
- business info
- dashboard

### 3) Register Flow

The register page creates the user, refreshes session, and routes based on `session.nextStep`.

In practice this means:

- signup creates the account immediately
- backend sets the cookie
- client reloads the unified session
- frontend uses the server’s onboarding destination

This is a cleaner and safer design than the old OTP-first UX because the route decision is centralized.

### 4) Login and Social Login Flow

Login and social login follow the same pattern:

- authenticate
- refresh `/auth/session`
- route to `session.nextStep`

Google callback is also aligned with this model. It waits for session bootstrap and then navigates according to the server-defined next step.

### 5) Business Info Flow

The business-info page hydrates from the unified session payload and captures structured business fields:

- business name
- industry
- website
- address
- city, state, country, zip code
- certification type and number
- description

On save it writes to the onboarding endpoint and then refreshes session so the store stays in sync.

### 6) Post-Business Info Onboarding

Saving business info is not the end of onboarding.

The remaining journey is driven by WhatsApp/BSP completion:

- `stage1Complete`
- `phoneStatus`
- BSP connect modal / runtime profile / sync

That separation is correct: business profile completion and WhatsApp activation are related, but they are not the same milestone.

## Features Present

### Auth Features

- Cookie-backed auth session
- Unified session bootstrap
- Google and Facebook sign-in
- Password login and signup
- Server-derived next-step routing

### Onboarding Features

- Phone verification before business info
- Structured business profile capture
- GST/MSME/PAN document capture
- Workspace hydration from the session payload
- Business-info completion tracking

### WhatsApp/BSP Features

- Stage-1 completion tracking
- Provider sync / runtime profile support
- Dashboard gating based on connection state
- Post-business-info activation path

### State and UX Features

- Zustand-based auth store
- Session hydration on demand
- Route gating from the same source of truth
- Unified onboarding redirects instead of page-specific guesses

## Correctness Audit

### Remaining Correctness Risks

1. The `nextStep` contract is now critical infrastructure.

Because the pages rely on `session.nextStep`, any new auth or onboarding entrypoint must preserve this field. If it is omitted or renamed, the funnel regresses quickly.


4. Social auth parity still needs ongoing discipline.

Google and Facebook are now aligned with the same session bootstrap path as email/password auth, but any new fields or defaults added to the standard signup path should also be mirrored for social-auth users.

5. Save operations that can trigger provider submission should stay idempotent.

`saveBusinessInfo` may also submit business verification when provider credentials are present. That is fine, but it needs to remain tolerant of retries and partial failures.

## Performance Audit

### Current Bottlenecks

1. `/auth/session` is intentionally broad.

This improves correctness and reduces client-side branching, but it is not the fastest possible first paint.

2. Stage-1 and runtime checks can still be expensive.

Anything that reaches live BSP status, runtime profile, or dashboard analytics adds latency compared with a pure auth bootstrap.

3. The dashboard still loads heavy data separately.

That is appropriate for the dashboard itself, but it should remain separate from auth/bootstrap so the login path stays fast.

### Fast Wins

- Keep `/auth/session` as the only required bootstrap call after auth.
- Lazy-load analytics, usage, and dashboard metrics after the user reaches the destination page.
- Cache stable onboarding fields and only refetch them after mutations.
- Avoid adding more state checks on the client when the server already knows the next route.
- Keep live BSP/runtime data on the WhatsApp profile and diagnostics screens, not the login path.

## Improvement Plan

### Phase 1: Lock the Session Contract

1. Treat `nextStep` as a formal API field.

The frontend should not re-derive onboarding routing from multiple booleans if the server already provides the next destination.

2. Keep `/auth/session` stable.

Any new data added to the session response should be additive and should not force the auth path to change.

3. Preserve parity across auth methods.

Email/password, Google, Facebook, and any OTP-based flows should all converge on the same session shape.

### Phase 2: Split Bootstrap from Heavy Hydration

1. Keep auth bootstrap fast.

If the session payload keeps growing, split non-critical analytics and runtime profile data into secondary fetches after login.

2. Keep onboarding hydration minimal but complete.

The onboarding pages should only load the data needed to render and route correctly.

3. Fetch live BSP details only where needed.

The WhatsApp profile or BSP settings screens can pay the cost of runtime reads; the auth funnel should not.

### Phase 3: Strengthen State Management

1. Move onboarding into an explicit state model.

The current route contract is already close to a state machine. Making it explicit will reduce illegal transitions and make the funnel easier to reason about.

2. Keep one source of truth for each layer.

Recommended split:

- session for auth and routing
- onboarding for profile completion
- BSP stage-1 for WhatsApp activation
- dashboard analytics for usage and reporting

3. Make redirects declarative.

Use the server-derived `nextStep` and a single route guard pattern instead of page-specific guesses.

### Phase 4: Security and Hardening

1. Add CSRF protection if cookie-based session endpoints become broader.

2. Add audit logs for key auth and onboarding events.

3. Keep provider-side writes idempotent and retry-safe.

4. Continue normalizing social auth user defaults.

### Phase 5: Make It Fast at Scale

1. Cache stable onboarding state.

2. Defer dashboard-heavy reads until after initial route render.

3. Keep image/document processing server-side and optimized before storage.

4. Avoid coupling auth boot to analytics payloads.
