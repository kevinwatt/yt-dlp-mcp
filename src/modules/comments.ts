import type { Config } from "../config.js";
import { getCookieArgs } from "../config.js";
import {
  _spawnPromise,
  validateUrl
} from "./utils.js";

/**
 * Represents a single comment on a video
 */
export interface Comment {
  /** Unique comment identifier */
  id?: string;
  /** Comment text content */
  text?: string;
  /** Comment author name */
  author?: string;
  /** Comment author channel ID */
  author_id?: string;
  /** Comment author channel URL */
  author_url?: string;
  /** Whether the author is the video uploader */
  author_is_uploader?: boolean;
  /** Whether author is verified */
  author_is_verified?: boolean;
  /** Comment like count */
  like_count?: number;
  /** Whether comment is pinned */
  is_pinned?: boolean;
  /** Whether comment is marked as favorite by uploader */
  is_favorited?: boolean;
  /** Parent comment ID (for replies) */
  parent?: string;
  /** Unix timestamp of comment */
  timestamp?: number;
  /** Human-readable time ago string */
  time_text?: string;
  /** Additional fields that might be present */
  [key: string]: unknown;
}

/**
 * Response structure for video comments
 */
export interface CommentsResponse {
  /** Total number of comments returned */
  count: number;
  /** Whether there are more comments available */
  has_more: boolean;
  /** Array of comment objects */
  comments: Comment[];
  /** Truncation indicator */
  _truncated?: boolean;
  /** Truncation message */
  _message?: string;
}

/**
 * Sort order for comments
 */
export type CommentSortOrder = "top" | "new";

/**
 * Extract video comments using yt-dlp.
 * Uses yt-dlp's --write-comments and --dump-json flags to get comments.
 *
 * @param url - The URL of the video to extract comments from
 * @param maxComments - Maximum number of comments to retrieve (default: 20)
 * @param sortOrder - Sort order: "top" for most liked, "new" for newest (default: "top")
 * @param config - Configuration object
 * @returns Promise resolving to JSON string with comments data
 * @throws {Error} When URL is invalid or comment extraction fails
 *
 * @example
 * ```typescript
 * // Get top 20 comments
 * const comments = await getVideoComments('https://youtube.com/watch?v=...');
 * console.log(comments);
 *
 * // Get newest 50 comments
 * const newComments = await getVideoComments(
 *   'https://youtube.com/watch?v=...',
 *   50,
 *   'new'
 * );
 * ```
 */
export async function getVideoComments(
  url: string,
  maxComments: number = 20,
  sortOrder: CommentSortOrder = "top",
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
    "--write-comments",
    "--extractor-args", `youtube:comment_sort=${sortOrder};max_comments=${maxComments},all,all`,
    "--skip-download",
    ...(_config ? getCookieArgs(_config) : []),
    url
  ];

  try {
    // Execute yt-dlp to get metadata with comments
    const output = await _spawnPromise("yt-dlp", args);

    // Parse the JSON output
    const metadata = JSON.parse(output);

    // Extract comments from metadata
    const rawComments: Comment[] = metadata.comments || [];

    // Limit to maxComments
    const comments = rawComments.slice(0, maxComments);

    // Build response
    const response: CommentsResponse = {
      count: comments.length,
      has_more: rawComments.length > maxComments,
      comments: comments.map(comment => ({
        id: comment.id,
        text: comment.text,
        author: comment.author,
        author_id: comment.author_id,
        author_url: comment.author_url,
        author_is_uploader: comment.author_is_uploader,
        author_is_verified: comment.author_is_verified,
        like_count: comment.like_count,
        is_pinned: comment.is_pinned,
        is_favorited: comment.is_favorited,
        parent: comment.parent,
        timestamp: comment.timestamp,
        time_text: comment.time_text
      }))
    };

    let result = JSON.stringify(response, null, 2);

    // Check character limit
    if (_config && result.length > _config.limits.characterLimit) {
      // Reduce comments to fit within limit
      let truncatedComments = [...response.comments];

      while (result.length > _config.limits.characterLimit && truncatedComments.length > 1) {
        truncatedComments = truncatedComments.slice(0, -1);
        const truncatedResponse: CommentsResponse = {
          count: truncatedComments.length,
          has_more: true,
          comments: truncatedComments,
          _truncated: true,
          _message: `Response truncated to ${truncatedComments.length} comments due to size limits. Use smaller maxComments value.`
        };
        result = JSON.stringify(truncatedResponse, null, 2);
      }
    }

    return result;

  } catch (error) {
    if (error instanceof Error) {
      // Handle common yt-dlp errors with actionable messages
      if (error.message.includes("Video unavailable") || error.message.includes("private")) {
        throw new Error(`Video is unavailable or private: ${url}. Check the URL and video privacy settings.`);
      } else if (error.message.includes("Unsupported URL") || error.message.includes("extractor")) {
        throw new Error(`Unsupported platform or video URL: ${url}. Comments extraction is primarily supported for YouTube.`);
      } else if (error.message.includes("network") || error.message.includes("Connection")) {
        throw new Error("Network error while extracting comments. Check your internet connection and retry.");
      } else if (error.message.includes("comments are disabled") || error.message.includes("Comments are turned off")) {
        throw new Error(`Comments are disabled for this video: ${url}`);
      } else if (error.message.includes("Sign in") || error.message.includes("age")) {
        throw new Error(`This video requires authentication to view comments. Configure cookies in your settings.`);
      } else {
        throw new Error(`Failed to extract video comments: ${error.message}. Verify the URL is correct.`);
      }
    }
    throw new Error(`Failed to extract video comments from ${url}`);
  }
}

/**
 * Get a human-readable summary of video comments.
 * This is useful for quick overview without overwhelming JSON output.
 *
 * @param url - The URL of the video to extract comments from
 * @param maxComments - Maximum number of comments to include (default: 10)
 * @param config - Configuration object
 * @returns Promise resolving to a formatted summary string
 * @throws {Error} When URL is invalid or comment extraction fails
 *
 * @example
 * ```typescript
 * const summary = await getVideoCommentsSummary('https://youtube.com/watch?v=...');
 * console.log(summary);
 * // Output:
 * // Video Comments (10 shown)
 * // ─────────────────────────
 * //
 * // 👤 John Doe (2 days ago) ❤️ 1,234 likes
 * // This is an awesome video!
 * //
 * // 👤 Jane Smith (1 week ago) ❤️ 567 likes
 * // Great content, keep it up!
 * ```
 */
export async function getVideoCommentsSummary(
  url: string,
  maxComments: number = 10,
  _config?: Config
): Promise<string> {
  try {
    // Get the comments
    const commentsJson = await getVideoComments(url, maxComments, "top", _config);
    const data: CommentsResponse = JSON.parse(commentsJson);

    // Format comments into a readable summary
    const lines: string[] = [];

    lines.push(`Video Comments (${data.count} shown)`);
    lines.push('─'.repeat(30));
    lines.push('');

    for (const comment of data.comments) {
      // Build author line with indicators
      let authorLine = `Author: ${comment.author || 'Unknown'}`;
      if (comment.author_is_uploader) {
        authorLine += ' [UPLOADER]';
      }
      if (comment.author_is_verified) {
        authorLine += ' [VERIFIED]';
      }
      if (comment.is_pinned) {
        authorLine += ' [PINNED]';
      }

      // Time info
      if (comment.time_text) {
        authorLine += ` (${comment.time_text})`;
      }

      // Likes
      if (comment.like_count !== undefined && comment.like_count > 0) {
        authorLine += ` - ${comment.like_count.toLocaleString()} likes`;
      }

      lines.push(authorLine);

      // Comment text (truncate if too long)
      if (comment.text) {
        const text = comment.text.length > 300
          ? comment.text.substring(0, 300) + '...'
          : comment.text;
        lines.push(text);
      }

      // Note if this is a reply
      if (comment.parent && comment.parent !== 'root') {
        lines.push(`(Reply to comment ${comment.parent})`);
      }

      lines.push('');
    }

    if (data.has_more) {
      lines.push('---');
      lines.push('More comments available. Increase maxComments to see more.');
    }

    return lines.join('\n');
  } catch (error) {
    // Re-throw errors from getVideoComments with context
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to generate comments summary for ${url}`);
  }
}
