import { describe, it, expect } from 'vitest';
import { classifyRoute, extractVideoIdFromUrl, extractPlaylistIdFromUrl } from './classifier';

describe('classifier', () => {
  describe('classifyRoute', () => {
    it('should classify /watch?v=id as video', () => {
      const url = new URL('https://youtube.com/watch?v=dQw4w9WgXcQ');
      const result = classifyRoute(url);
      expect(result.type).toBe('video');
      expect(result.id).toBe('dQw4w9WgXcQ');
    });

    it('should classify /playlist?list=id as playlist', () => {
      const url = new URL('https://youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
      const result = classifyRoute(url);
      expect(result.type).toBe('playlist');
      expect(result.id).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
    });

    it('should classify /shorts/id as shorts', () => {
      const url = new URL('https://youtube.com/shorts/dQw4w9WgXcQ');
      const result = classifyRoute(url);
      expect(result.type).toBe('shorts');
    });

    it('should classify /results as search', () => {
      const url = new URL('https://youtube.com/results?search_query=test');
      const result = classifyRoute(url);
      expect(result.type).toBe('search');
    });

    it('should classify / as home', () => {
      const url = new URL('https://youtube.com/');
      const result = classifyRoute(url);
      expect(result.type).toBe('home');
    });

    it('should classify /feed/subscriptions as unknown', () => {
      const url = new URL('https://youtube.com/feed/subscriptions');
      const result = classifyRoute(url);
      expect(result.type).toBe('unknown');
    });
  });

  describe('extractVideoIdFromUrl', () => {
    it('should extract video ID from watch URL', () => {
      const url = 'https://youtube.com/watch?v=dQw4w9WgXcQ';
      const id = extractVideoIdFromUrl(url);
      expect(id).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtu.be shortlink', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      const id = extractVideoIdFromUrl(url);
      expect(id).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid URL', () => {
      const url = 'not a url';
      const id = extractVideoIdFromUrl(url);
      expect(id).toBeNull();
    });
  });

  describe('extractPlaylistIdFromUrl', () => {
    it('should extract playlist ID from playlist URL', () => {
      const url = 'https://youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf';
      const id = extractPlaylistIdFromUrl(url);
      expect(id).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
    });

    it('should return null if no list parameter', () => {
      const url = 'https://youtube.com/watch?v=dQw4w9WgXcQ';
      const id = extractPlaylistIdFromUrl(url);
      expect(id).toBeNull();
    });
  });
});
