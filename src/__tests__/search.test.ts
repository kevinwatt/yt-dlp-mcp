// @ts-nocheck
// @jest-environment node
import { describe, test, expect } from '@jest/globals';
import { searchVideos } from '../modules/search.js';
import { CONFIG } from '../config.js';

describe('Search functionality tests', () => {

  describe('searchVideos', () => {
    test('should successfully search for JavaScript tutorials', async () => {
      const result = await searchVideos('javascript tutorial', 3, 0, 'markdown', CONFIG);

      expect(result).toContain('Found 3 videos');
      expect(result).toContain('Channel:');
      expect(result).toContain('Duration:');
      expect(result).toContain('URL:');
      expect(result).toContain('ID:');
      expect(result).toContain('https://www.youtube.com/watch?v=');
      expect(result).toContain('You can use any URL to download videos, audio, or subtitles!');
    }, 30000); // Increase timeout for real network calls

    test('should reject empty search queries', async () => {
      await expect(searchVideos('', 10, 0, 'markdown', CONFIG)).rejects.toThrow('Search query cannot be empty');
      await expect(searchVideos('   ', 10, 0, 'markdown', CONFIG)).rejects.toThrow('Search query cannot be empty');
    });

    test('should validate maxResults parameter range', async () => {
      await expect(searchVideos('test', 0, 0, 'markdown', CONFIG)).rejects.toThrow('Number of results must be between 1 and 50');
      await expect(searchVideos('test', 51, 0, 'markdown', CONFIG)).rejects.toThrow('Number of results must be between 1 and 50');
    });

    test('should handle search with different result counts', async () => {
      const result1 = await searchVideos('python programming', 1, 0, 'markdown', CONFIG);
      const result5 = await searchVideos('python programming', 5, 0, 'markdown', CONFIG);

      expect(result1).toContain('Found 1 video');
      expect(result5).toContain('Found 5 videos');

      // Count number of video entries (each video has a numbered entry)
      const count1 = (result1.match(/^\d+\./gm) || []).length;
      const count5 = (result5.match(/^\d+\./gm) || []).length;

      expect(count1).toBe(1);
      expect(count5).toBe(5);
    }, 30000);

    test('should return properly formatted results', async () => {
      const result = await searchVideos('react tutorial', 2, 0, 'markdown', CONFIG);

      // Check for proper formatting
      expect(result).toMatch(/Found \d+ videos?:/);
      expect(result).toMatch(/\d+\. \*\*.*\*\*/); // Numbered list with bold titles
      expect(result).toMatch(/📺 Channel: .+/);
      expect(result).toMatch(/⏱️  Duration: .+/);
      expect(result).toMatch(/🔗 URL: https:\/\/www\.youtube\.com\/watch\?v=.+/);
      expect(result).toMatch(/🆔 ID: .+/);
    }, 30000);

    test('should handle obscure search terms gracefully', async () => {
      // Using a very specific and unlikely search term
      const result = await searchVideos('asdfghjklqwertyuiopzxcvbnm12345', 1, 0, 'markdown', CONFIG);

      // Even obscure terms should return some results, as YouTube's search is quite broad
      // But if no results, it should be handled gracefully
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }, 30000);
  });
}); 