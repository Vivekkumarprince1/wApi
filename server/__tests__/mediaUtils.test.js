const { isMediaHandle, isUrl } = require('../src/utils/mediaUtils');

describe('Media Utilities', () => {
  test('isMediaHandle identifies various handle formats', () => {
    expect(isMediaHandle('4::YWJjZGVmZw==')).toBe(true);
    expect(isMediaHandle('123456789012345')).toBe(true);
    expect(isMediaHandle('https://example.com/image.png')).toBe(false);
    expect(isMediaHandle(null)).toBe(false);
    expect(isMediaHandle('')).toBe(false);
  });

  test('isUrl identifies standard URLs', () => {
    expect(isUrl('https://example.com/image.png')).toBe(true);
    expect(isUrl('http://test.com/v.mp4')).toBe(true);
    expect(isUrl('4::YWJj')).toBe(false);
    expect(isUrl('ftp://files.com')).toBe(false);
  });
});
