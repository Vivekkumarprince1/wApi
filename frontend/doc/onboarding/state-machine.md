# Onboarding State Machine

The single source of truth for the entire user onboarding and BSP connection journey.

## Visualization

```mermaid
stateDiagram-v2
    [*] --> SIGNUP: User registers
    SIGNUP --> EMAIL_VERIFICATION: Account created
    EMAIL_VERIFICATION --> MOBILE_VERIFICATION: Email verified
    MOBILE_VERIFICATION --> BUSINESS_INFO: Phone verified
    BUSINESS_INFO --> DASHBOARD: Business info saved
    
    DASHBOARD --> APP_CREATING: "Connect WhatsApp" clicked
    APP_CREATING --> APP_CREATED: Gupshup app created
    APP_CREATED --> CONTACT_SYNCED: Contact details set
    CONTACT_SYNCED --> SUBSCRIPTIONS_SET: V3 webhooks configured
    SUBSCRIPTIONS_SET --> EMBED_READY: Embed link generated
    EMBED_READY --> EMBED_STARTED: User opened Meta signup
    EMBED_STARTED --> CALLBACK_RECEIVED: Gupshup callback
    CALLBACK_RECEIVED --> STAGE1_COMPLETE: AppId + Phone resolved
    STAGE1_COMPLETE --> CONNECTED: Phone status CONNECTED
    
    APP_CREATING --> FAILED: Any step fails
    CONTACT_SYNCED --> FAILED: Contact sync fails
    EMBED_STARTED --> FAILED: User cancels
    CALLBACK_RECEIVED --> PHONE_PENDING: Phone not yet active
    PHONE_PENDING --> CONNECTED: Phone activates
    
    CONNECTED --> DISCONNECTED: User disconnects
    DISCONNECTED --> APP_CREATING: User reconnects
    FAILED --> APP_CREATING: User retries
```

## State Mappings

### User.accountStatus Mapping

| `user.accountStatus` | `nextStep` Redirect |
|----------------------|---------------------|
| `AWAITING_EMAIL_VERIFICATION` | `/onboarding/verify-email` |
| `AWAITING_MOBILE_VERIFICATION` | `/onboarding/verify-mobile` |
| `AWAITING_BUSINESS_INFO` | `/onboarding/business-info` |
| `SIGNUP_COMPLETED` | `null` (→ dashboard) |

### Workspace.onboardingStatus Mapping

| `workspace.onboardingStatus` | Frontend Behavior |
|------------------------------|-------------------|
| `not_started` | Show "Connect WhatsApp" CTA |
| `ONBOARDING_STARTED` → `EMBED_GENERATED` | Provisioning in progress |
| `completed` | Full dashboard access |
| `disconnected` | Show reconnect CTA |
