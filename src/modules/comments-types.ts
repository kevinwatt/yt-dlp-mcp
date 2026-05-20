export interface Comment {
  id?: string;
  text?: string;
  author?: string;
  author_id?: string;
  author_url?: string;
  author_is_uploader?: boolean;
  author_is_verified?: boolean;
  like_count?: number;
  is_pinned?: boolean;
  is_favorited?: boolean;
  parent?: string;
  timestamp?: number;
  time_text?: string | null;
  [key: string]: unknown;
}

export interface NormalizedComment extends Comment {
  id: string;
  parent: string;
  time_text: string | null;
  depth: number;
  reply_count: number;
}

export interface ThreadedComment extends NormalizedComment {
  replies: ThreadedComment[];
}

export interface CommentsResponseBase<TComment> {
  count: number;
  has_more: boolean;
  root_threads: number;
  reply_comments: number;
  orphan_comments: number;
  comments: TComment[];
  _truncated?: boolean;
  _message?: string;
}

export type FlatCommentsResponse = CommentsResponseBase<NormalizedComment>;
export type ThreadedCommentsResponse = CommentsResponseBase<ThreadedComment>;
export type CommentsResponse = FlatCommentsResponse | ThreadedCommentsResponse;
export type CommentSortOrder = "top" | "new";
export type CommentView = "flat" | "threaded";
export type CommentResponseFormat = "json" | "markdown_tree";

export interface CommentRequestOptions {
  maxComments: number;
  sortOrder: CommentSortOrder;
  view: CommentView;
  responseFormat: CommentResponseFormat;
  maxParents: number;
  maxReplies: number;
  maxRepliesPerThread: number;
  maxDepth: number;
}

export interface CommentSummaryOptions {
  maxComments: number;
  view: CommentView;
}

export interface CommentSourceInfo {
  sourceId?: string | null;
  title?: string | null;
  sourceUrl?: string | null;
  extractor?: string | null;
  rawInfoJsonPath?: string | null;
  generatedAtUtc?: string;
}

export interface PreparedComments {
  detectedCount: number;
  hasThreading: boolean;
  flatComments: NormalizedComment[];
  threadedComments: ThreadedComment[];
  orphanCommentIds: string[];
}

export function resolveCommentRequestOptions(
  input: Partial<CommentRequestOptions> & Pick<CommentRequestOptions, "maxComments">
): CommentRequestOptions {
  const maxComments = clampInteger(input.maxComments, 1);
  return {
    maxComments,
    sortOrder: input.sortOrder ?? "top",
    view: input.view ?? "flat",
    responseFormat: input.responseFormat ?? "json",
    maxParents: clampInteger(input.maxParents ?? maxComments, 0),
    maxReplies: clampInteger(input.maxReplies ?? maxComments, 0),
    maxRepliesPerThread: clampInteger(input.maxRepliesPerThread ?? maxComments, 0),
    maxDepth: clampInteger(input.maxDepth ?? 2, 1),
  };
}

export function buildCommentExtractorArgs(options: CommentRequestOptions): string {
  return `youtube:comment_sort=${options.sortOrder};max_comments=${options.maxComments},${options.maxParents},${options.maxReplies},${options.maxRepliesPerThread},${options.maxDepth}`;
}

export function countThreadComments(comment: ThreadedComment): number {
  return 1 + comment.replies.reduce((sum, reply) => sum + countThreadComments(reply), 0);
}

function clampInteger(value: number, minimum: number): number {
  return Math.max(minimum, Math.trunc(value));
}
