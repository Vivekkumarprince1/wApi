import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveNextStep } from '../src/utils/authHelper';

const newWorkspace = {};

test('new email and Google signups receive the same onboarding destination', () => {
    const emailDestination = deriveNextStep(
        { email: 'email@example.com', emailVerified: true, authProvider: 'local' },
        newWorkspace,
    );
    const googleDestination = deriveNextStep(
        { email: 'google@example.com', emailVerified: true, authProvider: 'google' },
        newWorkspace,
    );

    assert.equal(emailDestination, '/onboarding/business-info');
    assert.equal(googleDestination, emailDestination);
});

test('Google users with completed business info can continue to the dashboard', () => {
    const destination = deriveNextStep(
        { email: 'google@example.com', emailVerified: true, authProvider: 'google' },
        { business: { name: 'Example Business' } },
    );

    assert.equal(destination, null);
});