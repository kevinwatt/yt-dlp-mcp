import { _spawnPromise } from "./utils.js";
import type { Config } from "../config.js";
import { getCookieArgs } from "../config.js";

/**
 * YouTube search result interface
 */
export interface SearchResult {
  title: string;
  id: string;
  url: string;
  uploader?: string;
  duration?: string;
  viewCount?: string;
  uploadDate?: string;
}

/**
 * Search YouTube videos
 * @param query Search keywords
 * @param maxResults Maximum number of results (1-50)
 * @param offset Number of results to skip for pagination
 * @param responseFormat Output format ('json' or 'markdown')
 * @param config Configuration object
 * @returns Search results formatted as string
 */
export async function searchVideos(
  query: string,
  maxResults: number = 10,
  offset: number = 0,
  responseFormat: "json" | "markdown" = "markdown",
  config: Config
): Promise<string> {
  // Validate parameters
  if (!query || query.trim().length === 0) {
    throw new Error("Search query cannot be empty");
  }

  if (maxResults < 1 || maxResults > 50) {
    throw new Error("Number of results must be between 1 and 50");
  }

  if (offset < 0) {
    throw new Error("Offset cannot be negative");
  }

  const cleanQuery = query.trim();
  // Request more results to support offset
  const totalToFetch = maxResults + offset;
  const searchQuery = `ytsearch${totalToFetch}:${cleanQuery}`;

  try {
    // Use yt-dlp to search and get video information
    const args = [
      searchQuery,
      "--print", "title",
      "--print", "id",
      "--print", "uploader",
      "--print", "duration",
      "--no-download",
      "--quiet",
      ...getCookieArgs(config)
    ];

    const result = await _spawnPromise(config.tools.required[0], args);
    
    if (!result || result.trim().length === 0) {
      return "No videos found";
    }

    // Parse results
    const lines = result.trim().split('\n');
    const allResults: SearchResult[] = [];

    // Each video has 4 lines of data: title, id, uploader, duration
    for (let i = 0; i < lines.length; i += 4) {
      if (i + 3 < lines.length) {
        const title = lines[i]?.trim();
        const id = lines[i + 1]?.trim();
        const uploader = lines[i + 2]?.trim();
        const duration = lines[i + 3]?.trim();

        if (title && id) {
          const url = `https://www.youtube.com/watch?v=${id}`;
          allResults.push({
            title,
            id,
            url,
            uploader: uploader || "Unknown",
            duration: duration || "Unknown"
          });
        }
      }
    }

    // Apply offset and limit
    const paginatedResults = allResults.slice(offset, offset + maxResults);
    const hasMore = allResults.length > offset + maxResults;

    if (paginatedResults.length === 0) {
      return "No videos found";
    }

    // Format output based on response format
    if (responseFormat === "json") {
      const response = {
        total: allResults.length,
        count: paginatedResults.length,
        offset: offset,
        videos: paginatedResults,
        has_more: hasMore,
        ...(hasMore && { next_offset: offset + maxResults })
      };

      let output = JSON.stringify(response, null, 2);

      // Check character limit
      if (output.length > config.limits.characterLimit) {
        // Truncate videos array
        const truncatedCount = Math.ceil(paginatedResults.length / 2);
        const truncatedResponse = {
          ...response,
          count: truncatedCount,
          videos: paginatedResults.slice(0, truncatedCount),
          truncated: true,
          truncation_message: `Response truncated from ${paginatedResults.length} to ${truncatedCount} results. Use offset parameter or reduce maxResults to see more.`
        };
        output = JSON.stringify(truncatedResponse, null, 2);
      }

      return output;
    } else {
      // Markdown format
      let output = `Found ${allResults.length} video${allResults.length > 1 ? 's' : ''} (showing ${paginatedResults.length}):\n\n`;

      paginatedResults.forEach((video, index) => {
        output += `${offset + index + 1}. **${video.title}**\n`;
        output += `   📺 Channel: ${video.uploader}\n`;
        output += `   ⏱️  Duration: ${video.duration}\n`;
        output += `   🔗 URL: ${video.url}\n`;
        output += `   🆔 ID: ${video.id}\n\n`;
      });

      // Add pagination info
      if (offset > 0 || hasMore) {
        output += `\n📊 Pagination: Showing results ${offset + 1}-${offset + paginatedResults.length} of ${allResults.length}`;
        if (hasMore) {
          output += ` (${allResults.length - offset - paginatedResults.length} more available)`;
        }
        output += '\n';
      }

      output += "\n💡 You can use any URL to download videos, audio, or subtitles!";

      // Check character limit
      if (output.length > config.limits.characterLimit) {
        output = output.substring(0, config.limits.characterLimit);
        output += "\n\n⚠️ Response truncated. Use offset parameter or reduce maxResults to see more results.";
      }

      return output;
    }

  } catch (error) {
    if (error instanceof Error) {
      // Provide more actionable error messages
      if (error.message.includes("network") || error.message.includes("Network")) {
        throw new Error("Network error while searching. Check your internet connection and retry.");
      }
      if (error.message.includes("429") || error.message.includes("rate limit")) {
        throw new Error("YouTube rate limit exceeded. Wait 60 seconds before searching again.");
      }
      throw new Error(`Search failed: ${error.message}. Try a different query or reduce maxResults.`);
    }
    throw new Error(`Error searching videos: ${String(error)}`);
  }
}

/**
 * Search videos on specific platform (future expansion feature)
 * @param query Search keywords
 * @param platform Platform name ('youtube', 'bilibili', etc.)
 * @param maxResults Maximum number of results
 * @param offset Number of results to skip
 * @param responseFormat Output format
 * @param config Configuration object
 */
export async function searchByPlatform(
  query: string,
  platform: string = 'youtube',
  maxResults: number = 10,
  offset: number = 0,
  responseFormat: "json" | "markdown" = "markdown",
  config: Config
): Promise<string> {
  // Currently only supports YouTube, can be expanded to other platforms in the future
  if (platform.toLowerCase() !== 'youtube') {
    throw new Error(`Currently only supports YouTube search, ${platform} is not supported`);
  }

  return searchVideos(query, maxResults, offset, responseFormat, config);
} 