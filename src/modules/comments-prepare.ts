import type {
  NormalizedComment,
  PreparedComments,
  ThreadedComment,
} from "./comments-types.js";

interface InternalComment extends NormalizedComment {
  is_orphan: boolean;
}

interface InternalThreadedComment extends InternalComment {
  replies: InternalThreadedComment[];
}

export function prepareComments(rawComments: unknown): PreparedComments {
  const comments = normalizeComments(rawComments);
  const commentById = new Map<string, InternalComment>();

  for (const comment of comments) {
    commentById.set(comment.id, comment);
  }

  const childrenByParent = new Map<string, string[]>();
  const rootIds: string[] = [];

  for (const comment of comments) {
    const originalParent = comment.parent;
    const parentExists = originalParent === "root" || commentById.has(originalParent);

    if (originalParent === comment.id || !parentExists) {
      comment.parent = "root";
      comment.is_orphan = originalParent !== "root";
    }

    if (comment.parent === "root") {
      rootIds.push(comment.id);
      continue;
    }

    const children = childrenByParent.get(comment.parent) ?? [];
    children.push(comment.id);
    childrenByParent.set(comment.parent, children);
  }

  const assigned = new Set<string>();
  const threadedComments: InternalThreadedComment[] = [];

  for (const rootId of rootIds) {
    const thread = buildThread(rootId, 0, commentById, childrenByParent, assigned, new Set<string>());
    if (thread) {
      threadedComments.push(thread);
    }
  }

  for (const comment of comments) {
    if (assigned.has(comment.id)) {
      continue;
    }

    if (comment.parent !== "root") {
      comment.parent = "root";
      comment.is_orphan = true;
    }

    const thread = buildThread(
      comment.id,
      0,
      commentById,
      childrenByParent,
      assigned,
      new Set<string>()
    );
    if (thread) {
      threadedComments.push(thread);
    }
  }

  return {
    detectedCount: comments.length,
    hasThreading: threadedComments.some((thread) => thread.reply_count > 0),
    flatComments: comments.map(stripInternalComment),
    threadedComments: threadedComments.map(stripInternalThread),
    orphanCommentIds: comments
      .filter((comment) => comment.is_orphan)
      .map((comment) => comment.id),
  };
}

function normalizeComments(rawComments: unknown): InternalComment[] {
  if (!Array.isArray(rawComments)) {
    return [];
  }

  const seenIds = new Set<string>();
  const comments: InternalComment[] = [];

  for (const item of rawComments) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const rawComment = item as Record<string, unknown>;
    const id = readOptionalIdentifier(rawComment.id);
    if (!id || seenIds.has(id)) {
      continue;
    }

    seenIds.add(id);

    comments.push({
      id,
      text: readOptionalString(rawComment.text, true),
      author: readOptionalString(rawComment.author),
      author_id: readOptionalString(rawComment.author_id),
      author_url: readOptionalString(rawComment.author_url),
      author_is_uploader: readOptionalBoolean(rawComment.author_is_uploader),
      author_is_verified: readOptionalBoolean(rawComment.author_is_verified),
      like_count: readOptionalNumber(rawComment.like_count),
      is_pinned: readOptionalBoolean(rawComment.is_pinned),
      is_favorited: readOptionalBoolean(rawComment.is_favorited),
      parent: readOptionalIdentifier(rawComment.parent) ?? "root",
      timestamp: readOptionalNumber(rawComment.timestamp),
      time_text: readOptionalString(rawComment.time_text) ?? readOptionalString(rawComment._time_text) ?? null,
      depth: 0,
      reply_count: 0,
      is_orphan: false,
    });
  }

  return comments;
}

function buildThread(
  commentId: string,
  depth: number,
  commentById: Map<string, InternalComment>,
  childrenByParent: Map<string, string[]>,
  assigned: Set<string>,
  stack: Set<string>
): InternalThreadedComment | null {
  const comment = commentById.get(commentId);
  if (!comment || stack.has(commentId) || assigned.has(commentId)) {
    return null;
  }

  assigned.add(commentId);
  comment.depth = depth;

  const nextStack = new Set(stack);
  nextStack.add(commentId);
  const replies: InternalThreadedComment[] = [];

  for (const childId of childrenByParent.get(commentId) ?? []) {
    const child = buildThread(childId, depth + 1, commentById, childrenByParent, assigned, nextStack);
    if (child) {
      replies.push(child);
    }
  }

  comment.reply_count = replies.length;
  return {
    ...comment,
    replies,
  };
}

function stripInternalComment(comment: InternalComment): NormalizedComment {
  const { is_orphan: _isOrphan, ...publicComment } = comment;
  return publicComment;
}

function stripInternalThread(comment: InternalThreadedComment): ThreadedComment {
  const { is_orphan: _isOrphan, replies, ...publicComment } = comment;
  return {
    ...publicComment,
    replies: replies.map(stripInternalThread),
  };
}

function readOptionalString(value: unknown, allowEmpty: boolean = false): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  if (allowEmpty || value.length > 0) {
    return value;
  }

  return undefined;
}

function readOptionalIdentifier(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.length > 0 ? value : undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}
