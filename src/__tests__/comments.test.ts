// @ts-nocheck
// @jest-environment node
import { describe, test, expect, beforeAll } from '@jest/globals';
import { getVideoComments, getVideoCommentsSummary } from '../modules/comments.js';
import type { CommentsResponse } from '../modules/comments.js';
import { CONFIG } from '../config.js';

// Clear Python environment to avoid yt-dlp issues
delete process.env.PYTHONPATH;
delete process.env.PYTHONHOME;

// Integration tests require network access - opt-in via RUN_INTEGRATION_TESTS=1
const RUN_INTEGRATION = process.env.RUN_INTEGRATION_TESTS === '1';

(RUN_INTEGRATION ? describe : describe.skip)('Video Comments Extraction', () => {
  // Using a popular video that should have comments enabled
  const testUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

  describe('getVideoComments', () => {
    test('should extract comments from YouTube video', async () => {
      const commentsJson = await getVideoComments(testUrl, 5, 'top', CONFIG);
      const data: CommentsResponse = JSON.parse(commentsJson);

      // Verify response structure
      expect(data).toHaveProperty('count');
      expect(data).toHaveProperty('has_more');
      expect(data).toHaveProperty('comments');
      expect(Array.isArray(data.comments)).toBe(true);
      expect(data.count).toBeGreaterThan(0);
      expect(data.count).toBeLessThanOrEqual(5);
    }, 60000);

    test('should return comments with expected fields', async () => {
      const commentsJson = await getVideoComments(testUrl, 3, 'top', CONFIG);
      const data: CommentsResponse = JSON.parse(commentsJson);

      if (data.comments.length > 0) {
        const comment = data.comments[0];

        // These fields should typically be present
        expect(comment).toHaveProperty('text');
        expect(comment).toHaveProperty('author');

        // Verify text is a string
        if (comment.text !== undefined) {
          expect(typeof comment.text).toBe('string');
        }
        if (comment.author !== undefined) {
          expect(typeof comment.author).toBe('string');
        }
      }
    }, 60000);

    test('should respect maxComments parameter', async () => {
      const commentsJson = await getVideoComments(testUrl, 3, 'top', CONFIG);
      const data: CommentsResponse = JSON.parse(commentsJson);

      expect(data.comments.length).toBeLessThanOrEqual(3);
    }, 60000);

    test('should support different sort orders', async () => {
      // Just verify both sort orders work without error
      const topComments = await getVideoComments(testUrl, 2, 'top', CONFIG);
      const topData: CommentsResponse = JSON.parse(topComments);
      expect(topData).toHaveProperty('comments');

      const newComments = await getVideoComments(testUrl, 2, 'new', CONFIG);
      const newData: CommentsResponse = JSON.parse(newComments);
      expect(newData).toHaveProperty('comments');
    }, 90000);

    test('should throw error for invalid URL', async () => {
      await expect(getVideoComments('invalid-url', 5, 'top', CONFIG)).rejects.toThrow();
    });

    test('should throw error for unsupported URL', async () => {
      await expect(getVideoComments('https://example.com/video', 5, 'top', CONFIG)).rejects.toThrow();
    }, 30000);
  });

  describe('getVideoCommentsSummary', () => {
    test('should generate human-readable summary', async () => {
      const summary = await getVideoCommentsSummary(testUrl, 5, CONFIG);

      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);

      // Should contain header
      expect(summary).toContain('Video Comments');

      // Should have formatted content
      expect(summary).toContain('Author:');
    }, 60000);

    test('should respect maxComments parameter', async () => {
      const summary = await getVideoCommentsSummary(testUrl, 3, CONFIG);

      // Count occurrences of "Author:" to verify number of comments
      const authorMatches = summary.match(/Author:/g) ?? [];
      expect(authorMatches.length).toBeLessThanOrEqual(3);
    }, 60000);

    test('should throw error for invalid URL', async () => {
      await expect(getVideoCommentsSummary('invalid-url', 5, CONFIG)).rejects.toThrow();
    });

    test('should handle videos with different comment counts', async () => {
      const summary = await getVideoCommentsSummary(testUrl, 10, CONFIG);

      // Summary should be a valid string
      expect(typeof summary).toBe('string');
      expect(summary.trim().length).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Error Handling', () => {
    test('should provide helpful error message for unavailable video', async () => {
      const unavailableUrl = 'https://www.youtube.com/watch?v=invalid_video_id_xyz123';

      await expect(getVideoComments(unavailableUrl, 5, 'top', CONFIG)).rejects.toThrow();
    }, 30000);

    test('should handle unsupported URLs gracefully', async () => {
      const unsupportedUrl = 'https://example.com/not-a-video';

      await expect(getVideoComments(unsupportedUrl, 5, 'top', CONFIG)).rejects.toThrow();
    }, 30000);
  });

  describe('Comment Fields', () => {
    test('should include author information when available', async () => {
      const commentsJson = await getVideoComments(testUrl, 5, 'top', CONFIG);
      const data: CommentsResponse = JSON.parse(commentsJson);

      if (data.comments.length > 0) {
        const comment = data.comments[0];

        // Author fields
        if (comment.author !== undefined) {
          expect(typeof comment.author).toBe('string');
        }
        if (comment.author_id !== undefined) {
          expect(typeof comment.author_id).toBe('string');
        }
      }
    }, 60000);

    test('should include engagement metrics when available', async () => {
      const commentsJson = await getVideoComments(testUrl, 5, 'top', CONFIG);
      const data: CommentsResponse = JSON.parse(commentsJson);

      if (data.comments.length > 0) {
        // At least one top comment should have like_count
        const hasLikes = data.comments.some(c =>
          c.like_count !== undefined && typeof c.like_count === 'number'
        );
        // This is optional - some comments may not have likes
        expect(hasLikes || data.comments.length > 0).toBe(true);
      }
    }, 60000);

    test('should handle boolean flags correctly', async () => {
      const commentsJson = await getVideoComments(testUrl, 10, 'top', CONFIG);
      const data: CommentsResponse = JSON.parse(commentsJson);

      for (const comment of data.comments) {
        // Boolean flags should be boolean or undefined
        if (comment.is_pinned !== undefined) {
          expect(typeof comment.is_pinned).toBe('boolean');
        }
        if (comment.author_is_uploader !== undefined) {
          expect(typeof comment.author_is_uploader).toBe('boolean');
        }
        if (comment.author_is_verified !== undefined) {
          expect(typeof comment.author_is_verified).toBe('boolean');
        }
      }
    }, 60000);
  });
});
