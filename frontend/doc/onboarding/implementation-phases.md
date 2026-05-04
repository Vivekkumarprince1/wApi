# Onboarding Implementation Phases

This document details the proposed changes and phases for completing the Gupshup onboarding pipeline.

## User Review Required

> [!IMPORTANT]
> **Business Info → Gupshup App Creation**: After saving business info, should we automatically start Gupshup provisioning (optimistic), or wait for the user to click "Connect WhatsApp" explicitly on the dashboard?
> **Current legacy behavior**: Business info save triggers **background provisioning immediately**. The audit recommends making it explicit.

> [!WARNING]
> **Partner Token Management**: The current `config.ts` stores `GUPSHUP_PARTNER_TOKEN` as a static env var. The Gupshup partner token has an **expiry** and needs refresh logic. We need to implement a token refresh mechanism.

> [!CAUTION]
> **Workspace.esbFlow Schema Gap**: The `esbFlow` sub-schema in the new Workspace model is missing several fields present in the legacy model: `gupshupIdentity` (with `partnerAppId`, `appApiKey`), `onboardingStatus`, `whatsappConnected`, `connectedAt`, `verifiedName`, etc. These must be added before any BSP code can work.

---

## Proposed Changes

### Phase 1: Auth Hardening
- **[MODIFY] src/dashboard/api/auth/accept-invite/route.ts**: After activating the user, auto-login.
- **[MODIFY] src/dashboard/auth/accept-invite/page.tsx**: Redirect directly to `/dashboard`.
- **[MODIFY] src/middleware.ts**: Allow `/onboarding/*` routes without redirecting to login when token exists.
- **[MODIFY] src/dashboard/api/auth/session/route.ts**: Remove development bypasses and include BSP status.

### Phase 2: Workspace Schema Extension
- **[MODIFY] src/lib/models/workspace/Workspace.ts**: Add `gupshupIdentity`, `onboardingStatus`, `whatsappConnected`, and `wabaCache`.

### Phase 3: Gupshup Partner Service Layer (Port)
- **[NEW] src/lib/services/bsp/gupshup-partner-service.ts**: Low-level Gupshup Partner API client.
- **[NEW] src/lib/services/bsp/gupshup-provisioning-service.ts**: Orchestration layer.
- **[NEW] src/lib/services/bsp/bsp-onboarding-service.ts**: Port of `bspOnboardingServiceV2.js`.
- **[NEW] src/lib/services/bsp/partner-token-service.ts**: Partner token caching and refresh.

### Phase 4: BSP Onboarding API Routes
- **[NEW] src/dashboard/api/onboarding/bsp/start/route.ts**: Provisions Gupshup app.
- **[NEW] src/dashboard/api/onboarding/bsp/callback/route.ts**: Callback handler.
- **[NEW] src/dashboard/api/onboarding/bsp/complete/route.ts**: Completes onboarding.
- Other routes for status, sync, and disconnect.

### Phase 5: Fallback Data Store
- **[NEW] src/lib/services/bsp/waba-sync-service.ts**: Periodic sync and cache of WABA data.

### Phase 6: Config & Environment
- **[MODIFY] src/lib/config.ts**: Add Gupshup credentials.
- **[NEW] src/lib/config/bsp-config.ts**: BSP-specific configuration logic.
