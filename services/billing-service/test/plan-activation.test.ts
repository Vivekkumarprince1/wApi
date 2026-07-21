import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSubscriptionActivation, resolveBillingPlan } from '../src/services/plan-activation-service';

test('purchased workspace plan overrides a stale active subscription plan', () => {
  const purchasedPlan = { slug: 'growth' };
  const staleSubscriptionPlan = { slug: 'starter' };

  assert.equal(resolveBillingPlan(purchasedPlan, staleSubscriptionPlan)?.slug, 'growth');
});

test('subscription activation records the purchased plan and next billing period', () => {
  const now = new Date('2026-07-21T00:00:00.000Z');
  const activation = buildSubscriptionActivation('growth-plan-id', 1, now);

  assert.equal(activation.planId, 'growth-plan-id');
  assert.equal(activation.status, 'active');
  assert.equal(activation.currentPeriodStart.toISOString(), '2026-07-21T00:00:00.000Z');
  assert.equal(activation.currentPeriodEnd.toISOString(), '2026-08-21T00:00:00.000Z');
});