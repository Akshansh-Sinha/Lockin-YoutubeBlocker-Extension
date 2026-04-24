import type { SignalProducer, Signal, DecisionInput } from '@/core/engine';
import { buildYouTubeUrl } from '@/youtube/metadata';

interface OEmbedResponse {
  title?: string;
  author_name?: string;
}

/**
 * Producer that fetches video metadata via YouTube's oEmbed endpoint.
 * Caches results in chrome.storage.session to prevent redundant requests.
 */
export const MetadataProducer: SignalProducer = {
  name: 'metadata',
  produce: async (input: DecisionInput): Promise<Signal[]> => {
    const { videoId } = input.ctx;
    if (!videoId) return [];

    const cacheKey = `metadata:video:${videoId}`;
    const signals: Signal[] = [];

    try {
      // 1. Check session cache first
      if (chrome?.storage?.session) {
        const cached = await chrome.storage.session.get(cacheKey);
        if (cached[cacheKey]) {
          return cached[cacheKey] as Signal[];
        }
      }

      // 2. Cache miss, fetch via oEmbed
      const url = buildYouTubeUrl('video', videoId);
      const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as OEmbedResponse;
      
      if (typeof data.title === 'string') {
        signals.push(`metadata:title:${data.title}`);
      }
      if (typeof data.author_name === 'string') {
        signals.push(`metadata:author:${data.author_name}`);
      }

      // 3. Store in session cache
      if (chrome?.storage?.session && signals.length > 0) {
        await chrome.storage.session.set({ [cacheKey]: signals });
      }

      return signals;
    } catch (err) {
      console.warn('[Lockin] MetadataProducer failed:', err);
      return [];
    }
  }
};
