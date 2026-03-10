#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { CONFIG } from "./config.js";
import { _spawnPromise, safeCleanup } from "./modules/utils.js";
import { downloadVideo } from "./modules/video.js";
import { downloadAudio } from "./modules/audio.js";
import { listSubtitles, downloadSubtitles, downloadTranscript } from "./modules/subtitle.js";
import { searchVideos } from "./modules/search.js";
import { getVideoMetadata, getVideoMetadataSummary } from "./modules/metadata.js";
import { getVideoComments, getVideoCommentsSummary } from "./modules/comments.js";

const VERSION = '0.8.5';

// Response format enum
enum ResponseFormat {
  JSON = "json",
  MARKDOWN = "markdown"
}

// Upload date filter enum for YouTube search
enum UploadDateFilter {
  HOUR = "hour",
  TODAY = "today",
  WEEK = "week",
  MONTH = "month",
  YEAR = "year"
}

// Tool input schemas defined as raw Zod shapes.
// McpServer wraps each into an object schema and emits JSON Schema.
const SearchVideosInput = {
  query: z.string()
    .min(1, "Query cannot be empty")
    .max(200, "Query must not exceed 200 characters")
    .describe("Search keywords or phrase"),
  maxResults: z.coerce.number()
    .int("Must be a whole number")
    .min(1, "Must return at least 1 result")
    .max(50, "Cannot exceed 50 results")
    .default(10)
    .describe("Maximum number of results to return (1-50)"),
  offset: z.coerce.number()
    .int("Must be a whole number")
    .min(0, "Cannot be negative")
    .default(0)
    .describe("Number of results to skip for pagination"),
  response_format: z.nativeEnum(ResponseFormat)
    .default(ResponseFormat.MARKDOWN)
    .describe("Output format: 'json' for structured data, 'markdown' for human-readable"),
  uploadDateFilter: z.nativeEnum(UploadDateFilter)
    .optional()
    .describe("Optional filter by upload date: 'hour', 'today', 'week', 'month', 'year'. If omitted, returns videos from all dates."),
};

const ListSubtitleLanguagesInput = {
  url: z.string()
    .url("Must be a valid URL")
    .describe("URL of the video"),
};

const DownloadVideoSubtitlesInput = {
  url: z.string()
    .url("Must be a valid URL")
    .describe("URL of the video"),
  language: z.string()
    .regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, "Invalid language code format")
    .optional()
    .describe("Language code (e.g., 'en', 'zh-Hant', 'ja')"),
};

const DownloadVideoInput = {
  url: z.string()
    .url("Must be a valid URL")
    .describe("URL of the video"),
  resolution: z.enum(["480p", "720p", "1080p", "best"])
    .optional()
    .describe("Preferred video resolution (default: 720p)"),
  startTime: z.string()
    .regex(/^\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/, "Format must be HH:MM:SS or HH:MM:SS.ms")
    .optional()
    .describe("Start time for trimming (format: HH:MM:SS[.ms])"),
  endTime: z.string()
    .regex(/^\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/, "Format must be HH:MM:SS or HH:MM:SS.ms")
    .optional()
    .describe("End time for trimming (format: HH:MM:SS[.ms])"),
};

const DownloadAudioInput = {
  url: z.string()
    .url("Must be a valid URL")
    .describe("URL of the video"),
};

const DownloadTranscriptInput = {
  url: z.string()
    .url("Must be a valid URL")
    .describe("URL of the video"),
  language: z.string()
    .regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, "Invalid language code format")
    .optional()
    .describe("Language code (e.g., 'en', 'zh-Hant', 'ja'). Defaults to 'en'"),
};

const GetVideoMetadataInput = {
  url: z.string()
    .url("Must be a valid URL")
    .describe("URL of the video"),
  fields: z.array(z.string())
    .optional()
    .describe("Specific metadata fields to extract (e.g., ['id', 'title', 'description'])"),
};

const GetVideoMetadataSummaryInput = {
  url: z.string()
    .url("Must be a valid URL")
    .describe("URL of the video"),
};

const GetVideoCommentsInput = {
  url: z.string()
    .url("Must be a valid URL")
    .describe("URL of the video"),
  maxComments: z.coerce.number()
    .int("Must be a whole number")
    .min(1, "Must return at least 1 comment")
    .max(100, "Cannot exceed 100 comments")
    .default(20)
    .describe("Maximum number of comments to retrieve (1-100, default: 20)"),
  sortOrder: z.enum(["top", "new"])
    .default("top")
    .describe("Sort order: 'top' for most liked, 'new' for newest (default: 'top')"),
  view: z.enum(["flat", "threaded"])
    .default("flat")
    .describe("Comment view: 'flat' for backward-compatible list output, 'threaded' for reply trees"),
  responseFormat: z.enum(["json", "markdown_tree"])
    .default("json")
    .describe("Response format: 'json' for structured data, 'markdown_tree' for AI-friendly threaded Markdown (requires threaded view)"),
  maxParents: z.coerce.number()
    .int("Must be a whole number")
    .min(0, "Cannot be negative")
    .max(100, "Cannot exceed 100 parent comments")
    .optional()
    .describe("Optional cap for root comments passed to yt-dlp's YouTube extractor"),
  maxReplies: z.coerce.number()
    .int("Must be a whole number")
    .min(0, "Cannot be negative")
    .max(100, "Cannot exceed 100 reply comments")
    .optional()
    .describe("Optional cap for total replies passed to yt-dlp's YouTube extractor"),
  maxRepliesPerThread: z.coerce.number()
    .int("Must be a whole number")
    .min(0, "Cannot be negative")
    .max(100, "Cannot exceed 100 replies per thread")
    .optional()
    .describe("Optional cap for replies per thread passed to yt-dlp's YouTube extractor"),
  maxDepth: z.coerce.number()
    .int("Must be a whole number")
    .min(1, "Depth must be at least 1")
    .max(10, "Depth cannot exceed 10")
    .optional()
    .describe("Optional maximum reply depth passed to yt-dlp's YouTube extractor (default: 2)"),
};

const GetVideoCommentsSummaryInput = {
  url: z.string()
    .url("Must be a valid URL")
    .describe("URL of the video"),
  maxComments: z.coerce.number()
    .int("Must be a whole number")
    .min(1, "Must return at least 1 comment")
    .max(50, "Cannot exceed 50 comments for summary")
    .default(10)
    .describe("Maximum number of comments to include in summary (1-50, default: 10)"),
  view: z.enum(["flat", "threaded"])
    .default("flat")
    .describe("Summary view: 'flat' for linear comments, 'threaded' for grouped reply trees"),
};

/**
 * Validate system configuration
 * @throws {Error} when configuration is invalid
 */
async function validateConfig(): Promise<void> {
  // Check downloads directory
  if (!fs.existsSync(CONFIG.file.downloadsDir)) {
    throw new Error(`Downloads directory does not exist: ${CONFIG.file.downloadsDir}`);
  }

  // Check downloads directory permissions
  try {
    const testFile = path.join(CONFIG.file.downloadsDir, '.write-test');
    fs.writeFileSync(testFile, '');
    fs.unlinkSync(testFile);
  } catch (error) {
    throw new Error(`No write permission in downloads directory: ${CONFIG.file.downloadsDir}`);
  }

  // Check temporary directory permissions
  try {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), CONFIG.file.tempDirPrefix));
    await safeCleanup(testDir);
  } catch (error) {
    throw new Error(`Cannot create temporary directory in: ${os.tmpdir()}`);
  }
}

/**
 * Check required external dependencies
 * @throws {Error} when dependencies are not satisfied
 */
async function checkDependencies(): Promise<void> {
  for (const tool of CONFIG.tools.required) {
    try {
      await _spawnPromise(tool, ["--version"]);
    } catch (error) {
      throw new Error(`Required tool '${tool}' is not installed or not accessible`);
    }
  }
}

/**
 * Initialize service
 */
async function initialize(): Promise<void> {
  // Skip initialization checks in test environment
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    await validateConfig();
    await checkDependencies();
  } catch (error) {
    console.error('Initialization failed:', error);
    process.exit(1);
  }
}

/**
 * Wrap a tool action in unified error handling, returning a CallToolResult.
 */
async function handleToolExecution<T>(
  action: () => Promise<T>,
  errorPrefix: string
): Promise<CallToolResult> {
  try {
    const result = await action();
    return {
      content: [{ type: "text", text: String(result) }]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `${errorPrefix}: ${errorMessage}` }],
      isError: true
    };
  }
}

const server = new McpServer(
  {
    name: "yt-dlp-mcp",
    version: VERSION,
  },
  {
    capabilities: {
      tools: {}
    },
  }
);

server.registerTool(
  "ytdlp_search_videos",
  {
    description: `Search for videos on YouTube using keywords with pagination and date filtering support.

This tool queries YouTube's search API and returns matching videos with titles, uploaders, durations, and URLs. Supports pagination for browsing through large result sets and filtering by upload date.

Args:
  - query (string): Search keywords (e.g., "machine learning tutorial", "beethoven symphony")
  - maxResults (number): Number of results to return (1-50, default: 10)
  - offset (number): Skip first N results for pagination (default: 0)
  - response_format (enum): 'json' for structured data, 'markdown' for human-readable (default: 'markdown')
  - uploadDateFilter (enum, optional): Filter by upload date - 'hour' (last hour), 'today', 'week' (this week), 'month' (this month), 'year' (this year). Default: no filter (all dates)

Returns:
  Markdown format: Formatted list with video details and pagination info
  JSON format: { total, count, offset, videos: [{title, id, url, uploader, duration}], has_more, next_offset, upload_date_filter }

Use when: Finding videos by topic, creator name, or keywords; filtering recent uploads
Don't use when: You already have the video URL (use ytdlp_get_video_metadata instead)

Error Handling:
  - Returns "No videos found" if search is empty
  - Network errors: Check internet connection and retry
  - Rate limits: Wait before searching again`,
    inputSchema: SearchVideosInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ query, maxResults, offset, response_format, uploadDateFilter }) =>
    handleToolExecution(
      () => searchVideos(query, maxResults, offset, response_format, CONFIG, uploadDateFilter),
      "Error searching videos"
    )
);

server.registerTool(
  "ytdlp_list_subtitle_languages",
  {
    description: `List all available subtitle languages and formats for a video.

This tool retrieves the complete list of subtitle/caption languages available for a video, including both manually created and auto-generated subtitles.

Args:
  - url (string): Full video URL (YouTube, Vimeo, etc.)

Returns:
  Text output showing:
  - Available subtitle languages and codes
  - Format options (vtt, srt, etc.)
  - Whether subtitles are auto-generated or manual

Use when: Checking what subtitle languages are available before downloading
Don't use when: You want to download subtitles (use ytdlp_download_video_subtitles)

Error Handling:
  - "Invalid or unsupported URL format" for malformed URLs
  - "No subtitle files found" if video has no subtitles`,
    inputSchema: ListSubtitleLanguagesInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ url }) =>
    handleToolExecution(
      () => listSubtitles(url, CONFIG),
      "Error listing subtitle languages"
    )
);

server.registerTool(
  "ytdlp_download_video_subtitles",
  {
    description: `Download video subtitles/captions in VTT format.

This tool downloads subtitle files in WebVTT format, including both manually created and auto-generated captions. Subtitles are returned as text content with timestamps.

Args:
  - url (string): Full video URL
  - language (string, optional): Language code (e.g., 'en', 'zh-Hant', 'ja'). Defaults to config setting (usually 'en'). Auto-generated subtitles are used if manual ones aren't available.

Returns:
  Raw VTT subtitle content with:
  - Timestamp markers
  - Subtitle text segments
  - Formatting information

Use when: You need subtitle files with timestamps for video processing
Don't use when: You want plain text transcript (use ytdlp_download_transcript instead)

Error Handling:
  - "Invalid or unsupported URL format" for bad URLs
  - "No subtitle files found" if language is unavailable
  - Use ytdlp_list_subtitle_languages first to check available options`,
    inputSchema: DownloadVideoSubtitlesInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ url, language }) =>
    handleToolExecution(
      () => downloadSubtitles(url, language || CONFIG.download.defaultSubtitleLanguage, CONFIG),
      "Error downloading subtitles"
    )
);

server.registerTool(
  "ytdlp_download_video",
  {
    description: `Download video file to the user's Downloads folder.

This tool downloads video content from various platforms (YouTube, Vimeo, etc.) with options for quality selection and trimming. Files are saved to ~/Downloads by default.

Args:
  - url (string): Full video URL
  - resolution (enum, optional): Video quality - '480p' (SD), '720p' (HD, default), '1080p' (Full HD), or 'best' (highest available)
  - startTime (string, optional): Trim start point (format: HH:MM:SS or HH:MM:SS.ms, e.g., '00:01:30')
  - endTime (string, optional): Trim end point (format: HH:MM:SS or HH:MM:SS.ms, e.g., '00:02:45')

Returns:
  Success message with:
  - Downloaded filename
  - Destination folder path

Use when: User wants to save video file locally for offline viewing
Don't use when: User only needs audio (use ytdlp_download_audio) or transcript (use ytdlp_download_transcript)

Note: This creates/modifies local files. YouTube has different format handling than other platforms.

Error Handling:
  - "Download failed" with details if network errors or invalid URL
  - Check Downloads folder write permissions if saves fail`,
    inputSchema: DownloadVideoInput,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async ({ url, resolution, startTime, endTime }) =>
    handleToolExecution(
      () => downloadVideo(url, CONFIG, resolution, startTime, endTime),
      "Error downloading video"
    )
);

server.registerTool(
  "ytdlp_download_audio",
  {
    description: `Extract and download audio from video in best quality.

This tool extracts audio tracks from video content and saves them as audio files (typically M4A or MP3 format). Files are saved to ~/Downloads by default.

Args:
  - url (string): Full video URL from any supported platform

Returns:
  Success message with:
  - Downloaded audio filename
  - Destination folder path
  - Audio format (m4a/mp3)

Use when: User wants audio-only file (music, podcasts, speeches)
Don't use when: User needs video with visuals (use ytdlp_download_video) or just text transcript (use ytdlp_download_transcript)

Note: This creates/modifies local files. Audio is extracted in best available quality.

Error Handling:
  - "Download completed but file not found" if unexpected file naming
  - Check Downloads folder write permissions if saves fail
  - Network errors will show detailed messages`,
    inputSchema: DownloadAudioInput,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    }
  },
  async ({ url }) =>
    handleToolExecution(
      () => downloadAudio(url, CONFIG),
      "Error downloading audio"
    )
);

server.registerTool(
  "ytdlp_download_transcript",
  {
    description: `Generate clean plain text transcript from video subtitles.

This tool downloads subtitles and converts them to clean, readable text by removing timestamps, formatting tags, and duplicate content. Perfect for content analysis or reading.

Args:
  - url (string): Full video URL
  - language (string, optional): Language code (e.g., 'en', 'zh-Hant', 'ja'). Defaults to 'en'

Returns:
  Plain text transcript with:
  - All spoken content
  - No timestamps or technical markers
  - Cleaned HTML/formatting tags
  - Whitespace normalized

Use when: You need readable text content for analysis, summarization, or quotes
Don't use when: You need timestamps (use ytdlp_download_video_subtitles) or audio file (use ytdlp_download_audio)

Error Handling:
  - "Invalid or unsupported URL format" for bad URLs
  - "No subtitle files found for transcript generation" if language unavailable
  - Use ytdlp_list_subtitle_languages to check options first`,
    inputSchema: DownloadTranscriptInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ url, language }) =>
    handleToolExecution(
      () => downloadTranscript(url, language || CONFIG.download.defaultSubtitleLanguage, CONFIG),
      "Error downloading transcript"
    )
);

server.registerTool(
  "ytdlp_get_video_metadata",
  {
    description: `Extract comprehensive video metadata in JSON format without downloading content.

This tool retrieves detailed information about a video using yt-dlp's metadata extraction. No video/audio content is downloaded, only metadata is fetched.

Args:
  - url (string): Full video URL
  - fields (array, optional): Specific fields to extract (e.g., ['id', 'title', 'description', 'channel', 'view_count']). If omitted, returns all available metadata.

Returns:
  JSON object with metadata including:
  - Basic: id, title, description, duration
  - Channel: channel, channel_id, uploader, channel_url
  - Stats: view_count, like_count, comment_count
  - Dates: upload_date, timestamp
  - Technical: formats, thumbnails, subtitles
  - Content: tags, categories, license
  - Series/Episode info if applicable
  - Music metadata if applicable

Use when: You need structured data about a video (for analysis, archiving, or display)
Don't use when: You want human-readable summary (use ytdlp_get_video_metadata_summary)

Error Handling:
  - "Video is unavailable or private" for inaccessible content
  - "Unsupported URL or extractor not found" for unsupported platforms
  - "Network error" with details for connectivity issues`,
    inputSchema: GetVideoMetadataInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ url, fields }) =>
    handleToolExecution(
      () => getVideoMetadata(url, fields, CONFIG),
      "Error extracting video metadata"
    )
);

server.registerTool(
  "ytdlp_get_video_metadata_summary",
  {
    description: `Get human-readable summary of key video information.

This tool extracts and formats the most important video metadata into an easy-to-read summary. Perfect for quick video information display.

Args:
  - url (string): Full video URL

Returns:
  Formatted text summary with:
  - Title and channel name
  - Duration (formatted as HH:MM:SS or MM:SS)
  - View count and like count
  - Upload date (YYYY-MM-DD format)
  - First 200 characters of description
  - Tags (first 5 shown)
  - Live status if applicable

Use when: You want a quick, readable overview of video details
Don't use when: You need complete structured data (use ytdlp_get_video_metadata with response_format='json')

Error Handling:
  - Same as ytdlp_get_video_metadata (unavailable videos, unsupported URLs, network errors)`,
    inputSchema: GetVideoMetadataSummaryInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ url }) =>
    handleToolExecution(
      () => getVideoMetadataSummary(url, CONFIG),
      "Error generating video metadata summary"
    )
);

server.registerTool(
  "ytdlp_get_video_comments",
  {
    description: `Extract comments from a video in JSON or AI-friendly Markdown format.

This tool retrieves comments from videos (primarily YouTube) using yt-dlp's comment extraction feature. It supports backward-compatible flat JSON, threaded JSON with nested replies, and AI-friendly Markdown that preserves thread structure.

Args:
  - url (string): Full video URL
  - maxComments (number): Maximum comments to retrieve (1-100, default: 20)
  - sortOrder (enum): 'top' for most liked comments, 'new' for newest (default: 'top')
  - view (enum): 'flat' for linear output, 'threaded' for nested replies (default: 'flat')
  - responseFormat (enum): 'json' for structured data, 'markdown_tree' for AI-friendly threaded Markdown (default: 'json', requires threaded view)
  - maxParents (number, optional): Cap root comments at extractor level
  - maxReplies (number, optional): Cap total replies at extractor level
  - maxRepliesPerThread (number, optional): Cap replies per thread at extractor level
  - maxDepth (number, optional): Cap reply depth at extractor level (default: 2)

Returns:
  JSON format:
  - count: Number of comments returned
  - has_more: Whether more comments are available
  - root_threads: Number of root comments returned
  - reply_comments: Number of reply comments returned
  - orphan_comments: Replies whose parent was missing and had to be lifted to root
  - comments: Array of comment objects containing:
    - id: Comment identifier
    - text: Comment content
    - author: Author name
    - author_id: Author channel ID
    - author_is_uploader: Whether author is video creator
    - author_is_verified: Whether author is verified
    - like_count: Number of likes
    - is_pinned: Whether comment is pinned
    - parent: Parent comment ID (for replies)
    - timestamp: Unix timestamp
    - time_text: Human-readable time (e.g., "2 days ago")
    - depth: Reply depth in the reconstructed tree
    - reply_count: Number of direct replies included

  Threaded JSON additionally nests replies inside each root comment under 'replies: []'.
  Markdown format returns '## Thread N' blocks with explicit 'parent_id', 'depth', 'reply_count', and pipe-prefixed text blocks.

Use when: You need structured comment data for analysis or display
Don't use when: You want a quick readable overview (use ytdlp_get_video_comments_summary)

Note: Comment extraction is primarily supported for YouTube. On platforms without reply metadata, threaded mode degrades gracefully to root-only comments.

Error Handling:
  - "Video is unavailable or private" for inaccessible content
  - "Comments are disabled" for videos with comments turned off
  - "Requires authentication" for age-restricted content (configure cookies)
  - "Unsupported platform" for non-YouTube URLs`,
    inputSchema: GetVideoCommentsInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ url, maxComments, sortOrder, view, responseFormat, maxParents, maxReplies, maxRepliesPerThread, maxDepth }) =>
    handleToolExecution(
      () => getVideoComments(url, maxComments, sortOrder, CONFIG, {
        view,
        responseFormat,
        maxParents,
        maxReplies,
        maxRepliesPerThread,
        maxDepth,
      }),
      "Error extracting video comments"
    )
);

server.registerTool(
  "ytdlp_get_video_comments_summary",
  {
    description: `Get a human-readable summary of video comments.

This tool extracts comments and formats them into an easy-to-read summary. It can render either a linear flat list or grouped reply threads.

Args:
  - url (string): Full video URL
  - maxComments (number): Maximum comments to include (1-50, default: 10)
  - view (enum): 'flat' for linear comments, 'threaded' for grouped reply trees (default: 'flat')

Returns:
  Formatted text summary with:
  - Comment author with indicators ([UPLOADER], [VERIFIED], [PINNED])
  - Time posted (e.g., "2 days ago")
  - Like count
  - Comment text (truncated to 300 chars if longer)
  - Reply grouping in threaded mode

Use when: You want a quick, readable overview of video comments
Don't use when: You need complete structured data (use ytdlp_get_video_comments)

Note: Comments are sorted by "top" (most liked) by default.

Error Handling:
  - Same as ytdlp_get_video_comments (unavailable videos, disabled comments, authentication required)`,
    inputSchema: GetVideoCommentsSummaryInput,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async ({ url, maxComments, view }) =>
    handleToolExecution(
      () => getVideoCommentsSummary(url, maxComments, CONFIG, { view }),
      "Error generating video comments summary"
    )
);

/**
 * Starts the server using Stdio transport.
 */
async function startServer() {
  await initialize();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Start the server and handle potential errors
startServer().catch(console.error);
