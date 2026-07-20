import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adminGoogleSignupAllowed,
  parseAdminGoogleSignupEmails,
} from '../src/config/admin-google-signup-policy';

test('admin Google signup is denied when no allowlist is configured', () => {
  assert.equal(adminGoogleSignupAllowed('owner@example.com', new Set()), false);
});

test('admin Google signup matches normalized allowlisted emails only', () => {
  const allowed = parseAdminGoogleSignupEmails(
    ' Owner@Example.com, finance@example.com ',
  );

  assert.equal(adminGoogleSignupAllowed('owner@example.com', allowed), true);
  assert.equal(adminGoogleSignupAllowed('OWNER@EXAMPLE.COM', allowed), true);
  assert.equal(adminGoogleSignupAllowed('attacker@example.com', allowed), false);
});
