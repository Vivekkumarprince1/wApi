# Onboarding Current State Analysis

This document outlines the current state of the Auth, Verification, and Onboarding pipeline in the new Next.js architecture (`/new`).

## What Exists (New Codebase)

| Component | Status | Notes |
|-----------|--------|-------|
| Login (`/auth/login`) | ✅ Working | Email/password + Google + Facebook social login |
| Register (`/auth/register`) | ✅ Working | Name/email/password → immediate account creation |
| Accept Invite (`/auth/accept-invite`) | ⚠️ Partial | Works but no auto-login after activation |
| Email Verify (`/onboarding/verify-email`) | ✅ Working | OTP-based, 6-char code |
| Mobile Verify (`/onboarding/verify-mobile`) | ✅ Working | Phone OTP flow |
| Business Info (`/onboarding/business-info`) | ⚠️ Partial | Saves to workspace but **no Gupshup provisioning** |
| Session API (`/api/auth/session`) | ✅ Working | Unified session with `nextStep` steering |
| Middleware | ⚠️ Partial | Cookie-based auth but **no onboarding enforcement** |
| BSP Onboarding APIs | ❌ Missing | No `/api/onboarding/bsp/*` routes in new codebase |
| Gupshup Partner Service | ❌ Missing | No `gupshupProvisioningService` ported |
| State Machine (`esbFlow`) | ⚠️ Schema Only | `Workspace.esbFlow` exists but **no transitions** |
| Fallback Data Store | ❌ Missing | No WABA info, health, or template cache pipeline |
| Connect Number Modal | ✅ Working | Calls BSP APIs that **don't exist yet** |

## What Exists (Legacy Codebase — Port Source)

| Service | File | Lines |
|---------|------|-------|
| `gupshupProvisioningService` | `wApi/server/src/services/bsp/gupshupProvisioningService.js` | 352 |
| `bspOnboardingServiceV2` | `wApi/server/src/services/bsp/bspOnboardingServiceV2.js` | 392 |
| `bspOnboardingController` | `wApi/server/src/controllers/bsp/bspOnboardingController.js` | 934 |
| `gupshupService` (core) | `wApi/server/src/services/bsp/gupshupService.js` | 62,702 |
| `gupshupDataBoundaryService` | `wApi/server/src/services/bsp/gupshupDataBoundaryService.js` | 6,638 |
| `partnerTokenService` | `wApi/server/src/services/bsp/partnerTokenService.js` | 3,449 |
| `gupshupAppSyncService` | `wApi/server/src/services/bsp/gupshupAppSyncService.js` | 17,192 |
