// @ts-nocheck
// @jest-environment node
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Store original env
const originalEnv = { ...process.env };

describe('Cookie Configuration', () => {
  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    // Clear module cache to reload config
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getCookieArgs', () => {
    test('returns empty array when no cookies configured', async () => {
      const { getCookieArgs, loadConfig } = await import('../config.js');
      const config = loadConfig();
      const args = getCookieArgs(config);
      expect(args).toEqual([]);
    });

    test('returns --cookies args when file is configured', async () => {
      // Create a temporary cookie file
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cookie-test-'));
      const cookieFile = path.join(tempDir, 'cookies.txt');
      fs.writeFileSync(cookieFile, '# Netscape HTTP Cookie File\n');

      process.env.YTDLP_COOKIES_FILE = cookieFile;

      const { getCookieArgs, loadConfig } = await import('../config.js');
      const config = loadConfig();
      const args = getCookieArgs(config);

      expect(args).toEqual(['--cookies', cookieFile]);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('returns --cookies-from-browser args when browser is configured', async () => {
      process.env.YTDLP_COOKIES_FROM_BROWSER = 'chrome';

      const { getCookieArgs, loadConfig } = await import('../config.js');
      const config = loadConfig();
      const args = getCookieArgs(config);

      expect(args).toEqual(['--cookies-from-browser', 'chrome']);
    });

    test('file takes precedence over browser', async () => {
      // Create a temporary cookie file
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cookie-test-'));
      const cookieFile = path.join(tempDir, 'cookies.txt');
      fs.writeFileSync(cookieFile, '# Netscape HTTP Cookie File\n');

      process.env.YTDLP_COOKIES_FILE = cookieFile;
      process.env.YTDLP_COOKIES_FROM_BROWSER = 'chrome';

      const { getCookieArgs, loadConfig } = await import('../config.js');
      const config = loadConfig();
      const args = getCookieArgs(config);

      expect(args).toEqual(['--cookies', cookieFile]);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('supports browser with profile', async () => {
      process.env.YTDLP_COOKIES_FROM_BROWSER = 'chrome:Profile 1';

      const { getCookieArgs, loadConfig } = await import('../config.js');
      const config = loadConfig();
      const args = getCookieArgs(config);

      expect(args).toEqual(['--cookies-from-browser', 'chrome:Profile 1']);
    });

    test('supports browser with container', async () => {
      process.env.YTDLP_COOKIES_FROM_BROWSER = 'firefox::work';

      const { getCookieArgs, loadConfig } = await import('../config.js');
      const config = loadConfig();
      const args = getCookieArgs(config);

      expect(args).toEqual(['--cookies-from-browser', 'firefox::work']);
    });
  });

  describe('Cookie Validation', () => {
    test('clears invalid cookie file path with warning', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      process.env.YTDLP_COOKIES_FILE = '/nonexistent/path/cookies.txt';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.cookies.file).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cookie file not found')
      );

      consoleSpy.mockRestore();
    });

    test('accepts valid browser names', async () => {
      const validBrowsers = ['brave', 'chrome', 'chromium', 'edge', 'firefox', 'opera', 'safari', 'vivaldi', 'whale'];

      for (const browser of validBrowsers) {
        jest.resetModules();
        process.env = { ...originalEnv };
        process.env.YTDLP_COOKIES_FROM_BROWSER = browser;

        const { loadConfig } = await import('../config.js');
        const config = loadConfig();

        expect(config.cookies.fromBrowser).toBe(browser);
      }
    });

    test('clears invalid browser name with warning', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      process.env.YTDLP_COOKIES_FROM_BROWSER = 'invalidbrowser';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.cookies.fromBrowser).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid browser name')
      );

      consoleSpy.mockRestore();
    });

    test('accepts valid browser with custom path (Flatpak style)', async () => {
      // Path format is valid for Flatpak installations
      process.env.YTDLP_COOKIES_FROM_BROWSER = 'chrome:~/.var/app/com.google.Chrome/';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.cookies.fromBrowser).toBe('chrome:~/.var/app/com.google.Chrome/');
    });

    test('accepts valid browser with empty profile', async () => {
      // chrome: is valid (empty profile means default)
      process.env.YTDLP_COOKIES_FROM_BROWSER = 'chrome:';

      const { loadConfig } = await import('../config.js');
      const config = loadConfig();

      expect(config.cookies.fromBrowser).toBe('chrome:');
    });
  });

  describe('VALID_BROWSERS constant', () => {
    test('exports valid browsers list', async () => {
      const { VALID_BROWSERS } = await import('../config.js');

      expect(VALID_BROWSERS).toContain('chrome');
      expect(VALID_BROWSERS).toContain('firefox');
      expect(VALID_BROWSERS).toContain('edge');
      expect(VALID_BROWSERS).toContain('safari');
      expect(VALID_BROWSERS.length).toBe(9);
    });
  });
});
