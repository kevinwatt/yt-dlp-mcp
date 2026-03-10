import type {
  NormalizedComment,
  ThreadedComment,
} from "./comments-types.js";

export function buildFlatSummary(comments: NormalizedComment[], hasMore: boolean): string {
  const lines: string[] = [];

  lines.push(`Video Comments (${comments.length} shown)`);
  lines.push("─".repeat(30));
  lines.push("");

  for (const comment of comments) {
    if (comment.parent !== "root") {
      lines.push(`Reply to: ${comment.parent}`);
    }

    lines.push(buildAuthorLine(comment, "Author"));
    if (comment.text) {
      lines.push(truncateCommentText(comment.text));
    }
    lines.push("");
  }

  if (hasMore) {
    lines.push("---");
    lines.push("More comments available. Increase maxComments to see more.");
  }

  return lines.join("\n");
}

export function buildThreadedSummary(comments: ThreadedComment[], hasMore: boolean): string {
  const lines: string[] = [];
  const totalCount = comments.reduce((sum, thread) => sum + countThreadComments(thread), 0);

  lines.push(`Video Comments (${totalCount} shown across ${comments.length} threads)`);
  lines.push("─".repeat(30));
  lines.push("");

  comments.forEach((thread, index) => {
    lines.push(`Thread ${index + 1}`);
    appendThreadSummary(thread, 0, lines);
    lines.push("");
  });

  if (hasMore) {
    lines.push("---");
    lines.push("More comments available. Increase maxComments to see more.");
  }

  return lines.join("\n");
}

function appendThreadSummary(comment: ThreadedComment, depth: number, lines: string[]): void {
  const indent = "  ".repeat(depth);
  const label = depth === 0 ? "Author" : "Reply";

  lines.push(`${indent}${buildAuthorLine(comment, label)}`);
  if (comment.text) {
    lines.push(`${indent}${truncateCommentText(comment.text)}`);
  }
  lines.push("");

  for (const reply of comment.replies) {
    appendThreadSummary(reply, depth + 1, lines);
  }
}

function buildAuthorLine(comment: NormalizedComment, prefix: string): string {
  let line = `${prefix}: ${comment.author ?? "Unknown"}`;

  if (comment.author_is_uploader) {
    line += " [UPLOADER]";
  }
  if (comment.author_is_verified) {
    line += " [VERIFIED]";
  }
  if (comment.is_pinned) {
    line += " [PINNED]";
  }
  if (comment.time_text) {
    line += ` (${comment.time_text})`;
  }
  if (typeof comment.like_count === "number" && comment.like_count > 0) {
    line += ` - ${comment.like_count.toLocaleString()} likes`;
  }

  return line;
}

function truncateCommentText(text: string): string {
  if (text.length <= 300) {
    return text;
  }

  return `${text.slice(0, 300)}...`;
}

function countThreadComments(comment: ThreadedComment): number {
  return 1 + comment.replies.reduce((sum, reply) => sum + countThreadComments(reply), 0);
}
