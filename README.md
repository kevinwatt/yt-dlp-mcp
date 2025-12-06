# 🎬 yt-dlp-mcp

<div align="center">

**A powerful MCP server that brings video platform capabilities to your AI agents**

[![npm version](https://img.shields.io/npm/v/@kevinwatt/yt-dlp-mcp.svg)](https://www.npmjs.com/package/@kevinwatt/yt-dlp-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)

Integrate yt-dlp with Claude, Dive, and other MCP-compatible AI systems. Download videos, extract metadata, get transcripts, and more — all through natural language.

[Features](#-features) • [Installation](#-installation) • [Tools](#-available-tools) • [Usage](#-usage-examples) • [Documentation](#-documentation)

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔍 **Search & Discovery**
- Search YouTube with pagination
- JSON or Markdown output formats
- Filter by relevance and quality

### 📊 **Metadata Extraction**
- Comprehensive video information
- Channel details and statistics
- Upload dates, tags, categories
- No content download required

### 📝 **Transcript & Subtitles**
- Download subtitles in VTT format
- Generate clean text transcripts
- Multi-language support
- Auto-generated captions

</td>
<td width="50%">

### 🎥 **Video Downloads**
- Resolution control (480p-1080p)
- Video trimming support
- Platform-agnostic (YouTube, Facebook, etc.)
- Saved to Downloads folder

### 🎵 **Audio Extraction**
- Best quality audio (M4A/MP3)
- Direct audio-only downloads
- Perfect for podcasts & music

### 🛡️ **Privacy & Safety**
- No tracking or analytics
- Direct downloads via yt-dlp
- Zod schema validation
- Character limits for LLM safety

</td>
</tr>
</table>

---

## 🚀 Installation

### Prerequisites

**Install yt-dlp** on your system:

<table>
<tr>
<th>Platform</th>
<th>Command</th>
</tr>
<tr>
<td>🪟 <strong>Windows</strong></td>
<td><code>winget install yt-dlp</code></td>
</tr>
<tr>
<td>🍎 <strong>macOS</strong></td>
<td><code>brew install yt-dlp</code></td>
</tr>
<tr>
<td>🐧 <strong>Linux</strong></td>
<td><code>pip install yt-dlp</code></td>
</tr>
</table>

### Quick Setup with Dive Desktop

1. Open [Dive Desktop](https://github.com/OpenAgentPlatform/Dive)
2. Click **"+ Add MCP Server"**
3. Paste this configuration:

```json
{
  "mcpServers": {
    "yt-dlp": {
      "command": "npx",
      "args": ["-y", "@kevinwatt/yt-dlp-mcp"]
    }
  }
}
```

4. Click **"Save"** and you're ready! 🎉

### Manual Installation

```bash
npm install -g @kevinwatt/yt-dlp-mcp
```

---

## 🛠️ Available Tools

All tools are prefixed with `ytdlp_` to avoid naming conflicts with other MCP servers.

### 🔍 Search & Discovery

<table>
<tr>
<th width="30%">Tool</th>
<th width="70%">Description</th>
</tr>
<tr>
<td><code>ytdlp_search_videos</code></td>
<td>

Search YouTube with pagination support
- **Parameters**: `query`, `maxResults`, `offset`, `response_format`
- **Returns**: Video list with titles, channels, durations, URLs
- **Supports**: JSON and Markdown formats

</td>
</tr>
</table>

### 📝 Subtitles & Transcripts

<table>
<tr>
<th width="30%">Tool</th>
<th width="70%">Description</th>
</tr>
<tr>
<td><code>ytdlp_list_subtitle_languages</code></td>
<td>

List all available subtitle languages for a video
- **Parameters**: `url`
- **Returns**: Available languages, formats, auto-generated status

</td>
</tr>
<tr>
<td><code>ytdlp_download_video_subtitles</code></td>
<td>

Download subtitles in VTT format with timestamps
- **Parameters**: `url`, `language` (optional)
- **Returns**: Raw VTT subtitle content

</td>
</tr>
<tr>
<td><code>ytdlp_download_transcript</code></td>
<td>

Generate clean plain text transcript
- **Parameters**: `url`, `language` (optional)
- **Returns**: Cleaned text without timestamps or formatting

</td>
</tr>
</table>

### 🎥 Video & Audio Downloads

<table>
<tr>
<th width="30%">Tool</th>
<th width="70%">Description</th>
</tr>
<tr>
<td><code>ytdlp_download_video</code></td>
<td>

Download video to Downloads folder
- **Parameters**: `url`, `resolution`, `startTime`, `endTime`
- **Resolutions**: 480p, 720p, 1080p, best
- **Supports**: Video trimming

</td>
</tr>
<tr>
<td><code>ytdlp_download_audio</code></td>
<td>

Extract and download audio only
- **Parameters**: `url`
- **Format**: Best quality M4A/MP3

</td>
</tr>
</table>

### 📊 Metadata

<table>
<tr>
<th width="30%">Tool</th>
<th width="70%">Description</th>
</tr>
<tr>
<td><code>ytdlp_get_video_metadata</code></td>
<td>

Extract comprehensive video metadata in JSON
- **Parameters**: `url`, `fields` (optional array)
- **Returns**: Complete metadata or filtered fields
- **Includes**: Views, likes, upload date, tags, formats, etc.

</td>
</tr>
<tr>
<td><code>ytdlp_get_video_metadata_summary</code></td>
<td>

Get human-readable metadata summary
- **Parameters**: `url`
- **Returns**: Formatted text with key information

</td>
</tr>
</table>

---

## 💡 Usage Examples

### Search Videos

```
"Search for Python programming tutorials"
"Find the top 20 machine learning videos"
"Search for 'react hooks tutorial' and show results 10-20"
"Search for JavaScript courses in JSON format"
```

### Get Metadata

```
"Get metadata for https://youtube.com/watch?v=..."
"Show me the title, channel, and view count for this video"
"Extract just the duration and upload date"
"Give me a quick summary of this video's info"
```

### Download Subtitles & Transcripts

```
"List available subtitles for https://youtube.com/watch?v=..."
"Download English subtitles from this video"
"Get a clean transcript of this video in Spanish"
"Download Chinese (zh-Hant) transcript"
```

### Download Content

```
"Download this video in 1080p: https://youtube.com/watch?v=..."
"Download audio from this YouTube video"
"Download this video from 1:30 to 2:45"
"Save this Facebook video to my Downloads"
```

---

## 📖 Documentation

- **[API Reference](./docs/api.md)** - Detailed tool documentation
- **[Configuration](./docs/configuration.md)** - Environment variables and settings
- **[Cookie Configuration](./docs/cookies.md)** - Authentication and private video access
- **[Error Handling](./docs/error-handling.md)** - Common errors and solutions
- **[Contributing](./docs/contributing.md)** - How to contribute

---

## 🔧 Configuration

### Environment Variables

```bash
# Downloads directory (default: ~/Downloads)
YTDLP_DOWNLOADS_DIR=/path/to/downloads

# Default resolution (default: 720p)
YTDLP_DEFAULT_RESOLUTION=1080p

# Default subtitle language (default: en)
YTDLP_DEFAULT_SUBTITLE_LANG=en

# Character limit (default: 25000)
YTDLP_CHARACTER_LIMIT=25000

# Max transcript length (default: 50000)
YTDLP_MAX_TRANSCRIPT_LENGTH=50000
```

### Cookie Configuration

To access private videos, age-restricted content, or avoid rate limits, configure cookies:

```bash
# Extract cookies from browser (recommended)
YTDLP_COOKIES_FROM_BROWSER=chrome

# Or use a cookie file
YTDLP_COOKIES_FILE=/path/to/cookies.txt
```

**MCP Configuration with cookies:**

```json
{
  "mcpServers": {
    "yt-dlp": {
      "command": "npx",
      "args": ["-y", "@kevinwatt/yt-dlp-mcp"],
      "env": {
        "YTDLP_COOKIES_FROM_BROWSER": "chrome"
      }
    }
  }
}
```

Supported browsers: `brave`, `chrome`, `chromium`, `edge`, `firefox`, `opera`, `safari`, `vivaldi`, `whale`

See [Cookie Configuration Guide](./docs/cookies.md) for detailed setup instructions.

---

## 🏗️ Architecture

### Built With

- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** - Video extraction engine
- **[MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)** - Model Context Protocol
- **[Zod](https://github.com/colinhacks/zod)** - TypeScript-first schema validation
- **TypeScript** - Type safety and developer experience

### Key Features

- ✅ **Type-Safe**: Full TypeScript with strict mode
- ✅ **Validated Inputs**: Zod schemas for runtime validation
- ✅ **Character Limits**: Automatic truncation to prevent context overflow
- ✅ **Tool Annotations**: readOnly, destructive, idempotent hints
- ✅ **Error Guidance**: Actionable error messages for LLMs
- ✅ **Modular Design**: Clean separation of concerns

---

## 📊 Response Formats

### JSON Format
Perfect for programmatic processing:
```json
{
  "total": 50,
  "count": 10,
  "offset": 0,
  "videos": [...],
  "has_more": true,
  "next_offset": 10
}
```

### Markdown Format
Human-readable display:
```markdown
Found 50 videos (showing 10):

1. **Video Title**
   📺 Channel: Creator Name
   ⏱️  Duration: 10:30
   🔗 URL: https://...
```

---

## 🔒 Privacy & Security

- **No Tracking**: Direct downloads, no analytics
- **Input Validation**: Zod schemas prevent injection
- **URL Validation**: Strict URL format checking
- **Character Limits**: Prevents context overflow attacks
- **Read-Only by Default**: Most tools don't modify system state

---

## 🤝 Contributing

Contributions are welcome! Please check out our [Contributing Guide](./docs/contributing.md).

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - The amazing video extraction tool
- [Anthropic](https://www.anthropic.com/) - For the Model Context Protocol
- [Dive](https://github.com/OpenAgentPlatform/Dive) - MCP-compatible AI platform

---

## 📚 Related Projects

- [MCP Servers](https://github.com/modelcontextprotocol/servers) - Official MCP server implementations
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - Command-line video downloader
- [Dive Desktop](https://github.com/OpenAgentPlatform/Dive) - AI agent platform

---

<div align="center">

[⬆ Back to Top](#-yt-dlp-mcp)

</div>
