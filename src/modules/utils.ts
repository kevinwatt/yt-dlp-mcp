import * as fs from 'fs';
import * as path from 'path';
import { readdirSync } from 'fs';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { lookup } from 'dns/promises';
import { BlockList, isIPv4 } from 'net';

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
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// Loopback, private, link-local (incl. cloud metadata), CGNAT, multicast and reserved ranges
const NON_PUBLIC_ADDRESSES = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]
] as const) {
  NON_PUBLIC_ADDRESSES.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8]
] as const) {
  NON_PUBLIC_ADDRESSES.addSubnet(network, prefix, 'ipv6');
}

/**
 * Checks if an IP address is loopback, private, link-local or otherwise not publicly routable.
 *
 * @param address - IPv4 or IPv6 address
 * @returns True if the address must not be fetched
 */
export function isNonPublicAddress(address: string): boolean {
  // IPv4-mapped IPv6, in dotted (::ffff:127.0.0.1) or hex (::ffff:7f00:1) form
  const dotted = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (dotted) {
    return NON_PUBLIC_ADDRESSES.check(dotted[1], 'ipv4');
  }
  const hex = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (hex) {
    const [high, low] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
    return NON_PUBLIC_ADDRESSES.check(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`, 'ipv4');
  }
  return NON_PUBLIC_ADDRESSES.check(address, isIPv4(address) ? 'ipv4' : 'ipv6');
}

/**
 * Rejects URLs whose host resolves to a loopback, private or link-local address,
 * so tools cannot be used to reach internal services or cloud metadata endpoints.
 *
 * @param url - The URL to check (must already pass validateUrl)
 * @param allowPrivate - Skip the check (YTDLP_ALLOW_PRIVATE_URLS=true)
 * @throws {Error} When the host resolves to a non-public address
 */
export async function assertPublicUrl(url: string, allowPrivate = false): Promise<void> {
  if (allowPrivate) {
    return;
  }

  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    // Proxy-only networks may not resolve external names locally; leave it to yt-dlp
    return;
  }

  if (addresses.some(({ address }) => isNonPublicAddress(address))) {
    throw new Error(
      `URL host ${hostname} resolves to a private or local network address, which is blocked. ` +
      'Set YTDLP_ALLOW_PRIVATE_URLS=true to allow it.'
    );
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