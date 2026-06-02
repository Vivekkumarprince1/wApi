/**
 * Tiny dependency-free runner for the contracts package. We don't want
 * to pull jest/mocha into this leaf package — node:test would be nice
 * but is awkward with our TypeScript build. So: a literal `main()` with
 * assert. Run via `npm test` once a `test` script is wired.
 */
import * as assert from 'node:assert/strict';
import {
  Roles,
  normalizeRole,
  isPlatformAdmin,
  isWorkspaceAdmin,
  roleAtLeast,
} from '../roles';

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('roles');

test('normalizeRole maps known strings', () => {
  assert.equal(normalizeRole('super_admin'), Roles.SuperAdmin);
  assert.equal(normalizeRole('admin'), Roles.Admin);
  assert.equal(normalizeRole('Owner'), Roles.Owner);
  assert.equal(normalizeRole('  manager '), Roles.Manager);
});

test("legacy 'admin' never upgrades to super_admin", () => {
  assert.equal(normalizeRole('admin'), Roles.Admin);
  assert.notEqual(normalizeRole('admin'), Roles.SuperAdmin);
});

test('aliases map back to canonical', () => {
  assert.equal(normalizeRole('staff'), Roles.SuperAdmin);
  assert.equal(normalizeRole('superadmin'), Roles.SuperAdmin);
  assert.equal(normalizeRole('workspace_admin'), Roles.Admin);
  assert.equal(normalizeRole('workspace_owner'), Roles.Owner);
});

test('unknown falls back to viewer', () => {
  assert.equal(normalizeRole('hax0r'), Roles.Viewer);
  assert.equal(normalizeRole(undefined), Roles.Viewer);
  assert.equal(normalizeRole(null), Roles.Viewer);
  assert.equal(normalizeRole(42), Roles.Viewer);
});

test('isPlatformAdmin only matches super_admin', () => {
  assert.equal(isPlatformAdmin('super_admin'), true);
  assert.equal(isPlatformAdmin('admin'), false);
  assert.equal(isPlatformAdmin('staff'), true); // alias
  assert.equal(isPlatformAdmin('owner'), false);
});

test('isWorkspaceAdmin includes owner + admin, not super_admin', () => {
  assert.equal(isWorkspaceAdmin('admin'), true);
  assert.equal(isWorkspaceAdmin('owner'), true);
  assert.equal(isWorkspaceAdmin('manager'), false);
  // super_admin is platform-level, not workspace-level.
  assert.equal(isWorkspaceAdmin('super_admin'), false);
});

test('roleAtLeast follows expected hierarchy', () => {
  assert.equal(roleAtLeast('owner', Roles.Manager), true);
  assert.equal(roleAtLeast('manager', Roles.Owner), false);
  assert.equal(roleAtLeast('agent', Roles.Viewer), true);
});
