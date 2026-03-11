import { prepareComments } from "./comments-prepare.js";
import { buildFlatSummary, buildThreadedSummary } from "./comments-summary.js";
import type {
  CommentRequestOptions,
  CommentSourceInfo,
  CommentSummaryOptions,
  FlatCommentsResponse,
  NormalizedComment,
  PreparedComments,
  ThreadedComment,
  ThreadedCommentsResponse,
} from "./comments-types.js";
import { countThreadComments } from "./comments-types.js";

interface SelectionResult<TComment> {
  comments: TComment[];
  hasMore: boolean;
}

interface SelectedStats {
  count: number;
  rootThreads: number;
  replyComments: number;
  orphanComments: number;
}

export function formatCommentsOutput(
  rawComments: unknown,
  sourceInfo: CommentSourceInfo,
  options: CommentRequestOptions,
  characterLimit?: number
): string {
  const prepared = prepareComments(rawComments);

  if (options.responseFormat === "markdown_tree") {
    return formatMarkdownComments(prepared, sourceInfo, options.maxComments, characterLimit);
  }

  const orphanIds = new Set(prepared.orphanCommentIds);

  if (options.view === "threaded") {
    const selection = selectThreadedComments(prepared.threadedComments, options.maxComments);
    return serializeThreadedResponse(selection.comments, selection.hasMore, orphanIds, characterLimit);
  }

  const selection = selectFlatComments(prepared.flatComments, options.maxComments);
  return serializeFlatResponse(selection.comments, selection.hasMore, orphanIds, characterLimit);
}

export function formatCommentsSummary(rawComments: unknown, options: CommentSummaryOptions): string {
  const prepared = prepareComments(rawComments);

  if (options.view === "threaded") {
    const selection = selectThreadedComments(prepared.threadedComments, options.maxComments);
    return buildThreadedSummary(selection.comments, selection.hasMore);
  }

  const selection = selectFlatComments(prepared.flatComments, options.maxComments);
  return buildFlatSummary(selection.comments, selection.hasMore);
}

function selectFlatComments(
  comments: NormalizedComment[],
  maxComments: number
): SelectionResult<NormalizedComment> {
  const limitedComments = comments.slice(0, maxComments);
  return {
    comments: limitedComments,
    hasMore: comments.length > limitedComments.length,
  };
}

function selectThreadedComments(
  comments: ThreadedComment[],
  maxComments: number
): SelectionResult<ThreadedComment> {
  const selected: ThreadedComment[] = [];
  let selectedCount = 0;

  for (const thread of comments) {
    const threadCount = countThreadComments(thread);
    if (selected.length > 0 && selectedCount + threadCount > maxComments) {
      return {
        comments: selected,
        hasMore: true,
      };
    }

    selected.push(thread);
    selectedCount += threadCount;

    if (selectedCount >= maxComments) {
      return {
        comments: selected,
        hasMore: selected.length < comments.length,
      };
    }
  }

  return {
    comments: selected,
    hasMore: selected.length < comments.length,
  };
}

function serializeFlatResponse(
  comments: NormalizedComment[],
  hasMore: boolean,
  orphanIds: Set<string>,
  characterLimit?: number
): string {
  let selectedComments = comments;
  let truncated = false;

  while (true) {
    const stats = buildFlatStats(selectedComments, orphanIds);
    const response: FlatCommentsResponse = {
      count: stats.count,
      has_more: hasMore || truncated,
      root_threads: stats.rootThreads,
      reply_comments: stats.replyComments,
      orphan_comments: stats.orphanComments,
      comments: selectedComments,
      ...(truncated ? {
        _truncated: true,
        _message: `Response truncated to ${selectedComments.length} comments due to size limits.`,
      } : {}),
    };

    const result = JSON.stringify(response, null, 2);
    if (!characterLimit || result.length <= characterLimit || selectedComments.length === 0) {
      return result;
    }

    truncated = true;
    selectedComments = selectedComments.slice(0, -1);
  }
}

function serializeThreadedResponse(
  comments: ThreadedComment[],
  hasMore: boolean,
  orphanIds: Set<string>,
  characterLimit?: number
): string {
  let selectedThreads = comments;
  let truncated = false;

  while (true) {
    const stats = buildThreadedStats(selectedThreads, orphanIds);
    const response: ThreadedCommentsResponse = {
      count: stats.count,
      has_more: hasMore || truncated,
      root_threads: stats.rootThreads,
      reply_comments: stats.replyComments,
      orphan_comments: stats.orphanComments,
      comments: selectedThreads,
      ...(truncated ? {
        _truncated: true,
        _message: `Response truncated to ${selectedThreads.length} threads due to size limits.`,
      } : {}),
    };

    const result = JSON.stringify(response, null, 2);
    if (!characterLimit || result.length <= characterLimit || selectedThreads.length === 0) {
      return result;
    }

    truncated = true;
    selectedThreads = selectedThreads.slice(0, -1);
  }
}

function formatMarkdownComments(
  prepared: PreparedComments,
  sourceInfo: CommentSourceInfo,
  maxComments: number,
  characterLimit?: number
): string {
  const orphanIds = new Set(prepared.orphanCommentIds);
  const baseSelection = selectThreadedComments(prepared.threadedComments, maxComments);
  let selectedThreads = baseSelection.comments;
  let truncated = false;

  while (true) {
    const result = renderMarkdownDocument(
      selectedThreads,
      prepared,
      sourceInfo,
      orphanIds,
      baseSelection.hasMore || truncated,
      truncated
    );

    if (!characterLimit || result.length <= characterLimit || selectedThreads.length === 0) {
      return result;
    }

    truncated = true;
    selectedThreads = selectedThreads.slice(0, -1);
  }
}

function renderMarkdownDocument(
  comments: ThreadedComment[],
  prepared: PreparedComments,
  sourceInfo: CommentSourceInfo,
  orphanIds: Set<string>,
  hasMore: boolean,
  truncated: boolean
): string {
  const stats = buildThreadedStats(comments, orphanIds);
  const generatedAtUtc = sourceInfo.generatedAtUtc ?? new Date().toISOString();
  const headerLines = [
    "# AI-Ready Comment Threads",
    "",
    `source_title: ${formatScalar(sourceInfo.title ?? null)}`,
    `source_id: ${formatScalar(sourceInfo.sourceId ?? null)}`,
    `source_url: ${formatScalar(sourceInfo.sourceUrl ?? null)}`,
    `extractor: ${formatScalar(sourceInfo.extractor ?? null)}`,
    `generated_at_utc: ${formatScalar(generatedAtUtc)}`,
    `raw_info_json: ${formatScalar(sourceInfo.rawInfoJsonPath ?? null)}`,
    `comments_detected: ${prepared.detectedCount}`,
    `comments_returned: ${stats.count}`,
    `root_threads: ${stats.rootThreads}`,
    `reply_comments: ${stats.replyComments}`,
    `orphan_comments: ${stats.orphanComments}`,
    `has_threading: ${formatScalar(prepared.hasThreading)}`,
    `has_more: ${formatScalar(hasMore)}`,
    "",
    "## Notes",
    "",
    "- Optimized for LLMs with stable keys, explicit `parent_id`, and preserved thread structure.",
    "- If the extractor does not expose `parent`, every comment is treated as a root thread.",
    "- `orphan_comments` means a reply arrived without its parent in the fetched payload.",
  ];

  if (truncated) {
    headerLines.push("- Output was truncated by whole thread blocks to fit MCP size limits.");
  }

  headerLines.push("", "## Threads", "");

  if (comments.length === 0) {
    headerLines.push("No comments were available in the extracted payload.", "");
    return `${headerLines.join("\n")}`.trimEnd() + "\n";
  }

  const threadBlocks = comments.map((thread, index) => renderThreadBlock(thread, index + 1));
  return `${headerLines.join("\n")}\n${threadBlocks.join("")}`.trimEnd() + "\n";
}

function renderThreadBlock(thread: ThreadedComment, index: number): string {
  const lines = [`### Thread ${index}`, ""];
  appendThreadLines(thread, 0, lines);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function appendThreadLines(comment: ThreadedComment, depth: number, lines: string[]): void {
  const indent = "  ".repeat(depth);

  lines.push(`${indent}- comment_id: ${formatScalar(comment.id)}`);
  lines.push(`${indent}  parent_id: ${formatScalar(comment.parent)}`);
  lines.push(`${indent}  depth: ${comment.depth}`);

  appendOptionalLine(lines, `${indent}  author`, comment.author);
  appendOptionalLine(lines, `${indent}  author_id`, comment.author_id);
  appendOptionalLine(lines, `${indent}  author_url`, comment.author_url);
  appendOptionalLine(lines, `${indent}  author_is_uploader`, comment.author_is_uploader);
  appendOptionalLine(lines, `${indent}  author_is_verified`, comment.author_is_verified);
  appendOptionalLine(lines, `${indent}  is_pinned`, comment.is_pinned);
  appendOptionalLine(lines, `${indent}  is_favorited`, comment.is_favorited);
  appendOptionalLine(lines, `${indent}  like_count`, comment.like_count);
  appendOptionalLine(lines, `${indent}  timestamp`, comment.timestamp);
  appendOptionalLine(lines, `${indent}  time_text`, comment.time_text);

  lines.push(`${indent}  reply_count: ${comment.reply_count}`);
  lines.push(`${indent}  text:`);
  appendTextBlock(lines, `${indent}    `, comment.text ?? "");

  for (const reply of comment.replies) {
    appendThreadLines(reply, depth + 1, lines);
  }
}

function buildFlatStats(comments: NormalizedComment[], orphanIds: Set<string>): SelectedStats {
  const rootThreads = comments.filter((comment) => comment.parent === "root").length;
  const orphanComments = comments.filter((comment) => orphanIds.has(comment.id)).length;

  return {
    count: comments.length,
    rootThreads,
    replyComments: Math.max(0, comments.length - rootThreads),
    orphanComments,
  };
}

function buildThreadedStats(comments: ThreadedComment[], orphanIds: Set<string>): SelectedStats {
  const flatComments = flattenThreads(comments);
  return {
    count: flatComments.length,
    rootThreads: comments.length,
    replyComments: Math.max(0, flatComments.length - comments.length),
    orphanComments: flatComments.filter((comment) => orphanIds.has(comment.id)).length,
  };
}

function flattenThreads(comments: ThreadedComment[]): ThreadedComment[] {
  const flattened: ThreadedComment[] = [];

  for (const comment of comments) {
    flattened.push(comment);
    flattened.push(...flattenThreads(comment.replies));
  }

  return flattened;
}


function appendOptionalLine(lines: string[], key: string, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }

  lines.push(`${key}: ${formatScalar(value)}`);
}

function appendTextBlock(lines: string[], indent: string, text: string): void {
  const textLines = text.split("\n");
  const normalizedLines = textLines.length > 0 ? textLines : [""];

  for (const line of normalizedLines) {
    lines.push(line ? `${indent}| ${line}` : `${indent}|`);
  }
}

function formatScalar(value: unknown): string {
  return JSON.stringify(value);
}
