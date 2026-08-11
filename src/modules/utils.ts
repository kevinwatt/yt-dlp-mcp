import * as fs from 'fs';
import * as path from 'path';
import { readdirSync } from 'fs';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';

/**
 * Validates if a given string is a valid URL.
 * 
 * @param url - The URL string to validate
 * @returns True if the URL is valid, false otherwise
 * 
 * @example
 * ```typescript
 * if (validateUrl('https://youtube.com/watch?v=...')) {
 *   // URL is valid
 * }
 * ```
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a URL is from YouTube.
 * 
 * @param url - The URL to check
 * @returns True if the URL is from YouTube, false otherwise
 * 
 * @example
 * ```typescript
 * if (isYouTubeUrl('https://youtube.com/watch?v=...')) {
 *   // URL is from YouTube
 * }
 * ```
 */
export function isYouTubeUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

/**
 * Safely cleans up a directory and its contents.
 * 
 * @param directory - Path to the directory to clean up
 * @returns Promise that resolves when cleanup is complete
 * @throws {Error} When directory cannot be removed
 * 
 * @example
 * ```typescript
 * try {
 *   await safeCleanup('/path/to/temp/dir');
 * } catch (error) {
 *   console.error('Cleanup failed:', error);
 * }
 * ```
 */
export async function safeCleanup(directory: string): Promise<void> {
  try {
    await fs.promises.rm(directory, { recursive: true, force: true });
  } catch (error) {
    console.error(`Error cleaning up directory ${directory}:`, error);
  }
}

/**
 * Spawns a child process and returns its output as a promise.
 * 
 * @param command - The command to execute
 * @param args - Array of command arguments
 * @returns Promise resolving to the command output
 * @throws {Error} When command execution fails
 * 
 * @example
 * ```typescript
 * try {
 *   const output = await _spawnPromise('yt-dlp', ['--version']);
 *   console.log('yt-dlp version:', output);
 * } catch (error) {
 *   console.error('Command failed:', error);
 * }
 * ```
 */
export function _spawnPromise(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args);
    let stdout = '';
    let stderr = '';

    process.on('error', (err) => {
      reject(new Error(`Failed to spawn ${command}: ${err.message}`));
    });

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Failed with exit code: ${code}\n${stderr}\n${stdout}`));
      }
    });
  });
}

/**
 * Generates a formatted timestamp string for file naming.
 * 
 * @returns Formatted timestamp string in the format 'YYYY-MM-DD_HH-mm-ss'
 * 
 * @example
 * ```typescript
 * const timestamp = getFormattedTimestamp();
 * console.log(timestamp); // '2024-03-20_12-30-00'
 * ```
 */
export function getFormattedTimestamp(): string {
  return new Date().toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .split('.')[0];
}

/**
 * Generates a random filename with timestamp prefix.
 * 
 * @param extension - Optional file extension (default: 'mp4')
 * @returns A random filename with timestamp
 * 
 * @example
 * ```typescript
 * const filename = generateRandomFilename('mp3');
 * console.log(filename); // '2024-03-20_12-30-00_a1b2c3d4.mp3'
 * ```
 */
/**
 * Resolves the absolute path of the file a download actually produced.
 *
 * Primary source is the path yt-dlp printed via `--print after_move:filepath`,
 * which is emitted after post-processing and therefore survives extension
 * rewrites (`-x`, `--remux-video`), filename rewrites (`--restrict-filenames`)
 * and truncation (`--trim-filenames`, `YTDLP_MAX_FILENAME_LENGTH`). Any of
 * those can come from the user's yt-dlp config file, so the path must be
 * reported by yt-dlp rather than predicted or reconstructed.
 *
 * The printed path is accepted even when it falls outside `downloadsDir`:
 * `--trim-filenames` truncates the whole path, so a config file can move the
 * download elsewhere entirely. Reporting where the file really landed beats
 * claiming it is missing.
 *
 * Falls back to scanning `downloadsDir` for the timestamp embedded in the
 * output template, which covers yt-dlp builds that print nothing.
 *
 * @param output - stdout captured from the yt-dlp download invocation
 * @param downloadsDir - Directory the download was requested to be written to
 * @param timestamp - Timestamp embedded in the output template
 * @returns Absolute path of the downloaded file, or undefined if none was found
 */
export function resolveDownloadedFile(
  output: string,
  downloadsDir: string,
  timestamp: string
): string | undefined {
  // yt-dlp prints the final path on its own line. Progress, info and verbose
  // lines are all bracket-prefixed, so an absolute path is unambiguous.
  const printed = output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('[') && path.isAbsolute(line))
    .pop();

  if (printed) {
    return printed;
  }

  try {
    const found = readdirSync(downloadsDir).find(file => file.includes(timestamp));
    return found ? path.join(downloadsDir, found) : undefined;
  } catch {
    return undefined;
  }
}

export function generateRandomFilename(extension: string = 'mp4'): string {
  const timestamp = getFormattedTimestamp();
  const randomId = randomBytes(4).toString('hex');
  return `${timestamp}_${randomId}.${extension}`;
}

/**
 * Cleans SRT subtitle content to produce a plain text transcript.
 * Removes timestamps, sequence numbers, and HTML tags.
 * 
 * @param srtContent - Raw SRT subtitle content
 * @returns Cleaned transcript text
 * 
 * @example
 * ```typescript
 * const cleanedText = cleanSubtitleToTranscript(srtContent);
 * console.log(cleanedText); // 'Hello world this is a transcript...'
 * ```
 */
export function cleanSubtitleToTranscript(srtContent: string): string {
  return srtContent
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      // Remove empty lines
      if (!trimmed) return false;
      // Remove sequence numbers (lines that are just digits)
      if (/^\d+$/.test(trimmed)) return false;
      // Remove timestamp lines
      if (/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}$/.test(trimmed)) return false;
      return true;
    })
    .map(line => {
      // Remove HTML tags
      return line.replace(/<[^>]*>/g, '');
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
} 