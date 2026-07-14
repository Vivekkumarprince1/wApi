export type SocialAuthPolicyInput = {
    nodeEnv?: string;
    googleAuthEnabled?: string;
    googleClientId?: string;
    googleClientSecret?: string;
    allowDevAuthMocks?: string;
};

export type SocialAuthPolicy = {
    isProduction: boolean;
    googleEnabled: boolean;
    allowDevMocks: boolean;
};

export function validateSocialAuthPolicy(input: SocialAuthPolicyInput): SocialAuthPolicy {
    const isProduction = input.nodeEnv === 'production';
    const googleEnabled = input.googleAuthEnabled === 'true';
    const allowDevMocks = input.allowDevAuthMocks === 'true';

    if (isProduction && allowDevMocks) {
        throw new Error('FATAL: ALLOW_DEV_AUTH_MOCKS cannot be enabled in production.');
    }

    if (isProduction && googleEnabled && (!input.googleClientId || !input.googleClientSecret)) {
        throw new Error('FATAL: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required when Google authentication is enabled in production.');
    }

    return { isProduction, googleEnabled, allowDevMocks: allowDevMocks && !isProduction };
}