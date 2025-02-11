# YouTube MCP Server

Uses `yt-dlp` to download YouTube content and connects it to LLMs via [Model Context Protocol](https://modelcontextprotocol.io/introduction). 

<a href="https://glama.ai/mcp/servers/0nvr1xbmpk"><img width="380" height="200" src="https://glama.ai/mcp/servers/0nvr1xbmpk/badge" alt="YouTube Server MCP server" /></a>

## Features

- Download YouTube subtitles (SRT format) for LLMs to read
- Download YouTube videos to your Downloads folder
- Integrates with Dive and other MCP-compatible LLMs

## Installation

1. Install `yt-dlp` (Pip, Homebrew and WinGet both work great here)

yt-dlp-mcp requires the yt-dlp package. Install it based on your operating system:

Windows
```bash
winget install yt-dlp
```
MacOS
```bash
brew install yt-dlp
```
Linux
```bash
pip install yt-dlp
```

2. Install this via [dive](https://github.com/OpenAgentPlatform/Dive):
```json
{
  "mcpServers": {
    "yt-dlp-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@kevinwatt/yt-dlp-mcp"
      ]
    }
  }
}
```

## Usage Examples

Ask your LLM to:
- "Summarize the YouTube video <<URL>>"
- "Download this YouTube video: <<URL>>"

## Manual Start

If needed, you can start the server manually:
```bash
yt-dlp-mcp
```

## Requirements

- `yt-dlp` installed and in PATH
- Node.js 20+
- MCP-compatible LLM service

