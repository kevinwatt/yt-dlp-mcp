// @ts-nocheck
// @jest-environment node
import { describe, test, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';

/**
 * Enforces the invariant documented in CLAUDE.md: every tool prepends
 * getGlobalArgs(config) and passes --no-download-archive.
 *
 * Without this, a newly added tool silently loses proxy support, or breaks for
 * users whose yt-dlp config file sets --download-archive (which suppresses the
 * entry entirely, leaving the --dump-json tools parsing empty output).
 */

const PROXY = 'socks5://127.0.0.1:1080';
const URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

// Intercept at the child_process boundary rather than mocking the utils
// module, so _spawnPromise itself stays real and the argument list observed
// here is exactly what would reach yt-dlp.
const spawnMock = jest.fn(() => {
  const child: any = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => child.emit('close', 0));
  return child;
});

jest.unstable_mockModule('child_process', () => ({
  spawn: spawnMock,
  default: { spawn: spawnMock }
}));

let config: any;
let cases: Array<{ name: string; run: () => Promise<unknown> }>;

beforeAll(async () => {
  // Imported sequentially: Jest's ESM runtime hits module-linking races when
  // several graphs that share a mocked builtin are linked concurrently.
  const { loadConfig } = await import('../config.js');
  const video = await import('../modules/video.js');
  const audio = await import('../modules/audio.js');
  const subtitle = await import('../modules/subtitle.js');
  const metadata = await import('../modules/metadata.js');
  const search = await import('../modules/search.js');
  const comments = await import('../modules/comments.js');

  config = { ...loadConfig(), network: { proxy: PROXY, ignoreConfig: true } };

  cases = [
    { name: 'downloadVideo', run: () => video.downloadVideo(URL, config) },
    { name: 'downloadAudio', run: () => audio.downloadAudio(URL, config) },
    { name: 'listSubtitles', run: () => subtitle.listSubtitles(URL, config) },
    { name: 'downloadSubtitles', run: () => subtitle.downloadSubtitles(URL, 'en', config) },
    { name: 'downloadTranscript', run: () => subtitle.downloadTranscript(URL, 'en', config) },
    { name: 'getVideoMetadata', run: () => metadata.getVideoMetadata(URL, undefined, config) },
    { name: 'getVideoMetadataSummary', run: () => metadata.getVideoMetadataSummary(URL, config) },
    { name: 'searchVideos', run: () => search.searchVideos('test query', 5, 0, 'json', config) },
    { name: 'getVideoComments', run: () => comments.getVideoComments(URL, 5, 'top', config) },
    { name: 'getVideoCommentsSummary', run: () => comments.getVideoCommentsSummary(URL, 5, config) }
  ];
});

describe('global yt-dlp argument invariants', () => {
  beforeEach(() => {
    // mockClear, not mockReset: the fake child implementation must survive
    spawnMock.mockClear();
  });

  // Each tool is driven far enough to build its argument list. Whatever it does
  // with the empty mock output afterwards is irrelevant here, so failures past
  // the spawn call are swallowed.
  async function argsFor(run: () => Promise<unknown>): Promise<string[]> {
    try {
      await run();
    } catch {
      // ignore: only the arguments handed to yt-dlp matter
    }

    expect(spawnMock).toHaveBeenCalled();
    return spawnMock.mock.calls[0][1] as string[];
  }

  test('every tool is covered by this suite', () => {
    expect(cases).toHaveLength(10);
  });

  test.each([
    'downloadVideo',
    'downloadAudio',
    'listSubtitles',
    'downloadSubtitles',
    'downloadTranscript',
    'getVideoMetadata',
    'getVideoMetadataSummary',
    'searchVideos',
    'getVideoComments',
    'getVideoCommentsSummary'
  ])('%s prepends getGlobalArgs', async (name) => {
    const args = await argsFor(cases.find(c => c.name === name)!.run);

    expect(args.slice(0, 3)).toEqual(['--ignore-config', '--proxy', PROXY]);
  });

  test.each([
    'downloadVideo',
    'downloadAudio',
    'listSubtitles',
    'downloadSubtitles',
    'downloadTranscript',
    'getVideoMetadata',
    'getVideoMetadataSummary',
    'searchVideos',
    'getVideoComments',
    'getVideoCommentsSummary'
  ])('%s passes --no-download-archive', async (name) => {
    const args = await argsFor(cases.find(c => c.name === name)!.run);

    expect(args).toContain('--no-download-archive');
  });

  test.each(['downloadVideo', 'downloadAudio'])(
    '%s asks yt-dlp to report the produced path',
    async (name) => {
      const args = await argsFor(cases.find(c => c.name === name)!.run);

      // --print implies --simulate, so --no-simulate must accompany it
      expect(args).toContain('--no-simulate');
      expect(args).toContain('--print');
      expect(args[args.indexOf('--print') + 1]).toBe('after_move:filepath');
    }
  );

  test('emits no global args when nothing is configured', async () => {
    const bare = { ...config, network: { proxy: undefined, ignoreConfig: false } };
    spawnMock.mockClear();

    try {
      await (await import('../modules/metadata.js')).getVideoMetadata(URL, undefined, bare);
    } catch {
      // ignore
    }

    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).not.toContain('--ignore-config');
    expect(args).not.toContain('--proxy');
    expect(args[0]).toBe('--dump-json');
  });
});
