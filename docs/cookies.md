# Cookies Configuration Guide

## Why Do You Need Cookies?

You need to configure cookies for yt-dlp-mcp in the following situations:

- **Access private videos**: Videos that require login to view
- **Age-restricted content**: Content requiring account age verification
- **Bypass CAPTCHA**: Some websites require verification
- **Avoid rate limiting**: Reduce HTTP 429 (Too Many Requests) errors
- **YouTube Premium features**: Access premium-exclusive content and quality

## Configuration Methods

yt-dlp-mcp supports two cookie configuration methods via environment variables.

### Method 1: Extract from Browser (Recommended)

This is the simplest approach. yt-dlp reads cookies directly from your browser.

```bash
YTDLP_COOKIES_FROM_BROWSER=chrome
```

#### Supported Browsers

| Browser | Value |
|---------|-------|
| Google Chrome | `chrome` |
| Chromium | `chromium` |
| Microsoft Edge | `edge` |
| Mozilla Firefox | `firefox` |
| Brave | `brave` |
| Opera | `opera` |
| Safari (macOS) | `safari` |
| Vivaldi | `vivaldi` |
| Whale | `whale` |

#### Advanced Configuration

```bash
# Specify Chrome Profile
YTDLP_COOKIES_FROM_BROWSER=chrome:Profile 1

# Specify Firefox Container
YTDLP_COOKIES_FROM_BROWSER=firefox::work

# Flatpak-installed Chrome (Linux)
YTDLP_COOKIES_FROM_BROWSER=chrome:~/.var/app/com.google.Chrome/

# Full format: BROWSER:PROFILE::CONTAINER
YTDLP_COOKIES_FROM_BROWSER=chrome:Profile 1::personal
```

### Method 2: Use Cookie File

If you prefer using a fixed cookie file, or automatic extraction doesn't work:

```bash
YTDLP_COOKIES_FILE=/path/to/cookies.txt
```

The cookie file must be in Netscape/Mozilla format with the first line:
```
# Netscape HTTP Cookie File
```

## Exporting Cookies

### Using yt-dlp (Recommended)

This is the most reliable method, ensuring correct format:

```bash
# Export from Chrome
yt-dlp --cookies-from-browser chrome --cookies cookies.txt "https://www.youtube.com"

# Export from Firefox
yt-dlp --cookies-from-browser firefox --cookies cookies.txt "https://www.youtube.com"
```

> **Note**: This command exports ALL website cookies from your browser. Keep this file secure.

### Using Browser Extensions

| Browser | Extension |
|---------|-----------|
| Chrome | [Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) |
| Firefox | [cookies.txt](https://addons.mozilla.org/firefox/addon/cookies-txt/) |

> **Warning**: Only use the recommended extensions above. Some cookie export extensions may be malware.

## MCP Configuration Examples

### Claude Desktop

Edit `claude_desktop_config.json`:

**Using Browser Cookies:**
```json
{
  "mcpServers": {
    "yt-dlp": {
      "command": "npx",
      "args": ["@kevinwatt/yt-dlp-mcp"],
      "env": {
        "YTDLP_COOKIES_FROM_BROWSER": "chrome"
      }
    }
  }
}
```

**Using Cookie File:**
```json
{
  "mcpServers": {
    "yt-dlp": {
      "command": "npx",
      "args": ["@kevinwatt/yt-dlp-mcp"],
      "env": {
        "YTDLP_COOKIES_FILE": "/Users/username/.config/yt-dlp/cookies.txt"
      }
    }
  }
}
```

### Configuration File Locations

| OS | Claude Desktop Config Location |
|----|-------------------------------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

## Priority Order

When both `YTDLP_COOKIES_FILE` and `YTDLP_COOKIES_FROM_BROWSER` are set:

1. `YTDLP_COOKIES_FILE` is used first
2. If no file is set, `YTDLP_COOKIES_FROM_BROWSER` is used

## Security Best Practices

### Cookie File Security

1. **Keep it safe**: Cookie files contain your login credentials; leakage may lead to account compromise
2. **Never share**: Never share cookie files with others or upload to public locations
3. **Version control**: Add `cookies.txt` to `.gitignore`
4. **File permissions**:
   ```bash
   chmod 600 cookies.txt  # Owner read/write only
   ```

### Browser Cookie Extraction

- Ensure your browser is up to date
- You may need to close the browser temporarily during extraction
- Some browser security features may block cookie extraction

### Regular Updates

- Browser cookies expire
- Re-export cookies periodically
- If you encounter authentication errors, try updating cookies

## Troubleshooting

### Error: Cookie file not found

```
Error: Cookie file not found: /path/to/cookies.txt
```

**Solutions:**
1. Verify the file path is correct
2. Confirm the file exists
3. Ensure the MCP service has permission to read the file

### Error: Browser cookies could not be loaded

```
Error: Could not load cookies from chrome
```

**Solutions:**
1. Verify browser name spelling is correct
2. Try closing the browser and retry
3. Ensure no multiple browser instances are running
4. Check if browser has password-protected cookie storage

### Error: Invalid cookie file format

```
Error: Invalid cookie file format
```

**Solutions:**
1. Ensure first line is `# Netscape HTTP Cookie File` or `# HTTP Cookie File`
2. Check line ending format (Unix uses LF, Windows uses CRLF)
3. Re-export cookies using yt-dlp

### Still Cannot Access Private Videos

1. **Confirm login**: Verify you're logged in to the video platform in your browser
2. **Refresh page**: Refresh the video page in browser before exporting
3. **Re-export**: Re-export cookies
4. **Check permissions**: Confirm your account has permission to access the video

### HTTP 400: Bad Request

This usually indicates incorrect line ending format in the cookie file.

**Linux/macOS:**
```bash
# Convert to Unix line endings
sed -i 's/\r$//' cookies.txt
```

**Windows:**
Use Notepad++ or VS Code to convert line endings to LF.

## YouTube JavaScript Runtime Requirement

YouTube requires a JavaScript runtime for yt-dlp to function properly. Without it, you may see errors like:

```
WARNING: [youtube] Signature solving failed: Some formats may be missing
ERROR: Requested format is not available
```

### Installing EJS (Recommended)

EJS is a lightweight JavaScript runtime specifically designed for yt-dlp.

**Linux (Debian/Ubuntu):**
```bash
# Install Node.js if not already installed
sudo apt install nodejs

# Install EJS globally
sudo npm install -g @aspect-build/ejs
```

**Linux (Arch):**
```bash
sudo pacman -S nodejs npm
sudo npm install -g @aspect-build/ejs
```

**macOS:**
```bash
brew install node
npm install -g @aspect-build/ejs
```

**Windows:**
```powershell
# Install Node.js from https://nodejs.org/
npm install -g @aspect-build/ejs
```

### Alternative: PhantomJS

If EJS doesn't work, you can try PhantomJS:

**Linux:**
```bash
sudo apt install phantomjs
```

**macOS:**
```bash
brew install phantomjs
```

### Verifying Installation

Test that yt-dlp can use the JavaScript runtime:

```bash
yt-dlp --dump-json "https://www.youtube.com/watch?v=dQw4w9WgXcQ" 2>&1 | head -1
```

If successful, you should see JSON output starting with `{`.

### Additional Dependencies for Cookie Extraction (Linux)

On Linux, cookie extraction from browsers requires the `secretstorage` module:

```bash
python3 -m pip install secretstorage
```

This is needed to decrypt cookies stored by Chromium-based browsers.

## Related Links

- [yt-dlp Cookie FAQ](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp)
- [yt-dlp EJS Wiki](https://github.com/yt-dlp/yt-dlp/wiki/EJS)
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp#readme)
