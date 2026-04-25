# Onboarding Verification Plan

Guidelines for automated and manual verification of the onboarding pipeline.

## Automated Tests

1. **Build verification**: `npm run build` must pass with no TypeScript errors.
2. **Service unit tests**: Test `GupshupPartnerService` methods with mocked HTTP responses.
3. **State machine tests**: Verify `onboardingStatus` transitions are valid.
4. **API route tests**: Test each BSP endpoint with mock auth and workspace data.

## Manual Verification

1. **Full onboarding flow**: Register → Verify Email → Verify Mobile → Business Info → Connect WhatsApp → Complete.
2. **Accept invite flow**: Receive invite → Set password → Auto-login → Dashboard.
3. **Reconnect flow**: Disconnect → Reconnect → Verify embed URL generation.
4. **Error recovery**: Cancel during embed → Retry → Verify state machine resumes correctly.
5. **Fallback data**: After onboarding, verify WABA data is cached in `workspace.wabaCache`.

## Browser Testing

- Test the `ConnectNumberModal` popup flow with the new BSP endpoints.
- Verify the callback bridge HTML works for both popup and redirect scenarios.
- Verify session refresh after onboarding completion updates the sidebar/header state.
