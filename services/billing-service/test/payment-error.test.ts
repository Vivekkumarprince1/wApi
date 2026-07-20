import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPaymentError } from '../src/controllers/payment-error';

test('maps disabled payments to service unavailable instead of internal error', () => {
  const response = classifyPaymentError({ code: 'FEATURE_DISABLED' });

  assert.equal(response.status, 503);
  assert.equal(response.body.code, 'FEATURE_DISABLED');
});

test('maps provider failures to bad gateway', () => {
  const response = classifyPaymentError({ code: 'PAYMENT_PROVIDER_ERROR' });

  assert.equal(response.status, 502);
  assert.equal(response.body.code, 'PAYMENT_PROVIDER_ERROR');
});