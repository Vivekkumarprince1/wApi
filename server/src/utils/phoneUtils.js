/**
 * PHONE UTILITIES
 * Logic for normalizing phone numbers for WhatsApp and deduplication
 */

/**
 * Normalize phone number to E.164-like format (digits only)
 * Specifically handles Indian numbers (10 digits -> 91 prefix)
 * 
 * @param {string|number} phone - The phone number to normalize
 * @returns {string} - Digits only string
 */
function normalizePhone(phone) {
  if (!phone) return '';
  
  // Strip all non-digits
  let digits = String(phone).replace(/\D/g, '');
  
  // Handle Indian numbers: 
  // 10 digits starting with 6-9 -> assume India mobile, prepend 91
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }
  
  // If it's 12 digits starting with 91, it's already normalized India number
  // If it's 11 digits starting with 0, strip the leading 0 (common in some regions)
  if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.substring(1);
      // Re-check for India 10-digit mobile
      if (digits.length === 10 && /^[6-9]/.test(digits)) {
        return `91${digits}`;
      }
  }

  return digits;
}

/**
 * Check if two phone numbers refer to the same entity
 * Useful for deduplication
 */
function areSamePhone(phone1, phone2) {
  return normalizePhone(phone1) === normalizePhone(phone2);
}

module.exports = {
  normalizePhone,
  areSamePhone
};
