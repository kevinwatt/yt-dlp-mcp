# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Guidelines

- **Always update CHANGELOG.md** when making changes to the codebase

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
npx @kevinwatt/yt-dlp-mcp  # Start MCP server manually
```

## Code Architecture

### MCP Server Implementation
This is an MCP (Model Context Protocol) server that integrates with `yt-dlp` for video/audio downloading. The server:

- **Entry point**: `src/index.mts` - Main MCP server implementation with tool handlers
- **Modular design**: Each feature lives in `src/modules/` (video.ts, audio.ts, subtitle.ts, search.ts, metadata.ts)
- **Configuration**: `src/config.ts` - Centralized config with environment variable support and validation
- **Utility functions**: `src/modules/utils.ts` - Shared spawn and cleanup utilities

### Tool Architecture
The server exposes 8 MCP tools:
1. `search_videos` - YouTube video search
2. `list_subtitle_languages` - List available subtitles
3. `download_video_subtitles` - Download subtitle files  
4. `download_video` - Download videos with resolution/trimming options
5. `download_audio` - Extract and download audio
6. `download_transcript` - Generate clean text transcripts
7. `get_video_metadata` - Extract comprehensive video metadata (JSON format)
8. `get_video_metadata_summary` - Get human-readable metadata summary

### Key Patterns
- **Unified error handling**: `handleToolExecution()` wrapper for consistent error responses
- **Spawn management**: All external tool calls go through `_spawnPromise()` with cleanup
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

### Testing Setup
- **Jest with ESM**: Custom config for TypeScript + ESM support
- **Test isolation**: Tests run in separate environment with mocked dependencies
- **Coverage**: Tests for each module in `src/__tests__/`

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