import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanModel } from '../src/models';

test('plan model preserves feature entitlements and limits', () => {
    const plan = new PlanModel({
        name: 'Growth',
        slug: 'growth',
        features: ['INBOX', 'BILLING'],
        limits: { maxContacts: 5000 },
        conversationPricing: { marketingMarkupPercent: 10 },
    });

    const serialized = plan.toObject();
    assert.deepEqual(serialized.features, ['INBOX', 'BILLING']);
    assert.equal(serialized.limits.maxContacts, 5000);
    assert.equal(serialized.conversationPricing.marketingMarkupPercent, 10);
});