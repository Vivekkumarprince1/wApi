const { normalizePhone, areSamePhone } = require('../../../src/utils/phoneUtils');

describe('Phone Utilities', () => {
  describe('normalizePhone', () => {
    test('should strip non-digits', () => {
      expect(normalizePhone('+91 73218-35093')).toBe('917321835093');
      expect(normalizePhone('73218 35093')).toBe('917321835093');
    });

    test('should add 91 prefix to 10-digit Indian numbers', () => {
      expect(normalizePhone('7321835093')).toBe('917321835093');
      expect(normalizePhone('9876543210')).toBe('919876543210');
    });

    test('should not change 12-digit numbers already starting with 91', () => {
      expect(normalizePhone('917321835093')).toBe('917321835093');
    });

    test('should handle international numbers outside India', () => {
      expect(normalizePhone('14155552671')).toBe('14155552671'); // US
      expect(normalizePhone('447700900000')).toBe('447700900000'); // UK
    });

    test('should handle numbers starting with 0', () => {
      expect(normalizePhone('07321835093')).toBe('917321835093');
    });

    test('should return empty string for null/undefined', () => {
      expect(normalizePhone(null)).toBe('');
      expect(normalizePhone(undefined)).toBe('');
    });
  });

  describe('areSamePhone', () => {
    test('should identify same numbers with and without prefix', () => {
      expect(areSamePhone('7321835093', '917321835093')).toBe(true);
      expect(areSamePhone('+91 7321835093', '7321835093')).toBe(true);
    });

    test('should identify different numbers', () => {
      expect(areSamePhone('7321835093', '7321835094')).toBe(false);
    });
  });
});
