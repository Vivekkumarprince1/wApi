# Embedded Signup (ESB) Automation Guide

This project now uses a single Embedded Signup (ESB) flow powered by **your Meta app credentials** (app id, secret, business id, WABA id, phone number id, permanent access token).

## High-level flow

1. User hits `/esb/start` to open Meta ESB UI.
2. Meta performs business verification, creates/attaches WABA, and sends OTP for the selected phone number.
3. Callback `/onboarding/esb/callback` redirects the browser to `/esb?code=...&state=...`.
4. Frontend posts the code/state to `/onboarding/esb/process-callback` which stores tokens and Meta IDs.
5. Backend drives the rest via APIs:
   - Verify business/WABA
   - Register phone + send OTP
   - Verify OTP
   - Create system user token
   - Activate WABA and store `waba_id`, `phone_number_id`, limits/plan
6. Messaging uses the permanent Cloud API token (`META_ACCESS_TOKEN`).

## Endpoints (server)

- `POST /api/v1/onboarding/esb/start` — returns `{ esbUrl, state }`.
- `GET  /api/v1/onboarding/esb/callback` — Meta redirect → forwards to frontend `/esb`.
- `POST /api/v1/onboarding/esb/process-callback` — body `{ code, state }`; exchanges code for token and stores it.
- `POST /api/v1/onboarding/esb/verify-business` — optional manual trigger; uses configured `META_BUSINESS_ID` if no id provided.
- `POST /api/v1/onboarding/esb/register-phone` — body `{ phoneNumber }`; registers number + sends OTP.
- `POST /api/v1/onboarding/esb/verify-otp` — body `{ otpCode }`; confirms phone.
- `POST /api/v1/onboarding/esb/create-system-user` — creates system user + token under the business.
- `POST /api/v1/onboarding/esb/activate-waba` — finalizes activation and marks onboarding complete.
- `GET  /api/v1/onboarding/esb/status` — returns current ESB + WABA state.

## Code examples

### 1) Start Embedded Signup
```js
// server/src/controllers/onboardingController.js
const { esbUrl, state } = await metaAutomationService.generateEmbeddedSignupURL(
  user._id,
  `${process.env.APP_URL}/api/onboarding/esb/callback`
);
```

### 2) Handle callback redirect and exchange code
```js
// POST /onboarding/esb/process-callback
const tokenResult = await metaAutomationService.exchangeCodeForToken(code, callbackUrl);
workspace.esbFlow.adminAccessToken = whatsappToken || tokenResult.accessToken; // prefer permanent token
workspace.esbFlow.metaBusinessId = metaBusinessId || tokenResult.userInfo?.businessAccounts?.[0]?.id;
```

### 3) Verify business + WABA (auto-uses configured business id)
```js
const verifyResult = await metaAutomationService.verifyBusinessAccount(
  accessToken,
  resolvedBusinessId,
  {
    businessName: workspace.name,
    industry: 'RETAIL',
    email: user.email,
    timezone: 'Asia/Kolkata'
  }
);
```

### 4) Register WhatsApp number and send OTP
```js
const phoneRegResult = await metaAutomationService.requestPhoneNumberRegistration(
  accessToken,
  workspace.wabaId,
  phoneNumber // e.g. +14155550123
);
await metaAutomationService.sendPhoneNumberOTP(accessToken, phoneRegResult.phoneNumberId);
```

### 5) Verify OTP
```js
await metaAutomationService.verifyPhoneNumberCode(
  accessToken,
  workspace.esbFlow.phoneNumberIdForOTP,
  otpCode // 6-digit code from Meta
);
```

### 6) Create system user + token
```js
const systemUserResult = await metaAutomationService.createSystemUser(
  accessToken,
  workspace.businessAccountId,
  `system_user_${workspace.name.replace(/\s+/g, '_')}_${Date.now()}`
);
workspace.whatsappAccessToken = systemUserResult.accessToken;
```

### 7) Activate WABA
```js
await metaAutomationService.updateWABASettings(accessToken, workspace.wabaId, {
  displayName: workspace.name,
  about: 'Welcome to our business',
  industry: workspace.industry
});
const status = await metaAutomationService.getOnboardingStatus(accessToken, workspace.businessAccountId, workspace.wabaId);
```

## What gets stored

- `workspace.wabaId`
- `workspace.whatsappPhoneNumberId`
- `workspace.whatsappPhoneNumber`
- `workspace.plan` / `workspace.planLimits`
- `workspace.whatsappAccessToken` (system user token)

## Environment

Set these in `server/.env` (examples):
```
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_BUSINESS_ID=your_business_id
META_WABA_ID=your_parent_waba_id
META_PHONE_NUMBER_ID=your_phone_number_id
META_ACCESS_TOKEN=your_permanent_token
META_CONFIG_ID=your_embedded_signup_config_id
APP_URL=https://api.yourdomain.com
FRONTEND_URL=https://app.yourdomain.com
```
