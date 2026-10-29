// @ts-nocheck
// @jest-environment node
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
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
    await expect(assertPublicUrl('http://127.0.0.1/', { security: { allowPrivateUrls: true } })).resolves.toBeUndefined();
  });

  describe('unresolvable hosts', () => {
    const unresolvable = 'http://does-not-exist.invalid/';
    const proxyVars = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'];
    let saved;

    beforeEach(() => {
      saved = Object.fromEntries(proxyVars.map((name) => [name, process.env[name]]));
      proxyVars.forEach((name) => delete process.env[name]);
    });

    afterEach(() => {
      proxyVars.forEach((name) => {
        if (saved[name] === undefined) delete process.env[name];
        else process.env[name] = saved[name];
      });
    });

    test('fail closed when yt-dlp has no proxy to resolve them', async () => {
      await expect(assertPublicUrl(unresolvable, { network: { ignoreConfig: true } }))
        .rejects.toThrow(/Cannot resolve/);
      await expect(assertPublicUrl(unresolvable, { network: { proxy: '', ignoreConfig: false } }))
        .rejects.toThrow(/Cannot resolve/);
    });

    test('are left to yt-dlp when a proxy may resolve them', async () => {
      await expect(assertPublicUrl(unresolvable, { network: { proxy: 'socks5://127.0.0.1:1080', ignoreConfig: true } }))
        .resolves.toBeUndefined();
      // The yt-dlp config file may set a proxy
      await expect(assertPublicUrl(unresolvable, { network: { ignoreConfig: false } })).resolves.toBeUndefined();
      process.env.HTTPS_PROXY = 'http://127.0.0.1:3128';
      await expect(assertPublicUrl(unresolvable, { network: { ignoreConfig: true } })).resolves.toBeUndefined();
    });
  });

  test('tools reject internal URLs before invoking yt-dlp', async () => {
    await expect(getVideoMetadata('http://169.254.169.254/latest/meta-data/', undefined, CONFIG))
      .rejects.toThrow(/private or local network/);
  });
});
