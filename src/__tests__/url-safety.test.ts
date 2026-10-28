// @ts-nocheck
// @jest-environment node
import { describe, test, expect } from '@jest/globals';
import { validateUrl, isNonPublicAddress, assertPublicUrl } from '../modules/utils.js';
import { getVideoMetadata } from '../modules/metadata.js';
import { CONFIG } from '../config.js';

describe('validateUrl', () => {
  test('accepts http and https', () => {
    expect(validateUrl('https://www.youtube.com/watch?v=jNQXAC9IVRw')).toBe(true);
    expect(validateUrl('http://example.com/video')).toBe(true);
  });

  test('rejects non-http schemes', () => {
    expect(validateUrl('file:///etc/passwd')).toBe(false);
    expect(validateUrl('ftp://example.com/video.mp4')).toBe(false);
    expect(validateUrl('ytsearch:test')).toBe(false);
  });
});

describe('isNonPublicAddress', () => {
  test.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:a9fe:a9fe'
  ])('blocks %s', (address) => {
    expect(isNonPublicAddress(address)).toBe(true);
  });

  test.each(['8.8.8.8', '142.250.72.14', '2607:f8b0:4005:80a::200e', '::ffff:8.8.8.8', '::ffff:808:808'])(
    'allows %s',
    (address) => {
      expect(isNonPublicAddress(address)).toBe(false);
    }
  );
});

describe('assertPublicUrl', () => {
  test.each([
    'http://127.0.0.1:8080/',
    'http://localhost/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://2130706433/',
    'http://0x7f.1/'
  ])('rejects %s', async (url) => {
    await expect(assertPublicUrl(url)).rejects.toThrow(/private or local network/);
  });

  test('allows private hosts when explicitly enabled', async () => {
    await expect(assertPublicUrl('http://127.0.0.1/', true)).resolves.toBeUndefined();
  });

  test('tools reject internal URLs before invoking yt-dlp', async () => {
    await expect(getVideoMetadata('http://169.254.169.254/latest/meta-data/', undefined, CONFIG))
      .rejects.toThrow(/private or local network/);
  });
});
