import type { Config } from "../config.js";
import { getCookieArgs } from "../config.js";
import { _spawnPromise, validateUrl } from "./utils.js";
import {
  buildCommentExtractorArgs,
  formatCommentsOutput,
  formatCommentsSummary,
  resolveCommentRequestOptions,
} from "./comments-core.js";

export type {
  Comment,
  CommentsResponse,
  CommentResponseFormat,
  CommentSortOrder,
  CommentSummaryOptions,
  CommentView,
  FlatCommentsResponse,
  NormalizedComment,
  ThreadedComment,
  ThreadedCommentsResponse,
} from "./comments-core.js";

export interface GetVideoCommentsOptions {
  view?: "flat" | "threaded";
  responseFormat?: "json" | "markdown_tree";
  maxParents?: number;
  maxReplies?: number;
  maxRepliesPerThread?: number;
  maxDepth?: number;
}

export interface GetVideoCommentsSummaryOptions {
  view?: "flat" | "threaded";
}

export async function getVideoComments(
  url: string,
  maxComments: number = 20,
  sortOrder: "top" | "new" = "top",
  config?: Config,
  options: GetVideoCommentsOptions = {}
): Promise<string> {
  if (!validateUrl(url)) {
    throw new Error("Invalid or unsupported URL format");
  }

  const normalizedView = options.responseFormat === "markdown_tree"
    ? options.view ?? "threaded"
    : options.view;

  if (options.responseFormat === "markdown_tree" && normalizedView !== "threaded") {
    throw new Error("responseFormat 'markdown_tree' requires view 'threaded'. Omit view to use the threaded default.");
  }

  const requestOptions = resolveCommentRequestOptions({
    maxComments,
    sortOrder,
    view: normalizedView,
    responseFormat: options.responseFormat,
    maxParents: options.maxParents,
    maxReplies: options.maxReplies,
    maxRepliesPerThread: options.maxRepliesPerThread,
    maxDepth: options.maxDepth,
  });

  const args = [
    "--dump-json",
    "--no-warnings",
    "--no-check-certificate",
    "--write-comments",
    "--extractor-args",
    buildCommentExtractorArgs(requestOptions),
    "--skip-download",
    ...(config ? getCookieArgs(config) : []),
    url,
  ];

  try {
    const output = await _spawnPromise("yt-dlp", args);
    const metadata = JSON.parse(output) as Record<string, unknown>;

    return formatCommentsOutput(
      metadata.comments,
      {
        sourceId: readMetadataString(metadata.id),
        title: readMetadataString(metadata.title) ?? readMetadataString(metadata.fulltitle),
        sourceUrl: readMetadataString(metadata.webpage_url) ?? readMetadataString(metadata.original_url) ?? url,
        extractor: readMetadataString(metadata.extractor_key) ?? readMetadataString(metadata.extractor),
      },
      requestOptions,
      config?.limits.characterLimit
    );
  } catch (error) {
    handleCommentsError(error, url);
  }
}

export async function getVideoCommentsSummary(
  url: string,
  maxComments: number = 10,
  config?: Config,
  options: GetVideoCommentsSummaryOptions = {}
): Promise<string> {
  if (!validateUrl(url)) {
    throw new Error("Invalid or unsupported URL format");
  }

  const requestOptions = resolveCommentRequestOptions({
    maxComments,
    view: options.view,
  });

  const args = [
    "--dump-json",
    "--no-warnings",
    "--no-check-certificate",
    "--write-comments",
    "--extractor-args",
    buildCommentExtractorArgs(requestOptions),
    "--skip-download",
    ...(config ? getCookieArgs(config) : []),
    url,
  ];

  try {
    const output = await _spawnPromise("yt-dlp", args);
    const metadata = JSON.parse(output) as Record<string, unknown>;
    return formatCommentsSummary(metadata.comments, {
      maxComments: requestOptions.maxComments,
      view: requestOptions.view,
    });
  } catch (error) {
    handleCommentsError(error, url);
  }
}

function readMetadataString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function handleCommentsError(error: unknown, url: string): never {
  if (error instanceof Error) {
    if (error.message.includes("Video unavailable") || error.message.includes("private")) {
      throw new Error(`Video is unavailable or private: ${url}. Check the URL and video privacy settings.`);
    }
    if (error.message.includes("Unsupported URL") || error.message.includes("extractor")) {
      throw new Error(`Unsupported platform or video URL: ${url}. Comments extraction is primarily supported for YouTube.`);
    }
    if (error.message.includes("network") || error.message.includes("Connection")) {
      throw new Error("Network error while extracting comments. Check your internet connection and retry.");
    }
    if (error.message.includes("comments are disabled") || error.message.includes("Comments are turned off")) {
      throw new Error(`Comments are disabled for this video: ${url}`);
    }
    if (error.message.includes("Sign in") || error.message.includes("age")) {
      throw new Error(`This video requires authentication to view comments. Configure cookies in your settings.`);
    }
    if (error.message.includes("Unexpected token") || error.message.includes("JSON")) {
      throw new Error(`Failed to parse comments metadata from ${url}. yt-dlp returned invalid JSON output.`);
    }

    throw new Error(`Failed to extract video comments: ${error.message}. Verify the URL is correct.`);
  }

  throw new Error(`Failed to extract video comments from ${url}`);
}
