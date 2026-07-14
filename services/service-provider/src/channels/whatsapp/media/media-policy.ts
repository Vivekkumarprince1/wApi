export const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

export const ALLOWED_MEDIA_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime',
  'audio/mpeg', 'audio/mp4', 'audio/ogg',
  'application/pdf',
]);

export function validateMediaInput(file: { buffer?: Buffer; size?: number; mimetype?: string }) {
  if (!file.buffer || !file.size || file.size <= 0) {
    return { valid: false as const, status: 400, code: 'INVALID_MEDIA' };
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return { valid: false as const, status: 400, code: 'INVALID_MEDIA' };
  }
  if (!ALLOWED_MEDIA_MIME_TYPES.has(file.mimetype || '')) {
    return { valid: false as const, status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' };
  }
  return { valid: true as const };
}