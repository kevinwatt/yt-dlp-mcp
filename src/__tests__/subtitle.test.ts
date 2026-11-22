// @ts-nocheck
// @jest-environment node
import { describe, test, expect } from '@jest/globals';
import * as os from 'os';
import * as path from 'path';
import { listSubtitles, downloadSubtitles, downloadTranscript } from '../modules/subtitle.js';
import { cleanSubtitleToTranscript, srtToTimestampedLines, paginateText } from '../modules/utils.js';
import { CONFIG } from '../config.js';
import * as fs from 'fs';

describe('Subtitle Functions', () => {
  const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
  const testConfig = {
    ...CONFIG,
    file: {
      ...CONFIG.file,
      downloadsDir: path.join(os.tmpdir(), 'yt-dlp-test-downloads'),
      tempDirPrefix: 'yt-dlp-test-'
    }
  };

  beforeEach(async () => {
    await fs.promises.mkdir(testConfig.file.downloadsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(testConfig.file.downloadsDir, { recursive: true, force: true });
  });

  describe('listSubtitles', () => {
    test('lists available subtitles', async () => {
      const result = await listSubtitles(testUrl);
      expect(result).toContain('Language');
    }, 30000);

    test('handles invalid URL', async () => {
      await expect(listSubtitles('invalid-url'))
        .rejects
        .toThrow();
    });
  });

  describe('downloadSubtitles', () => {
    test('downloads auto-generated subtitles successfully', async () => {
      const result = await downloadSubtitles(testUrl, 'en', testConfig);
      expect(result).toContain('WEBVTT');
    }, 30000);

    test('handles missing language', async () => {
      await expect(downloadSubtitles(testUrl, 'xx', testConfig))
        .rejects
        .toThrow();
    });
  });

  describe('downloadTranscript', () => {
    test('downloads and cleans transcript successfully', async () => {
      const result = await downloadTranscript(testUrl, 'en', testConfig);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toContain('WEBVTT');
      expect(result).not.toContain('-->');
      expect(result).not.toMatch(/^\d+$/m);
    }, 30000);

    test('handles invalid URL', async () => {
      await expect(downloadTranscript('invalid-url', 'en', testConfig))
        .rejects
        .toThrow();
    });
  });

  describe('cleanSubtitleToTranscript', () => {
    test('cleans SRT content correctly', () => {
      const srtContent = `1
00:00:01,000 --> 00:00:03,000
Hello <i>world</i>

2
00:00:04,000 --> 00:00:06,000
This is a test

3
00:00:07,000 --> 00:00:09,000
<b>Bold text</b> here`;

      const result = cleanSubtitleToTranscript(srtContent);
      expect(result).toBe('Hello world This is a test Bold text here');
    });

    test('handles empty content', () => {
      const result = cleanSubtitleToTranscript('');
      expect(result).toBe('');
    });

    test('removes timestamps and sequence numbers', () => {
      const srtContent = `1
00:00:01,000 --> 00:00:03,000
First line

2
00:00:04,000 --> 00:00:06,000
Second line`;

      const result = cleanSubtitleToTranscript(srtContent);
      expect(result).not.toContain('00:00');
      expect(result).not.toMatch(/^\d+$/);
      expect(result).toBe('First line Second line');
    });
  });

  describe('srtToTimestampedLines', () => {
    test('emits one line per cue at its whole-second start time', () => {
      const srtContent = `1\r
00:00:01,900 --> 00:00:03,000\r
Hello <i>world</i>\r
\r
2\r
01:02:03,000 --> 01:02:05,000\r
multi\r
line cue\r
\r
3\r
01:02:06,000 --> 01:02:07,000\r
<font color="#fff"></font>\r
`;

      expect(srtToTimestampedLines(srtContent)).toBe(
        '[00:00:01] Hello world\n[01:02:03] multi line cue'
      );
    });
  });

  describe('paginateText', () => {
    const cues = ['[00:00:01] one', '[00:00:02] two', '[00:00:03] three'].join('\n');

    test('returns the whole text with no next offset when it fits', () => {
      expect(paginateText(cues, 0, 1000, '\n')).toEqual({ text: cues, total: cues.length });
    });

    test('pages through the text on separator boundaries without loss', () => {
      const pages: string[] = [];
      let offset: number | undefined = 0;
      while (offset !== undefined) {
        const page = paginateText(cues, offset, 20, '\n');
        expect(page.text.length).toBeLessThanOrEqual(20);
        pages.push(page.text);
        offset = page.nextOffset;
      }
      expect(pages).toEqual(['[00:00:01] one\n', '[00:00:02] two\n', '[00:00:03] three']);
      expect(pages.join('')).toBe(cues);
    });

    test('hard-cuts a window that contains no separator', () => {
      expect(paginateText('abcdefgh', 0, 3, '\n')).toEqual({ text: 'abc', nextOffset: 3, total: 8 });
    });

    test('rejects an offset past the end', () => {
      expect(() => paginateText(cues, cues.length, 20, '\n')).toThrow(/past the end/);
    });
  });
}); 