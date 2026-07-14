import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MEDIA_BYTES, validateMediaInput } from '../src/channels/whatsapp/media/media-policy';

test('rejects empty media', () => {
    assert.deepEqual(validateMediaInput({ buffer: Buffer.alloc(0), size: 0, mimetype: 'image/png' }), {
        valid: false,
        status: 400,
        code: 'INVALID_MEDIA',
    });
});

test('rejects oversized media', () => {
    assert.equal(validateMediaInput({ buffer: Buffer.from('x'), size: MAX_MEDIA_BYTES + 1, mimetype: 'image/png' }).valid, false);
});

test('rejects unsupported media and accepts supported media', () => {
    assert.equal(validateMediaInput({ buffer: Buffer.from('x'), size: 1, mimetype: 'text/html' }).code, 'UNSUPPORTED_MEDIA_TYPE');
    assert.deepEqual(validateMediaInput({ buffer: Buffer.from('x'), size: 1, mimetype: 'image/png' }), { valid: true });
});