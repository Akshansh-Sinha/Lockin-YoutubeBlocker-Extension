export type YouTubeEntryType = 'video' | 'playlist';

export function buildYouTubeUrl(type: YouTubeEntryType, id: string): string {
  const encodedId = encodeURIComponent(id);
  return type === 'video'
    ? `https://www.youtube.com/watch?v=${encodedId}`
    : `https://www.youtube.com/playlist?list=${encodedId}`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cleanYouTubeTitle(title: string): string | undefined {
  const cleaned = decodeHtmlEntities(title)
    .replace(/\s+-\s+YouTube$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || undefined;
}

async function fetchOEmbedTitle(url: string): Promise<string | undefined> {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;

  const response = await fetch(endpoint);
  if (!response.ok) {
    return undefined;
  }

  const data = await response.json() as { title?: unknown };
  return typeof data.title === 'string' ? cleanYouTubeTitle(data.title) : undefined;
}

async function fetchPageTitle(url: string): Promise<string | undefined> {
  const response = await fetch(url);
  if (!response.ok) {
    return undefined;
  }

  const html = await response.text();
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? cleanYouTubeTitle(match[1]) : undefined;
}

export async function fetchYouTubeTitle(type: YouTubeEntryType, id: string): Promise<string | undefined> {
  const url = buildYouTubeUrl(type, id);

  try {
    return await fetchOEmbedTitle(url) ?? await fetchPageTitle(url);
  } catch (error) {
    console.warn('[Lockin] Could not fetch YouTube title:', error);
    return undefined;
  }
}
