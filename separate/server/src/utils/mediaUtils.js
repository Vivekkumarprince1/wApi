/**
 * Media Utilities for WhatsApp BSP
 */

/**
 * Checks if a string is a Meta media handle (starts with 4:: or other numeric sequences)
 * @param {string} str - The identifier to check
 * @returns {boolean}
 */
function isMediaHandle(str) {
  if (!str || typeof str !== 'string') return false;
  
  const trimmed = str.trim();
  // Gupshup/Meta media handles often start with "4::"
  if (trimmed.startsWith('4::')) return true;
  
  // Also common are purely numeric IDs which are treated as IDs
  if (/^\d{10,}$/.test(trimmed)) return true;

  return false;
}

/**
 * Checks if a string is a standard HTTP/HTTPS URL
 * @param {string} str - The URL to check
 * @returns {boolean}
 */
function isUrl(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim().toLowerCase();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

module.exports = {
  isMediaHandle,
  isUrl
};
