import * as path from "path";
import type { Config } from "../config.js";
import { sanitizeFilename, getCookieArgs } from "../config.js";
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
 * @param startTime - Optional start time for trimming (format: HH:MM:SS[.ms])
 * @param endTime - Optional end time for trimming (format: HH:MM:SS[.ms])
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
 *
 * // Download with trimming
 * const trimmedResult = await downloadVideo(
 *   'https://youtube.com/watch?v=...',
 *   undefined,
 *   '720p',
 *   '00:01:30',
 *   '00:02:45'
 * );
 * console.log(trimmedResult);
 * ```
 */
export async function downloadVideo(
  url: string,
  config: Config,
  resolution: "480p" | "720p" | "1080p" | "best" = "720p",
  startTime?: string,
  endTime?: string
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

      const getFilenameArgs = [
        "--ignore-config",
        "--get-filename",
        "-f", format,
        "--output", outputTemplate,
        ...getCookieArgs(config),
        url
      ];
      expectedFilename = await _spawnPromise("yt-dlp", getFilenameArgs);
      expectedFilename = expectedFilename.trim();
    } catch (error) {
      // 如果無法獲取檔案名稱，使用隨機檔案名
      const randomFilename = generateRandomFilename('mp4');
      outputTemplate = path.join(userDownloadsDir, randomFilename);
      expectedFilename = randomFilename;
    }

    // Build download arguments
    const downloadArgs = [
      "--ignore-config",
      "--progress",
      "--newline",
      "--no-mtime",
      "-f", format,
      "--output", outputTemplate,
      ...getCookieArgs(config)
    ];

    // Add trimming parameters if provided
    if (startTime || endTime) {
      let downloadSection = "*";
      
      if (startTime && endTime) {
        downloadSection = `*${startTime}-${endTime}`;
      } else if (startTime) {
        downloadSection = `*${startTime}-`;
      } else if (endTime) {
        downloadSection = `*-${endTime}`;
      }

      downloadArgs.push("--download-sections", downloadSection, "--force-keyframes-at-cuts");
    }

    downloadArgs.push(url);

    // Download with progress info
    try {
      await _spawnPromise("yt-dlp", downloadArgs);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("Unsupported URL") || error.message.includes("extractor")) {
          throw new Error(`Unsupported platform or video URL: ${url}. Ensure the URL is from a supported platform.`);
        }
        if (error.message.includes("Video unavailable") || error.message.includes("private")) {
          throw new Error(`Video is unavailable or private: ${url}. Check the URL and video privacy settings.`);
        }
        if (error.message.includes("network") || error.message.includes("Connection")) {
          throw new Error("Network error during download. Check your internet connection and retry.");
        }
        throw new Error(`Download failed: ${error.message}. Check URL and try again.`);
      }
      throw new Error(`Download failed: ${String(error)}`);
    }

    return `Video successfully downloaded as "${path.basename(expectedFilename)}" to ${userDownloadsDir}`;
  } catch (error) {
    throw error;
  }
} 
