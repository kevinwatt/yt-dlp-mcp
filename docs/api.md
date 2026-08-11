# API Reference

## Video Operations

### downloadVideo(url: string, config?: Config, resolution?: string, startTime?: string, endTime?: string): Promise<string>

Downloads a video from the specified URL with optional trimming.

**Parameters:**
- `url`: The URL of the video to download
- `config`: (Optional) Configuration object
- `resolution`: (Optional) Preferred video resolution ('480p', '720p', '1080p', 'best')
- `startTime`: (Optional) Start time for trimming (format: HH:MM:SS[.ms])
- `endTime`: (Optional) End time for trimming (format: HH:MM:SS[.ms])

**Returns:**
- Promise resolving to a success message with the downloaded file path

**Example:**
```javascript
import { downloadVideo } from '@kevinwatt/yt-dlp-mcp';

// Download with default settings
const result = await downloadVideo('https://www.youtube.com/watch?v=jNQXAC9IVRw');
console.log(result);

// Download with specific resolution
const hdResult = await downloadVideo(
  'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  undefined,
  '1080p'
);
console.log(hdResult);

// Download with trimming
const trimmedResult = await downloadVideo(
  'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  undefined,
  '720p',
  '00:01:30',
  '00:02:45'
);
console.log(trimmedResult);

// Download with fractional seconds
const preciseTrim = await downloadVideo(
  'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  undefined,
  '720p',
  '00:01:30.500',
  '00:02:45.250'
);
console.log(preciseTrim);
```

## Audio Operations

### downloadAudio(url: string, config?: Config): Promise<string>

Downloads audio from the specified URL in the best available quality.

**Parameters:**
- `url`: The URL of the video to extract audio from
- `config`: (Optional) Configuration object

**Returns:**
- Promise resolving to a success message with the downloaded file path

**Example:**
```javascript
import { downloadAudio } from '@kevinwatt/yt-dlp-mcp';

const result = await downloadAudio('https://www.youtube.com/watch?v=jNQXAC9IVRw');
console.log(result);
```

## Subtitle Operations

### listSubtitles(url: string): Promise<string>

Lists all available subtitles for a video.

**Parameters:**
- `url`: The URL of the video

**Returns:**
- Promise resolving to a string containing the list of available subtitles

**Example:**
```javascript
import { listSubtitles } from '@kevinwatt/yt-dlp-mcp';

const subtitles = await listSubtitles('https://www.youtube.com/watch?v=jNQXAC9IVRw');
console.log(subtitles);
```

### downloadSubtitles(url: string, language: string): Promise<string>

Downloads subtitles for a video in the specified language.

**Parameters:**
- `url`: The URL of the video
- `language`: Language code (e.g., 'en', 'zh-Hant', 'ja')

**Returns:**
- Promise resolving to the subtitle content

**Example:**
```javascript
import { downloadSubtitles } from '@kevinwatt/yt-dlp-mcp';

const subtitles = await downloadSubtitles(
  'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  'en'
);
console.log(subtitles);
```

## Metadata Operations

### getVideoMetadata(url: string, fields?: string[]): Promise<string>

Extract comprehensive video metadata using yt-dlp without downloading the content.

**Parameters:**
- `url`: The URL of the video to extract metadata from
- `fields`: (Optional) Specific metadata fields to extract (e.g., `['id', 'title', 'description', 'channel']`). If omitted, returns all available metadata. If provided as an empty array `[]`, returns `{}`.

**Returns:**
- Promise resolving to a JSON string of metadata (pretty-printed)

**Example:**
```javascript
import { getVideoMetadata } from '@kevinwatt/yt-dlp-mcp';

// Get all metadata
const all = await getVideoMetadata('https://www.youtube.com/watch?v=jNQXAC9IVRw');
console.log(all);

// Get specific fields only
const subset = await getVideoMetadata(
  'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  ['id', 'title', 'description', 'channel']
);
console.log(subset);
```

### getVideoMetadataSummary(url: string): Promise<string>

Get a human-readable summary of key video metadata fields.

**Parameters:**
- `url`: The URL of the video

**Returns:**
- Promise resolving to a formatted text summary (title, channel, duration, views, upload date, description preview, etc.)

**Example:**
```javascript
import { getVideoMetadataSummary } from '@kevinwatt/yt-dlp-mcp';

const summary = await getVideoMetadataSummary('https://www.youtube.com/watch?v=jNQXAC9IVRw');
console.log(summary);
```

## Comments Operations

### getVideoComments(url: string, maxComments?: number, sortOrder?: "top" | "new", config?: Config, options?: GetVideoCommentsOptions): Promise<string>

Extract comments without downloading video content. Supports flat JSON, threaded JSON, and AI-friendly Markdown output.

**Parameters:**
- `url`: The URL of the video to inspect
- `maxComments`: (Optional) Maximum total comments to request (default: `20`)
- `sortOrder`: (Optional) `"top"` or `"new"` (default: `"top"`)
- `config`: (Optional) Configuration object
- `options.view`: (Optional) `"flat"` or `"threaded"` (default: `"flat"`)
- `options.responseFormat`: (Optional) `"json"` or `"markdown_tree"` (default: `"json"`). `markdown_tree` requires `options.view="threaded"` or omitted view
- `options.maxParents`: (Optional) Cap root comments at extractor level
- `options.maxReplies`: (Optional) Cap total replies at extractor level
- `options.maxRepliesPerThread`: (Optional) Cap replies per thread at extractor level
- `options.maxDepth`: (Optional) Cap reply depth at extractor level (default: `2`)

**Returns:**
- Promise resolving to:
  - Flat JSON: `{ count, has_more, root_threads, reply_comments, orphan_comments, comments: NormalizedComment[] }`
  - Threaded JSON: `{ count, has_more, root_threads, reply_comments, orphan_comments, comments: ThreadedComment[] }`
  - Markdown tree: AI-friendly `## Thread N` blocks with `parent_id`, `depth`, `reply_count`, and text blocks

**Notes:**
- `time_text` is normalized from either `time_text` or `_time_text`
- Replies whose parent is missing are lifted to root and counted in `orphan_comments`
- Platforms without reply metadata gracefully degrade to root-only comments in threaded mode

**Example:**
```javascript
import { getVideoComments } from '@kevinwatt/yt-dlp-mcp';

const flatJson = await getVideoComments(
  'https://www.youtube.com/watch?v=jNQXAC9IVRw'
);
console.log(flatJson);

const threadedJson = await getVideoComments(
  'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  25,
  'top',
  undefined,
  { view: 'threaded', maxRepliesPerThread: 5, maxDepth: 2 }
);
console.log(threadedJson);

const markdownTree = await getVideoComments(
  'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  25,
  'new',
  undefined,
  { responseFormat: 'markdown_tree', maxDepth: 2 }
);
console.log(markdownTree);
```

### getVideoCommentsSummary(url: string, maxComments?: number, config?: Config, options?: GetVideoCommentsSummaryOptions): Promise<string>

Get a readable summary of comments. Can render either a flat sequence or grouped reply threads.

**Parameters:**
- `url`: The URL of the video to inspect
- `maxComments`: (Optional) Maximum number of comments to summarize (default: `10`)
- `config`: (Optional) Configuration object
- `options.view`: (Optional) `"flat"` or `"threaded"` (default: `"flat"`)

**Returns:**
- Promise resolving to a readable summary string

**Example:**
```javascript
import { getVideoCommentsSummary } from '@kevinwatt/yt-dlp-mcp';

const summary = await getVideoCommentsSummary(
  'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  10,
  undefined,
  { view: 'threaded' }
);
console.log(summary);
```

## Configuration

### Config Interface

```typescript
interface Config {
  file: {
    maxFilenameLength: number;
    downloadsDir: string;
    tempDirPrefix: string;
    sanitize: {
      replaceChar: string;
      truncateSuffix: string;
      illegalChars: RegExp;
      reservedNames: readonly string[];
    };
  };
  tools: {
    required: readonly string[];
  };
  download: {
    defaultResolution: "480p" | "720p" | "1080p" | "best";
    defaultAudioFormat: "m4a" | "mp3";
    defaultSubtitleLanguage: string;
  };
  limits: {
    characterLimit: number;
    maxTranscriptLength: number;
  };
  cookies: {
    file?: string;
    fromBrowser?: string;
  };
  network: {
    proxy?: string;
    ignoreConfig: boolean;
  };
}
```

### getGlobalArgs(config: Config): string[]

Returns the yt-dlp arguments applied to every invocation: `--ignore-config`
when `network.ignoreConfig` is set, and `--proxy <url>` when `network.proxy`
is defined. All tools prepend these to their argument list.

### getCookieArgs(config: Config): string[]

Returns `--cookies <file>` or `--cookies-from-browser <browser>` depending on
the cookie configuration. `cookies.file` takes precedence.

For detailed configuration options, see [Configuration Guide](./configuration.md).
