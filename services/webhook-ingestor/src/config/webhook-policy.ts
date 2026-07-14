export function resolveWebhookSignaturePolicy(input: {
    nodeEnv?: string;
    requireSignature?: string;
    allowUnsignedDevWebhooks?: string;
}) {
    const isProduction = input.nodeEnv === 'production';
    const allowUnsignedDevWebhooks = input.allowUnsignedDevWebhooks === 'true';

    if (isProduction && allowUnsignedDevWebhooks) {
        throw new Error('FATAL: ALLOW_UNSIGNED_DEV_WEBHOOKS cannot be enabled in production.');
    }

    return {
        requireSignature: isProduction || input.requireSignature === 'true' || !allowUnsignedDevWebhooks,
        allowUnsignedDevWebhooks: !isProduction && allowUnsignedDevWebhooks,
    };
}