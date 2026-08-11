# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Guidelines

- **Always update CHANGELOG.md** when making changes to the codebase
- **Version updates require TWO files**:
  1. `package.json` - line 3: `"version": "x.x.x"`
  2. `src/index.mts` - line 24: `const VERSION = 'x.x.x'`

## Development Commands

### Build and Prepare
```bash
npm run prepare  # Compile TypeScript and make binary executable
```

### Testing
```bash
npm test  # Run Jest tests with ESM support
```

### Manual Testing
```bash
node ./lib/index.mjs  # Start local built MCP server manually
```

## Code Architecture

### MCP Server Implementation
This is an MCP (Model Context Protocol) server that integrates with `yt-dlp` for video/audio downloading. The server:

- **Entry point**: `src/index.mts` - Main MCP server implementation with tool handlers
- **Modular design**: Each feature lives in `src/modules/` (video.ts, audio.ts, subtitle.ts, search.ts, metadata.ts, comments.ts)
- **Configuration**: `src/config.ts` - Centralized config with environment variable support and validation
- **Utility functions**: `src/modules/utils.ts` - Shared spawn and cleanup utilities

### Tool Architecture
The server exposes 10 MCP tools (all prefixed with `ytdlp_` in the protocol layer):
1. `search_videos` - YouTube video search
2. `list_subtitle_languages` - List available subtitles
3. `download_video_subtitles` - Download subtitle files
4. `download_video` - Download videos with resolution/trimming options
5. `download_audio` - Extract and download audio
6. `download_transcript` - Generate clean text transcripts
7. `get_video_metadata` - Extract comprehensive video metadata (JSON format)
8. `get_video_metadata_summary` - Get human-readable metadata summary
9. `get_video_comments` - Extract comments as flat JSON, threaded JSON, or AI-friendly Markdown
10. `get_video_comments_summary` - Get human-readable flat or threaded comment summaries

### Comments Architecture
The comments flow is split into small modules:
- `src/modules/comments.ts` - yt-dlp orchestration, metadata parsing, and error mapping
- `src/modules/comments-types.ts` - Shared comment/request/response types and extractor arg builder
- `src/modules/comments-prepare.ts` - Normalization, deduplication, orphan lifting, and thread reconstruction
- `src/modules/comments-render.ts` - JSON/Markdown rendering and whole-unit truncation
- `src/modules/comments-summary.ts` - Flat/threaded summary formatting
- `src/modules/comments-core.ts` - Re-export facade used by tests and callers

Important comments behavior:
- Preserve backward-compatible default behavior: `view="flat"` and `responseFormat="json"`
- Normalize `time_text` from `comment.time_text ?? comment._time_text ?? null`
- Treat missing/self-referential parents as orphans and lift them to `root`
- For unsupported platforms without parent metadata, threaded mode degrades to root-only comments
- Character-limit truncation must remove whole comments/threads, never cut inside an object or markdown block

### Comments Tool Parameters
`ytdlp_get_video_comments` supports:
- `url`
- `maxComments`
- `sortOrder`
- `view`: `flat | threaded`
- `responseFormat`: `json | markdown_tree`
- `maxParents`
- `maxReplies`
- `maxRepliesPerThread`
- `maxDepth`

`ytdlp_get_video_comments_summary` supports:
- `url`
- `maxComments`
- `view`: `flat | threaded`

### Key Patterns
- **Unified error handling**: `handleToolExecution()` wrapper for consistent error responses
- **Spawn management**: All external tool calls go through `_spawnPromise()` with cleanup
- **Global yt-dlp args**: Every invocation prepends `getGlobalArgs(config)` (proxy + config-file handling) — see "yt-dlp Config File Behavior" below
- **Configuration-driven**: All defaults and behavior configurable via environment variables
- **ESM modules**: Uses `.mts` extension and ESM imports throughout
- **Filename sanitization**: Cross-platform safe filename handling with length limits
- **Metadata extraction**: Uses `yt-dlp --dump-json` for comprehensive video information without downloading content

### Dependencies
- **Required external**: `yt-dlp` must be installed and in PATH
- **Core MCP**: `@modelcontextprotocol/sdk` for server implementation
- **Process management**: `spawn-rx` for async process spawning
- **File operations**: `rimraf` for cleanup

### Configuration System
`CONFIG` object loaded from `config.ts` supports:
- Download directory customization (defaults to ~/Downloads)
- Resolution/format preferences
- Filename sanitization rules
- Temporary directory management
- Environment variable overrides (YTDLP_* prefix)
- Proxy passthrough (`YTDLP_PROXY`) and yt-dlp config-file behavior (`YTDLP_IGNORE_CONFIG`)

### yt-dlp Config File Behavior
Every tool prepends `getGlobalArgs(config)` to its yt-dlp arguments. Keep this
invariant when adding tools — it is what makes proxy handling uniform.

- Tools do **not** pass `--ignore-config` by default, so the user's yt-dlp
  config file (`~/.config/yt-dlp/config`) is honored. Some MCP clients cannot
  inject env vars into the server process, making that file their only way to
  configure a proxy or cookies (#30).
- Because a user config file can rewrite output paths, filenames and
  extensions, download tools must let yt-dlp **report** the produced file
  rather than predict or reconstruct it. `video.ts` and `audio.ts` pass
  `--no-simulate --print after_move:filepath` and parse the result via
  `resolveDownloadedFile()` in `utils.ts`. Do not reintroduce
  `--get-filename` (it ignores post-processing extension changes) and do not
  rely on matching the timestamp (`--trim-filenames` and a small
  `YTDLP_MAX_FILENAME_LENGTH` both destroy it).
- Tools that locate files by extension must pin that extension on the command
  line (e.g. `--convert-subs vtt` in `downloadSubtitles`), since CLI args
  override config-file args.
- **All** tools pass `--no-download-archive`. A user's `--download-archive`
  otherwise suppresses the entry entirely — for the `--dump-json` tools that
  means empty stdout and a JSON parse failure, not just a skipped download.
- Download tools also pass `--no-simulate`, which both enables `--print` and
  neutralizes a `--simulate` in the user's config file.

### Testing Setup
- **Jest with ESM**: Custom config for TypeScript + ESM support
- **Test isolation**: Tests run in separate environment with mocked dependencies
- **Coverage**: Tests for each module in `src/__tests__/`
- **Comments tests**: `src/__tests__/comments.test.ts` is fixture-based by default; live YouTube checks remain opt-in via `RUN_INTEGRATION_TESTS=1`

### TypeScript Configuration
- **Strict mode**: All strict TypeScript checks enabled
- **ES2020 target**: Modern JavaScript features
- **Declaration generation**: Types exported to `lib/` for consumption
- **Source maps**: Enabled for debugging

### Build Output
- **Compiled code**: `lib/` directory with .js, .d.ts, and .map files
- **Executable**: `lib/index.mjs` with shebang for direct execution
- **Module structure**: Preserves source module organization

## Metadata Module Details

### VideoMetadata Interface
The `metadata.ts` module exports a comprehensive `VideoMetadata` interface containing fields like:
- Basic info: `id`, `title`, `description`, `duration`, `upload_date`
- Channel info: `channel`, `channel_id`, `channel_url`, `uploader`
- Analytics: `view_count`, `like_count`, `comment_count`
- Technical: `formats`, `thumbnails`, `subtitles`
- Content: `tags`, `categories`, `series`, `episode` data

### Key Functions
- `getVideoMetadata(url, fields?, config?)` - Extract full or filtered metadata as JSON
- `getVideoMetadataSummary(url, config?)` - Generate human-readable summary

### Testing
Comprehensive test suite in `src/__tests__/metadata.test.ts` covers:
- Field filtering and extraction
- Error handling for invalid URLs
- Format validation
- Real-world integration with YouTube videos

## Comments Module Details

### Key Functions
- `getVideoComments(url, maxComments?, sortOrder?, config?, options?)`
  - Returns flat JSON by default
  - Supports `view="threaded"` for nested reply trees
  - Supports `responseFormat="markdown_tree"` for AI-friendly thread exports
- `getVideoCommentsSummary(url, maxComments?, config?, options?)`
  - Supports `view="flat"` and `view="threaded"`

### Response Notes
- Flat JSON returns `comments: NormalizedComment[]`
- Threaded JSON returns `comments: ThreadedComment[]`
- Both JSON modes add `root_threads`, `reply_comments`, `orphan_comments`
- Markdown mode is optimized for LLM consumption with `## Thread N` blocks and explicit `parent_id`, `depth`, and `reply_count`
