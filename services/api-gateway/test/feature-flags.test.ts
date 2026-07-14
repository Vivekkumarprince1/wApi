import test from 'node:test';
import assert from 'node:assert/strict';
import { featureForApiPath, resolveFeatureFlags } from '../src/config/feature-flags';

test('production-safe optional feature defaults are disabled', () => {
  const flags = resolveFeatureFlags({ NODE_ENV: 'production' });
  assert.equal(Object.values(flags).every((enabled) => enabled === false), true);
});

test('maps optional API routes to the enforcing flag', () => {
  assert.equal(featureForApiPath('/api/v1/commerce/orders'), 'COMMERCE');
  assert.equal(featureForApiPath('/api/v1/integrations/instagram/status'), 'INSTAGRAM');
  assert.equal(featureForApiPath('/api/v1/developer/keys'), 'DEVELOPER_API');
  assert.equal(featureForApiPath('/api/v1/campaign/campaigns'), null);
});