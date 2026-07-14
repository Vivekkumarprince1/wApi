import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePaymentPolicy } from '../src/config/payment-policy';

test('requires all Razorpay credentials when payments are enabled', () => {
    assert.throws(
        () => validatePaymentPolicy({ razorpayEnabled: 'true' }),
        /RAZORPAY_KEY_ID/,
    );
});

test('rejects unsigned payment webhook mode in production', () => {
    assert.throws(
        () => validatePaymentPolicy({ nodeEnv: 'production', allowUnsignedDevWebhooks: 'true' }),
        /cannot be enabled in production/,
    );
});

test('allows Razorpay to remain explicitly disabled without credentials', () => {
    assert.equal(validatePaymentPolicy({ razorpayEnabled: 'false' }).enabled, false);
});