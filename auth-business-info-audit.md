# Auth and Business Info Deep Audit

## Scope

This audit covers the current authentication and business-info onboarding flow across the frontend and backend.

Relevant implementation files:

- [frontend-wapi/app/auth/register/page.jsx](frontend-wapi/app/auth/register/page.jsx)
- [frontend-wapi/app/auth/login/page.jsx](frontend-wapi/app/auth/login/page.jsx)
- [frontend-wapi/app/auth/reset/page.jsx](frontend-wapi/app/auth/reset/page.jsx)
- [frontend-wapi/app/auth/google/callback/page.jsx](frontend-wapi/app/auth/google/callback/page.jsx)
- [frontend-wapi/app/onboarding/business-info/page.jsx](frontend-wapi/app/onboarding/business-info/page.jsx)
- [frontend-wapi/store/authStore.js](frontend-wapi/store/authStore.js)
- [frontend-wapi/lib/api/auth.js](frontend-wapi/lib/api/auth.js)
- [frontend-wapi/lib/api/onboarding.js](frontend-wapi/lib/api/onboarding.js)
- [server/src/routes/auth/authRoutes.js](server/src/routes/auth/authRoutes.js)
- [server/src/routes/workspace/onboardingRoutes.js](server/src/routes/workspace/onboardingRoutes.js)
- [server/src/controllers/auth/authController.js](server/src/controllers/auth/authController.js)
- [server/src/controllers/workspace/onboardingController.js](server/src/controllers/workspace/onboardingController.js)

## Current Flow

### 1) Signup and Login

The system currently supports multiple auth paths:

- Email/password signup and login
- OTP-based signup and login
- Google OAuth
- Facebook OAuth

The problem is not the number of options. The problem is that the frontend and backend are not aligned on which flow is canonical.

### 2) Register Flow

The register page currently behaves like an OTP-first wizard, but the backend `signup` endpoint creates the user immediately and returns a JWT.

That means the UI assumes:

- user submits details
- OTP is sent
- user verifies OTP
- account is completed afterward

But the backend actually does:

- validate email/password
- create workspace
- create user
- return token immediately

This is a major flow mismatch.

### 3) Login Flow

The login page does a standard email/password login or social login, stores the token in `localStorage`, mirrors it into a non-httpOnly cookie, then fetches session and onboarding state.

The redirect decision is based on:

- phone verification
- business info completion

### 4) Social Login Flow

Google and Facebook both end up issuing a JWT and then the frontend fetches onboarding state to decide where to route the user.

Google has two distinct flows:

- frontend button fetches Google auth URL and redirects to Google
- backend callback exchanges the auth code and redirects back with a JWT in the URL

That callback token handoff works, but it is not the safest pattern.

### 5) Business Info Flow

The business-info page loads both `/auth/me` and `/onboarding/status`, then pre-fills the form from the workspace object.

On submit it posts to `/onboarding/business-info` and then routes to dashboard.

The backend saves business data into the workspace and marks `businessInfoCompleted = true`.

## Features Present

### Auth Features

- Email/password auth
- Signup OTP support
- Login OTP support
- Google OAuth
- Facebook OAuth
- Session fetch and route gating
- Logout and account deletion support

### Onboarding Features

- Email verification
- Mobile verification
- Business info capture
- Business document capture for GST/MSME/PAN
- Workspace creation during signup
- Onboarding status retrieval
- BSP stage-1 status for WhatsApp-related gating

### State and Access Features

- JWT stored client-side
- Auth cookie mirrored from the token
- Zustand auth store
- Socket auto-connect based on auth state
- Feature gating based on role and plan

## Correctness Audit

### High Priority Issues

1. Register page and backend signup are out of sync.

The frontend register page waits for an OTP flow after `registerUser()`, but the backend `/auth/signup` route creates the account immediately and returns `{ token, user }`.

Impact:

- user onboarding is confusing
- the UI can show OTP-related states that never happen
- signup behavior is fragile and may regress silently

2. Reset page is using login OTP endpoints instead of reset-password endpoints.

The current reset page sends a login OTP and then logs the user in with the returned token.

But the backend already provides a proper reset flow:

- `/auth/request-password-reset`
- `/auth/reset-password`

Impact:

- password reset is not really password reset
- users are being authenticated, not forced to set a new password
- security expectations are wrong

3. Google callback stores the JWT in the URL.

The backend redirects back to `/auth/google/callback?token=...` and the frontend stores it from query params.

Impact:

- token exposure in browser history
- token leakage through logs, referrers, or copied URLs
- avoidable security risk

4. Business info save requires verified email, but the onboarding UI does not make that dependency explicit.

`saveBusinessInfo` rejects unverified emails, while the business-info page only checks phone verification and onboarding status.

Impact:

- some users can get routed to a page that cannot complete successfully
- Google/Facebook-created users are especially at risk if `emailVerified` is not set

5. Social auth users can be blocked by the business-info email-verification rule.

Google and Facebook user creation paths do not consistently set `emailVerified` the way signup does.

Impact:

- social sign-in may appear successful but fail during onboarding
- support burden rises because the failure happens later in the flow

### Medium Priority Issues

6. Auth state is split across several endpoints.

The frontend combines:

- `/auth/me`
- `/onboarding/status`
- `/onboarding/bsp/stage1-status`

Impact:

- extra round trips
- inconsistent snapshots
- hard-to-debug route decisions

7. Token storage is duplicated.

The token is stored in `localStorage` and mirrored into a regular cookie.

Impact:

- wider attack surface than necessary
- hard to reason about source of truth
- XSS still exposes the token

8. Session fetch is rate-limited with a fixed 3-second window.

`fetchSession()` uses an in-flight promise plus a minimum interval.

Impact:

- can hide fast auth changes
- can delay recovery after login/logout
- can complicate debugging when state appears stale

9. Email verification compares only the first six characters of the token.

The backend token generation and token display are coupled in a fragile way.

Impact:

- verification depends on a presentation detail
- future token format changes will be risky

10. Business info capture is incomplete relative to backend capability.

The backend accepts more structured business fields than the current form surfaces cleanly, especially around address granularity and document handling.

Impact:

- partially captured profiles
- extra manual data fixes later

## Performance Audit

### Main Bottlenecks

1. Too many post-login reads.

After login, the app fetches auth state and onboarding state separately. That is acceptable for small scale, but it is not the fastest or cleanest pattern.

2. Duplicate state synchronization.

Auth store, socket store, cookie, and localStorage all participate in session management.

3. Unnecessary route churn.

The app often logs in, fetches session, fetches onboarding, then decides the route.

### Fast Wins

- Merge session + onboarding into a single response shape.
- Avoid redirecting through a tokenized query string.
- Reduce duplicate client storage of auth tokens.
- Precompute the onboarding destination server-side when possible.
- Cache stable onboarding data until a mutation occurs.

## Improvement Plan

### Phase 1: Fix Correctness First

1. Make register flow canonical.

Pick one signup model and remove the other path from the primary UX.

Recommended option:

- keep email/password signup as immediate account creation
- keep OTP only for verification, not as a second hidden signup model

2. Replace the reset page with the real reset flow.

The reset UI should use:

- request-password-reset
- reset-password

not login OTP.

3. Remove JWT from Google callback URL.

Use one of these instead:

- short-lived one-time code handoff
- httpOnly session cookie
- exchange code endpoint with client-side polling

4. Make email verification rules explicit in onboarding.

If business info requires a verified email, show that requirement before the form loads.

5. Normalize Google/Facebook user creation.

Ensure social auth users get the same onboarding flags and session shape as standard signup users.

### Phase 2: Consolidate State

1. Introduce a single session contract.

The frontend should consume one normalized response that includes:

- user
- workspace
- auth status
- onboarding status
- feature gating flags

2. Make onboarding a small state machine.

The current boolean-step model should become a single source of truth with explicit stages.

3. Make route guards read from one store.

The login/register pages, business-info page, and dashboard should all use the same derived session model.

### Phase 3: Optimize for Speed

1. Reduce network calls after login.

Replace separate auth and onboarding fetches with a single session bootstrap endpoint.

2. Defer non-critical data.

Load only the data required for routing first, then fetch secondary profile and analytics data after the user reaches the destination.

3. Cache stable state.

Onboarding status does not need to be refetched on every render. Refetch it only after a mutation or explicit refresh.

4. Simplify auth token handling.

Prefer server-managed session cookies if feasible. If JWT must stay client-managed, keep one storage location and treat it as the single source of truth.

### Phase 4: Harden Security

1. Move away from token-in-URL redirects.

2. Prefer httpOnly cookies for session transport.

3. Add CSRF protection if cookies become the primary session store.

4. Add audit logs for auth and onboarding events.

5. Add stricter server validation for phone and business document data.

## Recommended Target Architecture

The best long-term shape is:

- one auth entrypoint per login method
- one session bootstrap endpoint
- one onboarding status machine
- one redirect decision function
- one secure session transport strategy

That keeps the flow fast, easier to reason about, and much harder to break during future feature work.

## Bottom Line

The current system has a solid set of features, but the implementation is fragmented. The biggest issues are not cosmetic; they are correctness and consistency problems between frontend expectations and backend behavior.

If we fix the signup/reset mismatches, unify session state, and remove token-in-URL handling, the flow becomes both safer and noticeably faster.