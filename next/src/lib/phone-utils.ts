/**
 * Normalizes a phone number to E.164 format without + sign.
 * Specifically handles Indian numbers (adding 91 if it's 10 digits).
 */
export function normalizePhoneNumber(phone: string, defaultCountryCode = "91"): string {
  if (!phone) return '';
  
  // Strip all non-digit characters
  const cleaned = String(phone).replace(/\D/g, '');
  
  // If it's a numeric ID (15+ digits), do NOT normalize as a phone number.
  // Meta Phone Number IDs are typically 15-16 digits.
  if (cleaned.length >= 15) {
    return cleaned;
  }

  // If it's already longer than 10 digits, check if it starts with a valid country code
  if (cleaned.length > 10) {
    const validCountryCodes = ['1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49', '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98'];
    if (validCountryCodes.some(code => cleaned.startsWith(code))) {
      return cleaned;
    }
    // If it doesn't start with a known code but is long, it's likely already normalized or unique
  }

  // If it's exactly 10 digits, assume it's an Indian number and add default country code
  if (cleaned.length === 10) {
    return `${defaultCountryCode}${cleaned}`;
  }

  return cleaned;
}
