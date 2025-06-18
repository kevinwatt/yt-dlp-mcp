import * as path from "path";
import type { Config } from "../config.js";
import { sanitizeFilename } from "../config.js";
import {
  _spawnPromise,
  validateUrl,
  getFormattedTimestamp,
  isYouTubeUrl,
  generateRandomFilename
} from "./utils.js";

/**
 * Downloads a video from the specified URL.
 * 
 * @param url - The URL of the video to download
 * @param config - Configuration object for download settings
 * @param resolution - Preferred video resolution ('480p', '720p', '1080p', 'best')
 * @returns Promise resolving to a success message with the downloaded file path
 * @throws {Error} When URL is invalid or download fails
 * 
 * @example
 * ```typescript
 * // Download with default settings
 * const result = await downloadVideo('https://youtube.com/watch?v=...');
 * console.log(result);
 * 
 * // Download with specific resolution
 * const hdResult = await downloadVideo(
 *   'https://youtube.com/watch?v=...',
 *   undefined,
 *   '1080p'
 * );
 * console.log(hdResult);
 * ```
 */
export async function downloadVideo(
  url: string,
  config: Config,
  resolution: "480p" | "720p" | "1080p" | "best" = "720p"
): Promise<string> {
  const userDownloadsDir = config.file.downloadsDir;

  try {
    validateUrl(url);
    const timestamp = getFormattedTimestamp();

    let format: string;
    if (isYouTubeUrl(url)) {
      // YouTube-specific format selection
      switch (resolution) {
        case "480p":
          format = "bestvideo[height<=480]+bestaudio/best[height<=480]/best";
          break;
        case "720p":
          format = "bestvideo[height<=720]+bestaudio/best[height<=720]/best";
          break;
        case "1080p":
          format = "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best";
          break;
        case "best":
          format = "bestvideo+bestaudio/best";
          break;
        default:
          format = "bestvideo[height<=720]+bestaudio/best[height<=720]/best";
      }
    } else {
      // For other platforms, use quality labels that are more generic
      switch (resolution) {
        case "480p":
          format = "worst[height>=480]/best[height<=480]/worst";
          break;
        case "best":
          format = "bestvideo+bestaudio/best";
          break;
        default: // Including 720p and 1080p cases
          // Prefer HD quality but fallback to best available
          format = "bestvideo[height>=720]+bestaudio/best[height>=720]/best";
      }
    }

    let outputTemplate: string;
    let expectedFilename: string;

    try {
      // 嘗試獲取檔案名稱
      outputTemplate = path.join(
        userDownloadsDir,
        sanitizeFilename(`%(title)s [%(id)s] ${timestamp}`, config.file) + '.%(ext)s'
      );

      expectedFilename = await _spawnPromise("yt-dlp", [
        "--ignore-config",
        "--get-filename",
        "-f", format,
        "--output", outputTemplate,
        url
      ]);
      expectedFilename = expectedFilename.trim();
    } catch (error) {
      // 如果無法獲取檔案名稱，使用隨機檔案名
      const randomFilename = generateRandomFilename('mp4');
      outputTemplate = path.join(userDownloadsDir, randomFilename);
      expectedFilename = randomFilename;
    }

    // Download with progress info
    try {
      await _spawnPromise("yt-dlp", [
        "--ignore-config",
        "--progress",
        "--newline",
        "--no-mtime",
        "-f", format,
        "--output", outputTemplate,
        url
      ]);
    } catch (error) {
      throw new Error(`Download failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return `Video successfully downloaded as "${path.basename(expectedFilename)}" to ${userDownloadsDir}`;
  } catch (error) {
    throw error;
  }
} 
