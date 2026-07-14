import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionMessageState } from '../src/services/message-state';

test('allows forward provider message transitions', () => {
  assert.equal(canTransitionMessageState('queued', 'accepted'), true);
  assert.equal(canTransitionMessageState('accepted', 'delivered'), true);
  assert.equal(canTransitionMessageState('delivered', 'read'), true);
});

test('rejects duplicate and backwards provider transitions', () => {
  assert.equal(canTransitionMessageState('delivered', 'delivered'), false);
  assert.equal(canTransitionMessageState('read', 'sent'), false);
  assert.equal(canTransitionMessageState('read', 'failed'), false);
});