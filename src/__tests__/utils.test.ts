// @ts-nocheck
// @jest-environment node
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { resolveDownloadedFile } from '../modules/utils.js';

describe('resolveDownloadedFile', () => {
  let downloadsDir: string;

  beforeEach(() => {
    downloadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdlp-resolve-'));
  });

  afterEach(() => {
    fs.rmSync(downloadsDir, { recursive: true, force: true });
  });

  const progress = [
    '[download] Destination: whatever.mp4',
    '[download]  50.0% of 3.29MiB at 10.75MiB/s ETA 00:00',
    '[download] 100% of 3.29MiB in 00:00:00 at 11.65MiB/s'
  ].join('\n');

  test('reads the path yt-dlp printed, ignoring progress output', () => {
    const filePath = path.join(downloadsDir, 'Title [id] 2026-08-11_12-30-00.mp4');
    const output = `${progress}\n${filePath}\n`;

    expect(resolveDownloadedFile(output, downloadsDir, '2026-08-11_12-30-00'))
      .toBe(filePath);
  });

  // The printed path is authoritative precisely because post-processing and
  // filename rewrites make the timestamp unreliable — see issue #30 review.
  test('reports the post-processed name even when the extension changed', () => {
    const filePath = path.join(downloadsDir, 'Title [id] 2026-08-11_12-30-00.mp3');
    const output = `${progress}\n${filePath}\n`;

    expect(resolveDownloadedFile(output, downloadsDir, '2026-08-11_12-30-00'))
      .toBe(filePath);
  });

  test('reports a name that no longer contains the timestamp', () => {
    // --trim-filenames / --restrict-filenames can strip the timestamp entirely
    const filePath = path.join(downloadsDir, 'Rick_Astley_-_Never_Go.m4a');
    const output = `${progress}\n${filePath}\n`;

    expect(resolveDownloadedFile(output, downloadsDir, '2026-08-11_12-30-00'))
      .toBe(filePath);
  });

  test('takes the last printed path when several are present', () => {
    const first = path.join(downloadsDir, 'first.mp4');
    const last = path.join(downloadsDir, 'last.mp4');
    const output = `${first}\n${progress}\n${last}\n`;

    expect(resolveDownloadedFile(output, downloadsDir, 'ts')).toBe(last);
  });

  // --trim-filenames truncates the whole path, so a config file can land the
  // download outside the requested directory. Report where it really went.
  test('accepts a printed path outside the downloads directory', () => {
    const escaped = path.join(path.sep, 'tmp', 'trimmed.m4a');
    const output = `${progress}\n${escaped}\n`;

    expect(resolveDownloadedFile(output, downloadsDir, 'ts')).toBe(escaped);
  });

  test('ignores bracketed verbose lines that mention absolute paths', () => {
    const output = [
      "[debug] Loading archive file '/home/user/.yt-dlp-archive'",
      '[download] Destination: /somewhere/x.mp4'
    ].join('\n');
    const real = path.join(downloadsDir, 'Title 2026-08-11_12-30-00.mp4');
    fs.writeFileSync(real, '');

    expect(resolveDownloadedFile(output, downloadsDir, '2026-08-11_12-30-00')).toBe(real);
  });

  test('falls back to scanning for the timestamp when nothing was printed', () => {
    const real = path.join(downloadsDir, 'Title [id] 2026-08-11_12-30-00.mkv');
    fs.writeFileSync(real, '');

    expect(resolveDownloadedFile(progress, downloadsDir, '2026-08-11_12-30-00')).toBe(real);
  });

  test('returns undefined when no file matches', () => {
    expect(resolveDownloadedFile(progress, downloadsDir, '2026-08-11_12-30-00'))
      .toBeUndefined();
  });

  // A config-file --simulate produces no download and no directory at all.
  test('returns undefined instead of throwing when the directory is missing', () => {
    const missing = path.join(downloadsDir, 'does-not-exist');

    expect(resolveDownloadedFile(progress, missing, 'ts')).toBeUndefined();
  });
});
