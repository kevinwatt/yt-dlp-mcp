// @jest-environment node
import { describe, test, expect } from "@jest/globals";
import { readFileSync } from "fs";
import {
  buildCommentExtractorArgs,
  formatCommentsOutput,
  formatCommentsSummary,
  prepareComments,
  resolveCommentRequestOptions,
} from "../modules/comments-core.js";
import { getVideoComments, getVideoCommentsSummary } from "../modules/comments.js";
import type {
  FlatCommentsResponse,
  ThreadedCommentsResponse,
} from "../modules/comments.js";
import { CONFIG } from "../config.js";

delete process.env.PYTHONPATH;
delete process.env.PYTHONHOME;

const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === "1";
const sourceInfo = {
  sourceId: "vid-123",
  title: "Sample Video",
  sourceUrl: "https://example.com/video",
  extractor: "YouTube",
  generatedAtUtc: "2026-03-11T00:00:00.000Z",
};

function loadFixture<T>(filename: string): T {
  const url = new URL(`./fixtures/comments/${filename}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf-8")) as T;
}

function loadTextFixture(filename: string): string {
  const url = new URL(`./fixtures/comments/${filename}`, import.meta.url);
  return readFileSync(url, "utf-8");
}

describe("comments-core", () => {
  const threadedFixture = loadFixture<unknown[]>("youtube-threaded.json");
  const nonThreadedFixture = loadFixture<unknown[]>("non-threaded.json");

  test("builds full extractor args with reply and depth controls", () => {
    const args = buildCommentExtractorArgs(resolveCommentRequestOptions({
      maxComments: 20,
      sortOrder: "new",
      maxParents: 10,
      maxReplies: 8,
      maxRepliesPerThread: 3,
      maxDepth: 4,
    }));

    expect(args).toBe("youtube:comment_sort=new;max_comments=20,10,8,3,4");
  });

  test("normalizes replies, drops duplicates, and restores time_text", () => {
    const prepared = prepareComments(threadedFixture);

    expect(prepared.detectedCount).toBe(7);
    expect(prepared.orphanCommentIds).toEqual(["orphan-1", "self-1"]);
    expect(prepared.hasThreading).toBe(true);

    const rootComment = prepared.flatComments.find((comment) => comment.id === "c1");
    const replyComment = prepared.flatComments.find((comment) => comment.id === "r1");
    const nestedReply = prepared.flatComments.find((comment) => comment.id === "r2");
    const orphanReply = prepared.flatComments.find((comment) => comment.id === "orphan-1");

    expect(rootComment).toMatchObject({ parent: "root", depth: 0, reply_count: 1 });
    expect(replyComment).toMatchObject({ parent: "c1", depth: 1, reply_count: 1, time_text: "1 day ago" });
    expect(nestedReply).toMatchObject({ parent: "r1", depth: 2, reply_count: 0 });
    expect(orphanReply).toMatchObject({ parent: "root", depth: 0, reply_count: 0 });
  });

  test("returns backward-compatible flat json with reply metadata", () => {
    const json = formatCommentsOutput(
      threadedFixture,
      sourceInfo,
      resolveCommentRequestOptions({ maxComments: 20 })
    );
    const data = JSON.parse(json) as FlatCommentsResponse;

    expect(data.count).toBe(7);
    expect(data.root_threads).toBe(4);
    expect(data.reply_comments).toBe(3);
    expect(data.orphan_comments).toBe(2);
    expect(data.has_more).toBe(false);
    expect(data.comments[1]).toMatchObject({
      id: "r1",
      parent: "c1",
      depth: 1,
      reply_count: 1,
      time_text: "1 day ago",
    });
  });

  test("returns threaded json with nested replies", () => {
    const json = formatCommentsOutput(
      threadedFixture,
      sourceInfo,
      resolveCommentRequestOptions({ maxComments: 20, view: "threaded" })
    );
    const data = JSON.parse(json) as ThreadedCommentsResponse;

    expect(data.count).toBe(7);
    expect(data.root_threads).toBe(4);
    expect(data.comments[0].id).toBe("c1");
    expect(data.comments[0].replies[0].id).toBe("r1");
    expect(data.comments[0].replies[0].replies[0].id).toBe("r2");
    expect(data.comments[3].replies[0].id).toBe("r3");
  });

  test("renders stable markdown_tree output with thread blocks", () => {
    const markdown = formatCommentsOutput(
      threadedFixture,
      sourceInfo,
      resolveCommentRequestOptions({
        maxComments: 20,
        view: "threaded",
        responseFormat: "markdown_tree",
      })
    );

    expect(markdown).toBe(loadTextFixture("threaded-markdown.md"));
  });

  test("truncates threaded json by whole root threads", () => {
    const fullJson = formatCommentsOutput(
      threadedFixture,
      sourceInfo,
      resolveCommentRequestOptions({ maxComments: 20, view: "threaded" })
    );
    const truncatedJson = formatCommentsOutput(
      threadedFixture,
      sourceInfo,
      resolveCommentRequestOptions({ maxComments: 20, view: "threaded" }),
      fullJson.length - 1
    );

    const fullData = JSON.parse(fullJson) as ThreadedCommentsResponse;
    const truncatedData = JSON.parse(truncatedJson) as ThreadedCommentsResponse;

    expect(truncatedData._truncated).toBe(true);
    expect(truncatedData.has_more).toBe(true);
    expect(truncatedData.root_threads).toBeLessThan(fullData.root_threads);
    expect(truncatedData.comments[truncatedData.comments.length - 1]?.parent).toBe("root");
  });

  test("gracefully degrades to root-only threads when parent metadata is missing", () => {
    const prepared = prepareComments(nonThreadedFixture);
    const json = formatCommentsOutput(
      nonThreadedFixture,
      sourceInfo,
      resolveCommentRequestOptions({ maxComments: 10, view: "threaded" })
    );
    const data = JSON.parse(json) as ThreadedCommentsResponse;

    expect(prepared.hasThreading).toBe(false);
    expect(data.root_threads).toBe(3);
    expect(data.reply_comments).toBe(0);
    expect(data.comments.every((comment) => comment.replies.length === 0)).toBe(true);
  });

  test("renders threaded summary with grouped replies", () => {
    const summary = formatCommentsSummary(threadedFixture, {
      maxComments: 20,
      view: "threaded",
    });

    expect(summary).toContain("Thread 1");
    expect(summary).toContain("Reply: Bob (1 day ago)");
    expect(summary).not.toContain("Reply to comment");
  });
});

(RUN_INTEGRATION ? describe : describe.skip)("comments integration", () => {
  const testUrl = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

  test("extracts threaded comments from YouTube", async () => {
    const commentsJson = await getVideoComments(testUrl, 5, "top", CONFIG, {
      view: "threaded",
      maxDepth: 2,
    });
    const data = JSON.parse(commentsJson) as ThreadedCommentsResponse;

    expect(data).toHaveProperty("count");
    expect(data).toHaveProperty("root_threads");
    expect(data).toHaveProperty("reply_comments");
    expect(Array.isArray(data.comments)).toBe(true);
  }, 90000);

  test("generates threaded comments summary", async () => {
    const summary = await getVideoCommentsSummary(testUrl, 5, CONFIG, {
      view: "threaded",
    });

    expect(typeof summary).toBe("string");
    expect(summary).toContain("Video Comments");
  }, 90000);

  test("throws for invalid URLs", async () => {
    await expect(getVideoComments("invalid-url", 5, "top", CONFIG)).rejects.toThrow();
    await expect(getVideoCommentsSummary("invalid-url", 5, CONFIG)).rejects.toThrow();
  });
});
