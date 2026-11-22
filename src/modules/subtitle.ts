import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { Config } from '../config.js';
import { getCookieArgs, getGlobalArgs } from '../config.js';
import { _spawnPromise, validateUrl, assertPublicUrl, cleanSubtitleToTranscript, srtToTimestampedLines, paginateText } from "./utils.js";
import type { TextPage } from "./utils.js";

/**
 * Appends a continuation notice to a page that does not reach the end, naming
 * the exact call that fetches the next one, so a model can page through long
 * videos instead of stopping at the first truncated response.
 */
function renderPage(page: TextPage, offset: number, toolName: string): string {
  if (page.nextOffset === undefined) return page.text;
  return `${page.text}\n\n⚠️ Partial content: characters ${offset}-${page.nextOffset} of ${page.total}. ` +
    `Call ${toolName} again with the same arguments and offset=${page.nextOffset} to get the next part.`;
}

/**
 * Lists all available subtitles for a video.
 *
 * @param url - The URL of the video
 * @param config - Configuration object (optional, for cookie support)
 * @returns Promise resolving to a string containing the list of available subtitles
 * @throws {Error} When URL is invalid or subtitle listing fails
 *
 * @example
 * ```typescript
 * try {
 *   const subtitles = await listSubtitles('https://youtube.com/watch?v=...', config);
 *   console.log('Available subtitles:', subtitles);
 * } catch (error) {
 *   console.error('Failed to list subtitles:', error);
 * }
 * ```
 */
export async function listSubtitles(url: string, config?: Config): Promise<string> {
  if (!validateUrl(url)) {
    throw new Error('Invalid or unsupported URL format. Please provide a valid video URL (e.g., https://youtube.com/watch?v=...)');
  }
  await assertPublicUrl(url, config);

  try {
    const args = [
      ...(config ? getGlobalArgs(config) : []),
      '--no-download-archive',
      '--list-subs',
      '--write-auto-sub',
      '--skip-download',
      '--verbose',
      ...(config ? getCookieArgs(config) : []),
      url
    ];
    const output = await _spawnPromise('yt-dlp', args);
    return output;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Unsupported URL") || error.message.includes("not supported")) {
        throw new Error(`Unsupported platform or video URL: ${url}. Ensure the URL is from a supported platform like YouTube.`);
      }
      if (error.message.includes("Video unavailable") || error.message.includes("private")) {
        throw new Error(`Video is unavailable or private: ${url}. Check the URL and video privacy settings.`);
      }
      if (error.message.includes("network") || error.message.includes("Connection")) {
        throw new Error("Network error while fetching subtitles. Check your internet connection and retry.");
      }
    }
    throw error;
  }
}

/**
 * Downloads subtitles for a video in the specified language.
 * 
 * @param url - The URL of the video
 * @param language - Language code (e.g., 'en', 'zh-Hant', 'ja')
 * @param config - Configuration object
 * @param offset - Character offset of the page to return, from a previous partial response
 * @returns Promise resolving to one page of raw VTT content, cut at a cue boundary
 * @throws {Error} When URL is invalid, language is not available, or download fails
 * 
 * @example
 * ```typescript
 * try {
 *   // Download English subtitles
 *   const enSubs = await downloadSubtitles('https://youtube.com/watch?v=...', 'en', config);
 *   console.log('English subtitles:', enSubs);
 * 
 *   // Download Traditional Chinese subtitles
 *   const zhSubs = await downloadSubtitles('https://youtube.com/watch?v=...', 'zh-Hant', config);
 *   console.log('Chinese subtitles:', zhSubs);
 * } catch (error) {
 *   if (error.message.includes('No subtitle files found')) {
 *     console.warn('No subtitles available in the requested language');
 *   } else {
 *     console.error('Failed to download subtitles:', error);
 *   }
 * }
 * ```
 */
export async function downloadSubtitles(
  url: string,
  language: string,
  config: Config,
  offset: number = 0
): Promise<string> {
  if (!validateUrl(url)) {
    throw new Error('Invalid or unsupported URL format. Please provide a valid video URL (e.g., https://youtube.com/watch?v=...)');
  }
  await assertPublicUrl(url, config);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), config.file.tempDirPrefix));

  try {
    await _spawnPromise('yt-dlp', [
      ...getGlobalArgs(config),
      '--no-download-archive',
      '--write-sub',
      '--write-auto-sub',
      '--sub-lang', language,
      // Pin the output format: the .vtt filter below would otherwise miss the
      // files whenever the user's config file sets --convert-subs.
      '--convert-subs', 'vtt',
      '--skip-download',
      '--output', path.join(tempDir, '%(title)s.%(ext)s'),
      ...getCookieArgs(config),
      url
    ]);

    const subtitleFiles = fs.readdirSync(tempDir)
      .filter(file => file.endsWith('.vtt'));

    if (subtitleFiles.length === 0) {
      throw new Error(`No subtitle files found for language '${language}'. Use ytdlp_list_subtitle_languages to check available options.`);
    }

    let output = '';
    for (const file of subtitleFiles) {
      output += fs.readFileSync(path.join(tempDir, file), 'utf8');
    }

    const page = paginateText(output, offset, config.limits.characterLimit, '\n\n');
    return renderPage(page, offset, 'ytdlp_download_video_subtitles');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Unsupported URL") || error.message.includes("not supported")) {
        throw new Error(`Unsupported platform or video URL: ${url}. Ensure the URL is from a supported platform like YouTube.`);
      }
      if (error.message.includes("Video unavailable") || error.message.includes("private")) {
        throw new Error(`Video is unavailable or private: ${url}. Check the URL and video privacy settings.`);
      }
      if (error.message.includes("network") || error.message.includes("Connection")) {
        throw new Error("Network error while downloading subtitles. Check your internet connection and retry.");
      }
    }
    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Downloads and cleans subtitles to produce a plain text transcript.
 * 
 * @param url - The URL of the video
 * @param language - Language code (e.g., 'en', 'zh-Hant', 'ja')
 * @param config - Configuration object
 * @param options.timestamps - Prefix each caption line with its `[HH:MM:SS]` start time
 * @param options.offset - Character offset of the page to return, from a previous partial response
 * @returns Promise resolving to one page of the cleaned transcript text
 * @throws {Error} When URL is invalid, language is not available, or download fails
 * 
 * @example
 * ```typescript
 * try {
 *   const transcript = await downloadTranscript('https://youtube.com/watch?v=...', 'en', config);
 *   console.log('Transcript:', transcript);
 * } catch (error) {
 *   console.error('Failed to download transcript:', error);
 * }
 * ```
 */
export async function downloadTranscript(
  url: string,
  language: string,
  config: Config,
  options: { timestamps?: boolean; offset?: number } = {}
): Promise<string> {
  const { timestamps = false, offset = 0 } = options;
  if (!validateUrl(url)) {
    throw new Error('Invalid or unsupported URL format. Please provide a valid video URL (e.g., https://youtube.com/watch?v=...)');
  }
  await assertPublicUrl(url, config);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), config.file.tempDirPrefix));

  try {
    await _spawnPromise('yt-dlp', [
      ...getGlobalArgs(config),
      '--no-download-archive',
      '--skip-download',
      '--write-subs',
      '--write-auto-subs',
      '--sub-lang', language,
      '--sub-format', 'ttml',
      '--convert-subs', 'srt',
      '--output', path.join(tempDir, 'transcript.%(ext)s'),
      ...getCookieArgs(config),
      url
    ]);

    const srtFiles = fs.readdirSync(tempDir)
      .filter(file => file.endsWith('.srt'));

    if (srtFiles.length === 0) {
      throw new Error(`No subtitle files found for transcript generation in language '${language}'. Use ytdlp_list_subtitle_languages to check available options.`);
    }

    const parts = srtFiles.map(file => {
      const srtContent = fs.readFileSync(path.join(tempDir, file), 'utf8');
      return timestamps ? srtToTimestampedLines(srtContent) : cleanSubtitleToTranscript(srtContent);
    });
    const transcriptContent = parts.join(timestamps ? '\n' : ' ').trim();

    const page = paginateText(transcriptContent, offset, config.limits.maxTranscriptLength, timestamps ? '\n' : ' ');
    return renderPage(page, offset, 'ytdlp_download_transcript');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Unsupported URL") || error.message.includes("not supported")) {
        throw new Error(`Unsupported platform or video URL: ${url}. Ensure the URL is from a supported platform like YouTube.`);
      }
      if (error.message.includes("Video unavailable") || error.message.includes("private")) {
        throw new Error(`Video is unavailable or private: ${url}. Check the URL and video privacy settings.`);
      }
      if (error.message.includes("network") || error.message.includes("Connection")) {
        throw new Error("Network error while downloading transcript. Check your internet connection and retry.");
      }
    }
    throw error;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
} 
