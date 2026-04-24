import type { SignalProducer, Signal, DecisionInput } from '@/core/engine';
import { MetadataProducer } from './metadata';

/**
 * Producer that evaluates keywords against video metadata.
 * It leverages the MetadataProducer to get the title and author,
 * then checks them against the user's keyword settings.
 */
export const KeywordProducer: SignalProducer = {
  name: 'keyword',
  produce: async (input: DecisionInput): Promise<Signal[]> => {
    const { allowKeywords, blockKeywords } = input.settings;
    
    // Fast path: if no keywords configured, do nothing
    if (allowKeywords.length === 0 && blockKeywords.length === 0) {
      return [];
    }

    // Keyword matching requires metadata (title, author). 
    // Since producers run concurrently, we fetch it here (it's session-cached by MetadataProducer)
    const metadataSignals = await MetadataProducer.produce(input);
    
    let title = '';
    let author = '';
    
    for (const sig of metadataSignals) {
      if (sig.startsWith('metadata:title:')) {
        title = sig.slice('metadata:title:'.length).toLowerCase();
      }
      if (sig.startsWith('metadata:author:')) {
        author = sig.slice('metadata:author:'.length).toLowerCase();
      }
    }

    if (!title && !author) return [];

    const searchableText = `${title} ${author}`;
    const signals: Signal[] = [];

    // Check allow keywords first (stronger signal)
    for (const kw of allowKeywords) {
      if (searchableText.includes(kw.toLowerCase())) {
        signals.push(`keyword:allow:${kw}`);
      }
    }

    // Check block keywords
    for (const kw of blockKeywords) {
      if (searchableText.includes(kw.toLowerCase())) {
        signals.push(`keyword:block:${kw}`);
      }
    }

    return signals;
  }
};
