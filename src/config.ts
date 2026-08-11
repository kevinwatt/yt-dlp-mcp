import * as os from "os";
import * as path from "path";
import * as fs from "fs";

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Valid browser names for cookie extraction
 */
export const VALID_BROWSERS = [
  'brave', 'chrome', 'chromium', 'edge',
  'firefox', 'opera', 'safari', 'vivaldi', 'whale'
] as const;

export type ValidBrowser = typeof VALID_BROWSERS[number];

/**
 * Configuration type definitions
 */
export interface Config {
  // File-related configuration
  file: {
    maxFilenameLength: number;
    downloadsDir: string;
    tempDirPrefix: string;
    // Filename processing configuration
    sanitize: {
      // Character to replace illegal characters
      replaceChar: string;
      // Suffix when truncating filenames
      truncateSuffix: string;
      // Regular expression for illegal characters
      illegalChars: RegExp;
      // List of reserved names
      reservedNames: readonly string[];
    };
  };
  // Tool-related configuration
  tools: {
    required: readonly string[];
  };
  // Download-related configuration
  download: {
    defaultResolution: "480p" | "720p" | "1080p" | "best";
    defaultAudioFormat: "m4a" | "mp3";
    defaultSubtitleLanguage: string;
  };
  // Response limits
  limits: {
    characterLimit: number;
    maxTranscriptLength: number;
  };
  // Cookie configuration for authenticated access
  cookies: {
    // Path to Netscape format cookie file
    file?: string;
    // Browser name and settings (format: BROWSER[:PROFILE][::CONTAINER])
    fromBrowser?: string;
  };
  // Network and yt-dlp config-file behavior
  network: {
    // Proxy URL passed through to yt-dlp (e.g. socks5://127.0.0.1:1080)
    proxy?: string;
    // When true, pass --ignore-config so yt-dlp skips all config files.
    // Defaults to false so users can configure proxy/cookies via
    // ~/.config/yt-dlp/config, which is the only channel available to
    // clients that cannot inject env vars into the MCP server process.
    ignoreConfig: boolean;
  };
}

/**
 * Default configuration
 */
const defaultConfig: Config = {
  file: {
    maxFilenameLength: 50,
    downloadsDir: path.join(os.homedir(), "Downloads"),
    tempDirPrefix: "ytdlp-",
    sanitize: {
      replaceChar: '_',
      truncateSuffix: '...',
      illegalChars: /[<>:"/\\|?*\x00-\x1F]/g,  // Windows illegal characters
      reservedNames: [
        'CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4',
        'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2',
        'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
      ]
    }
  },
  tools: {
    required: ['yt-dlp']
  },
  download: {
    defaultResolution: "720p",
    defaultAudioFormat: "m4a",
    defaultSubtitleLanguage: "en"
  },
  limits: {
    characterLimit: 25000,      // Standard MCP character limit
    maxTranscriptLength: 50000  // Transcripts can be larger
  },
  cookies: {
    file: undefined,
    fromBrowser: undefined
  },
  network: {
    proxy: undefined,
    ignoreConfig: false
  }
};

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(): DeepPartial<Config> {
  const envConfig: DeepPartial<Config> = {};

  // File configuration
  const fileConfig: DeepPartial<Config['file']> = {
    sanitize: {
      replaceChar: process.env.YTDLP_SANITIZE_REPLACE_CHAR,
      truncateSuffix: process.env.YTDLP_SANITIZE_TRUNCATE_SUFFIX,
      illegalChars: (() => {
        if (!process.env.YTDLP_SANITIZE_ILLEGAL_CHARS) return undefined;
        try {
          return new RegExp(process.env.YTDLP_SANITIZE_ILLEGAL_CHARS);
        } catch {
          console.warn('[yt-dlp-mcp] Invalid regex in YTDLP_SANITIZE_ILLEGAL_CHARS, using default');
          return undefined;
        }
      })(),
      reservedNames: process.env.YTDLP_SANITIZE_RESERVED_NAMES?.split(',')
    }
  };

  if (process.env.YTDLP_MAX_FILENAME_LENGTH) {
    const parsed = parseInt(process.env.YTDLP_MAX_FILENAME_LENGTH, 10);
    if (!isNaN(parsed) && parsed >= 5) {
      fileConfig.maxFilenameLength = parsed;
    } else {
      console.warn('[yt-dlp-mcp] Invalid YTDLP_MAX_FILENAME_LENGTH, using default');
    }
  }
  if (process.env.YTDLP_DOWNLOADS_DIR) {
    fileConfig.downloadsDir = process.env.YTDLP_DOWNLOADS_DIR;
  }
  if (process.env.YTDLP_TEMP_DIR_PREFIX) {
    fileConfig.tempDirPrefix = process.env.YTDLP_TEMP_DIR_PREFIX;
  }

  if (Object.keys(fileConfig).length > 0) {
    envConfig.file = fileConfig;
  }

  // Download configuration
  const downloadConfig: Partial<Config['download']> = {};
  if (process.env.YTDLP_DEFAULT_RESOLUTION && 
      ['480p', '720p', '1080p', 'best'].includes(process.env.YTDLP_DEFAULT_RESOLUTION)) {
    downloadConfig.defaultResolution = process.env.YTDLP_DEFAULT_RESOLUTION as Config['download']['defaultResolution'];
  }
  if (process.env.YTDLP_DEFAULT_AUDIO_FORMAT && 
      ['m4a', 'mp3'].includes(process.env.YTDLP_DEFAULT_AUDIO_FORMAT)) {
    downloadConfig.defaultAudioFormat = process.env.YTDLP_DEFAULT_AUDIO_FORMAT as Config['download']['defaultAudioFormat'];
  }
  if (process.env.YTDLP_DEFAULT_SUBTITLE_LANG) {
    downloadConfig.defaultSubtitleLanguage = process.env.YTDLP_DEFAULT_SUBTITLE_LANG;
  }
  if (Object.keys(downloadConfig).length > 0) {
    envConfig.download = downloadConfig;
  }

  // Cookie configuration
  const cookiesConfig: Partial<Config['cookies']> = {};
  if (process.env.YTDLP_COOKIES_FILE) {
    cookiesConfig.file = process.env.YTDLP_COOKIES_FILE;
  }
  if (process.env.YTDLP_COOKIES_FROM_BROWSER) {
    cookiesConfig.fromBrowser = process.env.YTDLP_COOKIES_FROM_BROWSER;
  }
  if (Object.keys(cookiesConfig).length > 0) {
    envConfig.cookies = cookiesConfig;
  }

  // Network configuration
  const networkConfig: Partial<Config['network']> = {};
  // !== undefined, not truthiness: YTDLP_PROXY="" is a meaningful value that
  // forces a direct connection, overriding any proxy in the yt-dlp config file.
  if (process.env.YTDLP_PROXY !== undefined) {
    networkConfig.proxy = process.env.YTDLP_PROXY;
  }
  if (process.env.YTDLP_IGNORE_CONFIG) {
    networkConfig.ignoreConfig = parseBooleanEnv(process.env.YTDLP_IGNORE_CONFIG);
  }
  if (Object.keys(networkConfig).length > 0) {
    envConfig.network = networkConfig;
  }

  return envConfig;
}

/**
 * Parse a boolean-ish environment variable.
 * Accepts 1/true/yes/on (case-insensitive) as true; everything else is false.
 */
function parseBooleanEnv(value: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

/**
 * Validate configuration
 */
function validateConfig(config: Config): void {
  // Validate filename length
  if (config.file.maxFilenameLength < 5) {
    throw new Error('maxFilenameLength must be at least 5');
  }

  // Validate downloads directory
  if (!config.file.downloadsDir) {
    throw new Error('downloadsDir must be specified');
  }

  // Validate temporary directory prefix
  if (!config.file.tempDirPrefix) {
    throw new Error('tempDirPrefix must be specified');
  }

  // Validate default resolution
  if (!['480p', '720p', '1080p', 'best'].includes(config.download.defaultResolution)) {
    throw new Error('Invalid defaultResolution');
  }

  // Validate default audio format
  if (!['m4a', 'mp3'].includes(config.download.defaultAudioFormat)) {
    throw new Error('Invalid defaultAudioFormat');
  }

  // Validate default subtitle language
  if (!/^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/i.test(config.download.defaultSubtitleLanguage)) {
    throw new Error('Invalid defaultSubtitleLanguage');
  }

  // Validate cookies (lenient - warnings only)
  validateCookiesConfig(config);

  // Validate network settings (lenient - warnings only)
  validateNetworkConfig(config);
}

/**
 * Validate network configuration (lenient - logs warnings but doesn't throw)
 */
function validateNetworkConfig(config: Config): void {
  if (!config.network) {
    return;
  }

  const proxy = config.network.proxy;
  if (proxy === undefined) {
    return;
  }

  // yt-dlp treats an empty --proxy value as "force a direct connection",
  // so an empty string is meaningful and must be preserved as-is.
  if (proxy === '') {
    return;
  }

  if (!/^(https?|socks[45]|socks5h):\/\//i.test(proxy)) {
    console.warn(
      `[yt-dlp-mcp] Invalid proxy URL: ${proxy}. Expected a scheme like http://, https://, socks4://, socks5:// or socks5h://. Continuing without proxy.`
    );
    config.network.proxy = undefined;
  }
}

/**
 * Validate cookie configuration (lenient - logs warnings but doesn't throw)
 */
function validateCookiesConfig(config: Config): void {
  // Validate cookie file path
  if (config.cookies.file) {
    if (!fs.existsSync(config.cookies.file)) {
      console.warn(`[yt-dlp-mcp] Cookie file not found: ${config.cookies.file}, continuing without cookies`);
      config.cookies.file = undefined;
    }
  }

  // Validate browser name only
  // Format: BROWSER[:PROFILE_OR_PATH][::CONTAINER]
  // We only validate browser name; yt-dlp will validate path/container
  if (config.cookies.fromBrowser) {
    const browserName = config.cookies.fromBrowser.split(':')[0].toLowerCase();

    if (!VALID_BROWSERS.includes(browserName as ValidBrowser)) {
      console.warn(`[yt-dlp-mcp] Invalid browser name: ${browserName}. Valid browsers: ${VALID_BROWSERS.join(', ')}`);
      config.cookies.fromBrowser = undefined;
    }
  }
}

/**
 * Merge configuration
 */
function mergeConfig(base: Config, override: DeepPartial<Config>): Config {
  return {
    file: {
      maxFilenameLength: override.file?.maxFilenameLength || base.file.maxFilenameLength,
      downloadsDir: override.file?.downloadsDir || base.file.downloadsDir,
      tempDirPrefix: override.file?.tempDirPrefix || base.file.tempDirPrefix,
      sanitize: {
        replaceChar: override.file?.sanitize?.replaceChar || base.file.sanitize.replaceChar,
        truncateSuffix: override.file?.sanitize?.truncateSuffix || base.file.sanitize.truncateSuffix,
        illegalChars: (override.file?.sanitize?.illegalChars || base.file.sanitize.illegalChars) as RegExp,
        reservedNames: (override.file?.sanitize?.reservedNames || base.file.sanitize.reservedNames) as readonly string[]
      }
    },
    tools: {
      required: (override.tools?.required || base.tools.required) as readonly string[]
    },
    download: {
      defaultResolution: override.download?.defaultResolution || base.download.defaultResolution,
      defaultAudioFormat: override.download?.defaultAudioFormat || base.download.defaultAudioFormat,
      defaultSubtitleLanguage: override.download?.defaultSubtitleLanguage || base.download.defaultSubtitleLanguage
    },
    limits: {
      characterLimit: override.limits?.characterLimit || base.limits.characterLimit,
      maxTranscriptLength: override.limits?.maxTranscriptLength || base.limits.maxTranscriptLength
    },
    cookies: {
      file: override.cookies?.file ?? base.cookies.file,
      fromBrowser: override.cookies?.fromBrowser ?? base.cookies.fromBrowser
    },
    network: {
      proxy: override.network?.proxy ?? base.network.proxy,
      // ?? not || — an explicit `false` override must survive
      ignoreConfig: override.network?.ignoreConfig ?? base.network.ignoreConfig
    }
  };
}

/**
 * Load configuration
 */
export function loadConfig(): Config {
  const envConfig = loadEnvConfig();
  const config = mergeConfig(defaultConfig, envConfig);
  validateConfig(config);
  return config;
}

/**
 * Safe filename processing function
 */
export function sanitizeFilename(filename: string, config: Config['file']): string {
  // Remove illegal characters
  let safe = filename.replace(config.sanitize.illegalChars, config.sanitize.replaceChar);
  
  // Check reserved names
  const basename = path.parse(safe).name.toUpperCase();
  if (config.sanitize.reservedNames.includes(basename)) {
    safe = `_${safe}`;
  }
  
  // Handle length limitation
  if (safe.length > config.maxFilenameLength) {
    const ext = path.extname(safe);
    const name = safe.slice(0, config.maxFilenameLength - ext.length - config.sanitize.truncateSuffix.length);
    safe = `${name}${config.sanitize.truncateSuffix}${ext}`;
  }
  
  return safe;
}

/**
 * Get cookie-related yt-dlp arguments
 * Priority: file > fromBrowser
 * @param config Configuration object
 * @returns Array of yt-dlp arguments for cookie handling
 */
export function getCookieArgs(config: Config): string[] {
  // Guard against missing cookies config
  if (!config.cookies) {
    return [];
  }
  // Cookie file takes precedence over browser extraction
  if (config.cookies.file) {
    return ['--cookies', config.cookies.file];
  }
  if (config.cookies.fromBrowser) {
    return ['--cookies-from-browser', config.cookies.fromBrowser];
  }
  return [];
}

/**
 * Get global yt-dlp arguments that apply to every invocation.
 *
 * These must be placed at the front of the argument list so that
 * `--ignore-config` is seen before yt-dlp resolves configuration files.
 *
 * By default no `--ignore-config` is emitted, so yt-dlp honours the user's
 * config file (`~/.config/yt-dlp/config`). Set `YTDLP_IGNORE_CONFIG=1` to
 * restore the previous hermetic behaviour.
 *
 * @param config Configuration object
 * @returns Array of yt-dlp arguments applied to all tools
 */
export function getGlobalArgs(config: Config): string[] {
  // Guard against missing network config
  if (!config.network) {
    return [];
  }

  const args: string[] = [];

  if (config.network.ignoreConfig) {
    args.push('--ignore-config');
  }

  // Compare against undefined, not truthiness: an empty proxy string is a
  // valid yt-dlp value meaning "force a direct connection".
  if (config.network.proxy !== undefined) {
    args.push('--proxy', config.network.proxy);
  }

  return args;
}

// Export current configuration instance
export const CONFIG = loadConfig(); 