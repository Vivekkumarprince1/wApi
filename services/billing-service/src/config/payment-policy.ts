export function validatePaymentPolicy(input: {
  nodeEnv?: string;
  razorpayEnabled?: string;
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  allowUnsignedDevWebhooks?: string;
}) {
  const isProduction = input.nodeEnv === 'production';
  const enabled = input.razorpayEnabled === 'true';
  const allowUnsignedDevWebhooks = input.allowUnsignedDevWebhooks === 'true';

  if (isProduction && allowUnsignedDevWebhooks) {
    throw new Error('FATAL: ALLOW_UNSIGNED_DEV_PAYMENT_WEBHOOKS cannot be enabled in production.');
  }

  if (enabled && (!input.keyId || !input.keySecret || !input.webhookSecret)) {
    throw new Error('FATAL: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET are required when Razorpay is enabled.');
  }

  return {
    enabled,
    allowUnsignedDevWebhooks: allowUnsignedDevWebhooks && !isProduction,
  };
}