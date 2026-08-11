# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.10.0] - 2026-08-11

### Added
- `YTDLP_PROXY` environment variable to route yt-dlp requests through a proxy (`http`, `https`, `socks4`, `socks5`, `socks5h`). An empty value forces a direct connection, overriding a proxy set in the yt-dlp config file
- `YTDLP_IGNORE_CONFIG=1` to opt back into skipping all yt-dlp config files
- `getGlobalArgs()` in `config.ts`, applied by every tool so proxy and config-file behavior stay consistent across all 10 tools

### Changed
- **Breaking**: download, audio, subtitle and transcript tools no longer pass `--ignore-config`, so they now honor the yt-dlp config file (`~/.config/yt-dlp/config`) like the metadata, search and comments tools always did. This restores proxy and cookie configuration for MCP clients that cannot inject environment variables into the server process (#30). `YTDLP_IGNORE_CONFIG=1` disables config files for **all** tools, so it is not a straight revert to 0.9.x behavior
- `ytdlp_download_video` and `ytdlp_download_audio` now report the path yt-dlp emits via `--print after_move:filepath` instead of predicting it with `--get-filename` or reconstructing it. The reported name survives post-processing, `--restrict-filenames` and `--trim-filenames`, and the extra network round-trip per video download is gone
- All tools now pass `--no-download-archive` explicitly, so a `--download-archive` in a user config file cannot silently skip a request. Without this the `--dump-json` tools received empty output and failed to parse it
- Download tools now pass `--no-simulate`, so a `--simulate` in a user config file cannot turn a download into a no-op
- `ytdlp_download_video_subtitles` now pins `--convert-subs vtt`, so a `--convert-subs` in a user config file cannot hide the subtitle files from the tool

### Fixed
- Proxy settings were previously unreachable for the download, audio, subtitle and transcript tools: `--ignore-config` blocked the config file and no proxy option existed (#30)
- README no longer documents `YTDLP_CHARACTER_LIMIT` and `YTDLP_MAX_TRANSCRIPT_LENGTH`. Neither was ever read by `loadEnvConfig()`, so setting them had no effect. The underlying `limits` values keep their defaults (25000 / 50000) and remain configurable by passing a config object when using this package as a library

Thanks to @Pheobe-Southwood (#30) for the detailed report and reproduction.

---

## [0.9.0] - 2026-05-21

### Added
- Thread-aware comments processing with normalized `time_text`, `depth`, `reply_count`, and orphan lifting
- `view` support for `ytdlp_get_video_comments` and `ytdlp_get_video_comments_summary` (`flat` or `threaded`)
- `responseFormat="markdown_tree"` for AI-friendly comment exports with preserved reply structure
- Full YouTube extractor comment tuple support: `maxComments`, `maxParents`, `maxReplies`, `maxRepliesPerThread`, `maxDepth`
- Fixture-based comments test coverage for threaded output, markdown rendering, truncation, and graceful degradation

### Changed
- `ytdlp_get_video_comments` now returns `root_threads`, `reply_comments`, and `orphan_comments` in JSON responses
- Threaded summary rendering now groups replies hierarchically instead of only showing raw parent IDs
- README and API docs now document both comments tools and threaded comment modes

### Fixed
- Comments normalization now preserves numeric comment IDs and numeric parent IDs by coercing them to strings
- `responseFormat="markdown_tree"` now rejects incompatible `view="flat"` requests instead of silently ignoring the view mode

Thanks to @kolotovalexander (#26) for the threaded-comments feature work.

---

## [0.8.5] - 2026-05-19

### Changed
- **SDK Upgrade**: Bumped `@modelcontextprotocol/sdk` from `0.7.0` to `^1.29.0` (major version jump)
- **Migrated to `McpServer` high-level API**: Replaced low-level `Server` + `setRequestHandler` pattern with `McpServer.registerTool()`
  - Removed manual `CallToolRequestSchema` / `ListToolsRequestSchema` handlers
  - Removed hand-rolled tool dispatch switch and per-tool `parse()` calls — SDK now validates inputs against Zod shapes and routes to handlers automatically
  - Tool input schemas now defined as raw Zod shapes (e.g. `{ url: z.string().url() }`) instead of wrapped `z.object().strict()` — SDK converts to proper JSON Schema for the wire format (previously the wire format contained a serialized Zod object, which was not a valid JSON Schema)
  - `handleToolExecution()` wrapper retained for unified error normalization

### Fixed
- Tools/list response now emits valid JSON Schema for each tool's `inputSchema` (previously emitted a serialized Zod object that clients couldn't introspect)

### Documentation
- README and CLAUDE.md now document all 10 registered tools — the `ytdlp_get_video_comments` and `ytdlp_get_video_comments_summary` entries were missing.

---

## [0.8.4] - 2026-01-04

### Fixed
- **Critical**: Added missing process error handler in `_spawnPromise()` to prevent server hang when yt-dlp is not installed or fails to spawn ([#23](https://github.com/kevinwatt/yt-dlp-mcp/issues/23))
- **Critical**: Fixed stdout/stderr mixing in `_spawnPromise()` that caused yt-dlp warnings to corrupt parsed output
- Fixed VERSION constant mismatch (was `0.7.0`, now synced with package.json)
- Added try-catch for RegExp construction from `YTDLP_SANITIZE_ILLEGAL_CHARS` env var to prevent startup crash on invalid regex
- Added validation for `YTDLP_MAX_FILENAME_LENGTH` env var to handle NaN values gracefully
- Fixed test expectations for search output format and metadata `creators` field null handling

### Changed
- **Documentation**: Added warning about JavaScript runtime (deno) requirement when using cookie authentication
  - YouTube authenticated API endpoints require JS challenge solving
  - Without deno, downloads will fail with "n challenge solving failed" error
- **Documentation**: Added version sync guidance to CLAUDE.md (package.json + src/index.mts)

---

## [0.8.3] - 2025-12-25

### Added
- **Video Comments Extraction**: New tools for extracting YouTube video comments
  - `ytdlp_get_video_comments`: Extract comments in structured JSON format with author info, likes, timestamps, and reply threading
  - `ytdlp_get_video_comments_summary`: Get human-readable summary of top comments
  - Supports sorting by "top" (most liked) or "new" (newest first)
  - Configurable comment limit (1-100 comments)
  - Includes author verification status, pinned comments, and uploader replies
  - Comprehensive test suite for comments functionality
- **Upload Date Filter**: New `uploadDateFilter` parameter for `ytdlp_search_videos` tool ([#21](https://github.com/kevinwatt/yt-dlp-mcp/issues/21))
  - Filter search results by upload date: `hour`, `today`, `week`, `month`, `year`
  - Uses YouTube's native date filtering for efficient searches
  - Optional parameter - defaults to no filtering (all dates)

### Changed
- Add Claude Code settings (.claude/, CLAUDE.md) to .gitignore
- Add development guideline to always update CHANGELOG.md
- Move integration test scripts to `tests/` directory for cleaner root
- Comments integration tests are now opt-in via `RUN_INTEGRATION_TESTS=1` env var for CI stability

### Fixed
- Fixed `validateUrl()` return value not being checked in `audio.ts`, `metadata.ts`, and `video.ts`
- Fixed comments test Python environment handling (use `delete` instead of empty string assignment)
- Fixed regex null coalescing in comments test for author matching

---

## [0.7.0] - 2025-10-19

### 🎉 Major Release - MCP Best Practices & Quality Improvements

This release represents a significant upgrade with comprehensive MCP best practices implementation, following the official MCP server development guidelines.

### ✨ Added

#### Tool Naming & Organization
- **Tool Name Prefixes**: All tools now have `ytdlp_` prefix to avoid naming conflicts with other MCP servers
  - `search_videos` → `ytdlp_search_videos`
  - `download_video` → `ytdlp_download_video`
  - `get_video_metadata` → `ytdlp_get_video_metadata`
  - And all other tools similarly prefixed

#### Input Validation
- **Zod Schema Validation**: Implemented runtime input validation for all 8 tools
  - URL validation with proper format checking
  - String length constraints (min/max)
  - Number range validation
  - Regex patterns for language codes and time formats
  - Enum validation for resolution and format options
  - `.strict()` mode to prevent unexpected fields

#### Tool Annotations
- **MCP Tool Hints**: Added comprehensive annotations to all tools
  - `readOnlyHint: true` for read-only operations (search, list, get)
  - `readOnlyHint: false` for file-creating operations (downloads)
  - `destructiveHint: false` for all tools (no destructive updates)
  - `idempotentHint: true/false` based on operation type
  - `openWorldHint: true` for all tools (external API interactions)

#### Response Formats
- **Flexible Output Formats**: Added `response_format` parameter to search tools
  - JSON format: Structured data for programmatic processing
  - Markdown format: Human-readable display (default)
  - Both formats include pagination metadata

#### Pagination Support
- **Search Pagination**: Added offset parameter to `ytdlp_search_videos`
  - `offset` parameter for skipping results
  - `has_more` indicator in responses
  - `next_offset` for easy pagination
  - Works with both JSON and Markdown formats

#### Character Limits & Truncation
- **Response Size Protection**: Implemented character limits to prevent context overflow
  - Standard limit: 25,000 characters
  - Transcript limit: 50,000 characters (larger for text content)
  - Automatic truncation with clear messages
  - Smart truncation that preserves JSON validity

#### Error Messages
- **Actionable Error Guidance**: Improved error messages across all modules
  - Platform-specific errors (Unsupported URL, Video unavailable, etc.)
  - Network error guidance with retry suggestions
  - Language availability hints (e.g., "Use ytdlp_list_subtitle_languages to check options")
  - Rate limit handling with wait time suggestions

### 🔧 Improved

#### Tool Descriptions
- **Comprehensive Documentation**: Enhanced all tool descriptions with:
  - Clear purpose statements
  - Detailed parameter descriptions with examples
  - Complete return value schemas
  - "Use when" / "Don't use when" guidance
  - Error handling documentation
  - Example use cases

#### Configuration
- **Enhanced Config System**: Added new configuration options
  - `limits.characterLimit`: Maximum response size (25,000)
  - `limits.maxTranscriptLength`: Maximum transcript size (50,000)
  - Environment variable support for all settings

#### Code Quality
- **Better Type Safety**: Improved TypeScript types throughout
  - Proper type definitions for metadata with truncation fields
  - Explicit Promise return types
  - Better error type handling

### 🐛 Fixed

- **JSON Parsing Issue**: Fixed metadata truncation that was breaking JSON format
  - Truncation messages now inside JSON objects instead of appended
  - Prevents "Unexpected non-whitespace character" errors
  - Maintains valid JSON structure even when truncated

### 🧪 Testing

- **Real-World Validation**: Comprehensive testing with actual videos
  - ✅ YouTube platform fully tested (Rick Astley - Never Gonna Give You Up)
  - ✅ Bilibili platform fully tested (Chinese content)
  - ✅ Multi-language support verified (English, Chinese)
  - ✅ All 8 tools tested with real API calls
  - ✅ MCP protocol compatibility verified

### 📖 Documentation

- **Enhanced README**: Completely redesigned README.md with:
  - Professional badges and visual formatting
  - Comprehensive feature tables
  - Detailed tool documentation
  - Usage examples by category
  - Configuration guide
  - Architecture overview
  - Multi-language support demonstration

### 🌍 Platform Support

- **Verified Platforms**:
  - ✅ YouTube (fully tested)
  - ✅ Bilibili (哔哩哔哩) (fully tested)
  - 🎯 1000+ other platforms supported via yt-dlp

### 📊 Statistics

- 8 tools with complete Zod validation
- 8 tools with proper annotations
- 8 tools with comprehensive descriptions
- 2 platforms tested and verified
- 5/5 YouTube tests passing
- 3/3 Bilibili tests passing
- 0 critical bugs remaining

### 🔄 Migration Guide

If upgrading from 0.6.x:

1. **Tool Names**: Update all tool names to include `ytdlp_` prefix
   ```diff
   - "search_videos"
   + "ytdlp_search_videos"
   ```

2. **Search Parameters**: New optional parameters available
   ```javascript
   {
     query: "tutorial",
     maxResults: 10,
     offset: 0,              // NEW: pagination support
     response_format: "json" // NEW: format control
   }
   ```

3. **Error Handling**: Error messages are more descriptive now
   - Update any error parsing logic to handle new formats

### 🙏 Acknowledgments

This release follows the [MCP Server Development Best Practices](https://modelcontextprotocol.io) and incorporates feedback from the MCP community.

---

## [0.6.28] - 2025-08-13

### Added
- Video metadata extraction with `get_video_metadata` and `get_video_metadata_summary`
- Comprehensive test suite
- API documentation

### Changed
- Improved metadata extraction performance
- Updated dependencies

### Fixed
- Various bug fixes and stability improvements

---

## [0.6.0] - 2025-08-01

### Added
- Initial MCP server implementation
- YouTube video search functionality
- Video download with resolution control
- Audio extraction
- Subtitle download and transcript generation
- Integration with yt-dlp

### Features
- 8 core tools for video content management
- Support for multiple video platforms
- Configurable downloads directory
- Automatic filename sanitization
- Cross-platform compatibility (Windows, macOS, Linux)

---

[0.7.0]: https://github.com/kevinwatt/yt-dlp-mcp/compare/v0.6.28...v0.7.0
[0.6.28]: https://github.com/kevinwatt/yt-dlp-mcp/compare/v0.6.0...v0.6.28
[0.6.0]: https://github.com/kevinwatt/yt-dlp-mcp/releases/tag/v0.6.0
