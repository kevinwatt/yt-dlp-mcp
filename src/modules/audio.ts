import * as path from "path";
import type { Config } from "../config.js";
import { sanitizeFilename, getCookieArgs, getGlobalArgs } from "../config.js";
import {
  _spawnPromise,
  validateUrl,
  getFormattedTimestamp,
  isYouTubeUrl,
  resolveDownloadedFile
} from "./utils.js";

/**
 * Downloads audio from a video URL in the best available quality.
 * 
 * @param url - The URL of the video to extract audio from
 * @param config - Configuration object for download settings
 * @returns Promise resolving to a success message with the downloaded file path
 * @throws {Error} When URL is invalid or download fails
 * 
 * @example
 * ```typescript
 * // Download audio with default settings
 * const result = await downloadAudio('https://youtube.com/watch?v=...');
 * console.log(result);
 * 
 * // Download audio with custom config
 * const customResult = await downloadAudio('https://youtube.com/watch?v=...', {
 *   file: {
 *     downloadsDir: '/custom/path',
 *     // ... other config options
 *   }
 * });
 * console.log(customResult);
 * ```
 */
export async function downloadAudio(url: string, config: Config): Promise<string> {
  const timestamp = getFormattedTimestamp();

  if (!validateUrl(url)) {
    throw new Error("Invalid or unsupported URL format");
  }

  try {
    const outputTemplate = path.join(
      config.file.downloadsDir,
      sanitizeFilename(`%(title)s [%(id)s] ${timestamp}`, config.file) + '.%(ext)s'
    );

    const format = isYouTubeUrl(url)
      ? "140/bestaudio[ext=m4a]/bestaudio"
      : "bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio";

    const output = await _spawnPromise("yt-dlp", [
      ...getGlobalArgs(config),
      // A --download-archive in the user's config file would silently skip an
      // already-downloaded video and leave nothing to report back.
      "--no-download-archive",
      // --print implies --simulate; --no-simulate restores the download and
      // also neutralizes a --simulate coming from the user's config file.
      "--no-simulate",
      // Have yt-dlp report the final path instead of predicting it. See
      // resolveDownloadedFile() for why prediction is not safe here.
      "--print", "after_move:filepath",
      "--no-check-certificate",
      "--verbose",
      "--progress",
      "--newline",
      "--no-mtime",
      "-f", format,
      "--output", outputTemplate,
      ...getCookieArgs(config),
      url
    ]);

    const downloadedPath = resolveDownloadedFile(output, config.file.downloadsDir, timestamp);
    if (!downloadedPath) {
      throw new Error("Download completed but file not found. Check Downloads folder permissions.");
    }
    // Report the directory yt-dlp actually used, which a config file can change.
    return `Audio successfully downloaded as "${path.basename(downloadedPath)}" to ${path.dirname(downloadedPath)}`;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Unsupported URL") || error.message.includes("extractor")) {
        throw new Error(`Unsupported platform or video URL: ${url}. Ensure the URL is from a supported platform.`);
      }
      if (error.message.includes("Video unavailable") || error.message.includes("private")) {
        throw new Error(`Video is unavailable or private: ${url}. Check the URL and video privacy settings.`);
      }
      if (error.message.includes("network") || error.message.includes("Connection")) {
        throw new Error("Network error during audio extraction. Check your internet connection and retry.");
      }
    }
    throw error;
  }
} 
