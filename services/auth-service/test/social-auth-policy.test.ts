import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSocialAuthPolicy } from '../src/config/social-auth-policy';

test('rejects development auth mocks in production', () => {
  assert.throws(
    () => validateSocialAuthPolicy({ nodeEnv: 'production', allowDevAuthMocks: 'true' }),
    /cannot be enabled in production/,
  );
});

test('requires Google credentials when production Google auth is enabled', () => {
  assert.throws(
    () => validateSocialAuthPolicy({ nodeEnv: 'production', googleAuthEnabled: 'true' }),
    /GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/,
  );
});

test('permits explicit development mocks only outside production', () => {
  const policy = validateSocialAuthPolicy({ nodeEnv: 'development', googleAuthEnabled: 'true', allowDevAuthMocks: 'true' });
  assert.equal(policy.allowDevMocks, true);
});