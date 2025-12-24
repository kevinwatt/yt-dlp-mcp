import type { Config } from "../config.js";
import { getCookieArgs } from "../config.js";
import {
  _spawnPromise,
  validateUrl
} from "./utils.js";

/**
 * Video metadata interface containing all fields that can be extracted
 */
export interface VideoMetadata {
  // Basic video information
  id?: string;
  title?: string;
  fulltitle?: string;
  description?: string;
  alt_title?: string;
  display_id?: string;
  
  // Creator/uploader information
  uploader?: string;
  uploader_id?: string;
  uploader_url?: string;
  creators?: string[];
  creator?: string;
  
  // Channel information
  channel?: string;
  channel_id?: string;
  channel_url?: string;
  channel_follower_count?: number;
  channel_is_verified?: boolean;
  
  // Timestamps and dates
  timestamp?: number;
  upload_date?: string;
  release_timestamp?: number;
  release_date?: string;
  release_year?: number;
  modified_timestamp?: number;
  modified_date?: string;
  
  // Video properties
  duration?: number;
  duration_string?: string;
  view_count?: number;
  concurrent_view_count?: number;
  like_count?: number;
  dislike_count?: number;
  repost_count?: number;
  average_rating?: number;
  comment_count?: number;
  age_limit?: number;
  
  // Content classification
  live_status?: string;
  is_live?: boolean;
  was_live?: boolean;
  playable_in_embed?: string;
  availability?: string;
  media_type?: string;
  
  // Playlist information
  playlist_id?: string;
  playlist_title?: string;
  playlist?: string;
  playlist_count?: number;
  playlist_index?: number;
  playlist_autonumber?: number;
  playlist_uploader?: string;
  playlist_uploader_id?: string;
  playlist_channel?: string;
  playlist_channel_id?: string;
  
  // URLs and technical info
  webpage_url?: string;
  webpage_url_domain?: string;
  webpage_url_basename?: string;
  original_url?: string;
  filename?: string;
  ext?: string;
  
  // Content metadata
  categories?: string[];
  tags?: string[];
  cast?: string[];
  location?: string;
  license?: string;
  
  // Series/episode information
  series?: string;
  series_id?: string;
  season?: string;
  season_number?: number;
  season_id?: string;
  episode?: string;
  episode_number?: number;
  episode_id?: string;
  
  // Music/track information
  track?: string;
  track_number?: number;
  track_id?: string;
  artists?: string[];
  artist?: string;
  genres?: string[];
  genre?: string;
  composers?: string[];
  composer?: string;
  album?: string;
  album_type?: string;
  album_artists?: string[];
  album_artist?: string;
  disc_number?: number;
  
  // Technical metadata
  extractor?: string;
  epoch?: number;
  
  // Additional fields that might be present
  [key: string]: unknown;
}

/**
 * Extract video metadata without downloading the actual video content.
 * Uses yt-dlp's --dump-json flag to get comprehensive metadata.
 *
 * @param url - The URL of the video to extract metadata from
 * @param fields - Optional array of specific fields to extract. If not provided, returns all available metadata
 * @param config - Configuration object (currently unused but kept for consistency)
 * @returns Promise resolving to formatted metadata string or JSON object
 * @throws {Error} When URL is invalid or metadata extraction fails
 *
 * @example
 * ```typescript
 * // Get all metadata
 * const metadata = await getVideoMetadata('https://youtube.com/watch?v=...');
 * console.log(metadata);
 *
 * // Get specific fields only
 * const specificData = await getVideoMetadata(
 *   'https://youtube.com/watch?v=...',
 *   ['id', 'title', 'description', 'channel']
 * );
 * console.log(specificData);
 * ```
 */
export async function getVideoMetadata(
  url: string,
  fields?: string[],
  _config?: Config
): Promise<string> {
  // Validate the URL
  if (!validateUrl(url)) {
    throw new Error("Invalid or unsupported URL format");
  }

  const args = [
    "--dump-json",
    "--no-warnings",
    "--no-check-certificate",
    ...(_config ? getCookieArgs(_config) : []),
    url
  ];

  try {
    // Execute yt-dlp to get metadata
    const output = await _spawnPromise("yt-dlp", args);

    // Parse the JSON output
    const metadata: VideoMetadata = JSON.parse(output);

    // If specific fields are requested, filter the metadata
    if (fields !== undefined && fields.length >= 0) {
      const filteredMetadata: Partial<VideoMetadata> & { _truncated?: boolean; _message?: string } = {};

      for (const field of fields) {
        if (metadata.hasOwnProperty(field)) {
          filteredMetadata[field as keyof VideoMetadata] = metadata[field as keyof VideoMetadata];
        }
      }

      let result = JSON.stringify(filteredMetadata, null, 2);

      // Check character limit
      if (_config && result.length > _config.limits.characterLimit) {
        // Add truncation info inside JSON before truncating
        filteredMetadata._truncated = true;
        filteredMetadata._message = "Response truncated. Specify fewer fields to see complete data.";
        result = JSON.stringify(filteredMetadata, null, 2);

        // If still too long, truncate the string content
        if (result.length > _config.limits.characterLimit) {
          result = result.substring(0, _config.limits.characterLimit) + '\n... }';
        }
      }

      return result;
    }

    // Return formatted JSON string with all metadata
    let result = JSON.stringify(metadata, null, 2);

    // Check character limit for full metadata
    if (_config && result.length > _config.limits.characterLimit) {
      // Try to return essential fields only
      const essentialFields = ['id', 'title', 'description', 'channel', 'channel_id', 'uploader',
                               'duration', 'duration_string', 'view_count', 'like_count',
                               'upload_date', 'tags', 'categories', 'webpage_url'];
      const essentialMetadata: Partial<VideoMetadata> & { _truncated?: boolean; _message?: string } = {};

      for (const field of essentialFields) {
        if (metadata.hasOwnProperty(field)) {
          essentialMetadata[field as keyof VideoMetadata] = metadata[field as keyof VideoMetadata];
        }
      }

      // Add truncation info inside the JSON object
      essentialMetadata._truncated = true;
      essentialMetadata._message = 'Full metadata truncated to essential fields. Use the "fields" parameter to request specific fields.';

      result = JSON.stringify(essentialMetadata, null, 2);
    }

    return result;

  } catch (error) {
    if (error instanceof Error) {
      // Handle common yt-dlp errors with actionable messages
      if (error.message.includes("Video unavailable") || error.message.includes("private")) {
        throw new Error(`Video is unavailable or private: ${url}. Check the URL and video privacy settings.`);
      } else if (error.message.includes("Unsupported URL") || error.message.includes("extractor")) {
        throw new Error(`Unsupported platform or video URL: ${url}. Ensure the URL is from a supported platform like YouTube.`);
      } else if (error.message.includes("network") || error.message.includes("Connection")) {
        throw new Error("Network error while extracting metadata. Check your internet connection and retry.");
      } else {
        throw new Error(`Failed to extract video metadata: ${error.message}. Verify the URL is correct.`);
      }
    }
    throw new Error(`Failed to extract video metadata from ${url}`);
  }
}

/**
 * Get a human-readable summary of key video metadata fields.
 * This is useful for quick overview without overwhelming JSON output.
 *
 * @param url - The URL of the video to extract metadata from
 * @param config - Configuration object (currently unused but kept for consistency)
 * @returns Promise resolving to a formatted summary string
 * @throws {Error} When URL is invalid or metadata extraction fails
 *
 * @example
 * ```typescript
 * const summary = await getVideoMetadataSummary('https://youtube.com/watch?v=...');
 * console.log(summary);
 * // Output:
 * // Title: Example Video Title
 * // Channel: Example Channel
 * // Duration: 10:30
 * // Views: 1,234,567
 * // Upload Date: 2023-12-01
 * // Description: This is an example video...
 * ```
 */
export async function getVideoMetadataSummary(
  url: string,
  _config?: Config
): Promise<string> {
  try {
    // Get the full metadata first
    const metadataJson = await getVideoMetadata(url, undefined, _config);
    const metadata: VideoMetadata = JSON.parse(metadataJson);

    // Format key fields into a readable summary
    const lines: string[] = [];
  
  if (metadata.title) {
    lines.push(`Title: ${metadata.title}`);
  }
  
  if (metadata.channel) {
    lines.push(`Channel: ${metadata.channel}`);
  }
  
  if (metadata.uploader && metadata.uploader !== metadata.channel) {
    lines.push(`Uploader: ${metadata.uploader}`);
  }
  
  if (metadata.duration_string) {
    lines.push(`Duration: ${metadata.duration_string}`);
  } else if (metadata.duration) {
    const hours = Math.floor(metadata.duration / 3600);
    const minutes = Math.floor((metadata.duration % 3600) / 60);
    const seconds = metadata.duration % 60;
    const durationStr = hours > 0 
      ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      : `${minutes}:${seconds.toString().padStart(2, '0')}`;
    lines.push(`Duration: ${durationStr}`);
  }
  
  if (metadata.view_count !== undefined) {
    lines.push(`Views: ${metadata.view_count.toLocaleString()}`);
  }
  
  if (metadata.like_count !== undefined) {
    lines.push(`Likes: ${metadata.like_count.toLocaleString()}`);
  }
  
  if (metadata.upload_date) {
    // Format YYYYMMDD to YYYY-MM-DD
    const dateStr = metadata.upload_date;
    if (dateStr.length === 8) {
      const formatted = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
      lines.push(`Upload Date: ${formatted}`);
    } else {
      lines.push(`Upload Date: ${dateStr}`);
    }
  }
  
  if (metadata.live_status && metadata.live_status !== 'not_live') {
    lines.push(`Status: ${metadata.live_status.replace('_', ' ')}`);
  }
  
  if (metadata.tags && metadata.tags.length > 0) {
    lines.push(`Tags: ${metadata.tags.slice(0, 5).join(', ')}${metadata.tags.length > 5 ? '...' : ''}`);
  }
  
  if (metadata.description) {
    // Truncate description to first 200 characters
    const desc = metadata.description.length > 200
      ? metadata.description.substring(0, 200) + '...'
      : metadata.description;
    lines.push(`Description: ${desc}`);
  }

  return lines.join('\n');
  } catch (error) {
    // Re-throw errors from getVideoMetadata with context
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to generate metadata summary for ${url}`);
  }
}