/**
 * Pulls recent uploads of allowlisted channels through the YouTube Data API v3 and
 * returns the deck codes found in their descriptions. Quota: ~3 units per channel.
 * `fetchImpl` is injectable so tests never hit the network.
 */
import { findDeckstrings } from '@hsdeck/shared';

export interface YoutubeSource {
  name: string;
  channelId?: string;
  handle?: string;
  titleFilter?: string;
}

export interface FoundCode {
  source: YoutubeSource;
  videoId: string;
  title: string;
  publishedAt: string;
  code: string;
}

type Fetch = typeof fetch;
const API = 'https://www.googleapis.com/youtube/v3';

async function getJson<T>(fetchImpl: Fetch, url: string): Promise<T> {
  const res = await fetchImpl(url);
  if (!res.ok)
    throw new Error(`YouTube API ${res.status} for ${url.replace(/key=[^&]+/, 'key=…')}`);
  return (await res.json()) as T;
}

/** Resolves the channel's uploads playlist id from a channel id or @handle. */
async function uploadsPlaylist(
  fetchImpl: Fetch,
  key: string,
  src: YoutubeSource,
): Promise<string | null> {
  const selector = src.channelId
    ? `id=${encodeURIComponent(src.channelId)}`
    : src.handle
      ? `forHandle=${encodeURIComponent(src.handle)}`
      : null;
  if (!selector) return null;
  const data = await getJson<{
    items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>;
  }>(fetchImpl, `${API}/channels?part=contentDetails&${selector}&key=${key}`);
  return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

export async function collectFromYoutube(
  sources: YoutubeSource[],
  key: string,
  opts: { fetchImpl?: Fetch; perChannel?: number } = {},
): Promise<{ found: FoundCode[]; scanned: number; errors: string[] }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const perChannel = opts.perChannel ?? 10;
  const found: FoundCode[] = [];
  const errors: string[] = [];
  let scanned = 0;

  for (const src of sources) {
    try {
      const playlist = await uploadsPlaylist(fetchImpl, key, src);
      if (!playlist) {
        errors.push(`${src.name}: channel not found`);
        continue;
      }
      const items = await getJson<{
        items?: Array<{ contentDetails?: { videoId?: string } }>;
      }>(
        fetchImpl,
        `${API}/playlistItems?part=contentDetails&playlistId=${playlist}&maxResults=${perChannel}&key=${key}`,
      );
      const ids = (items.items ?? [])
        .map((i) => i.contentDetails?.videoId)
        .filter((v): v is string => Boolean(v));
      if (ids.length === 0) continue;
      const videos = await getJson<{
        items?: Array<{
          id: string;
          snippet?: { title?: string; description?: string; publishedAt?: string };
        }>;
      }>(fetchImpl, `${API}/videos?part=snippet&id=${ids.join(',')}&key=${key}`);
      const filter = src.titleFilter ? new RegExp(src.titleFilter, 'i') : null;
      for (const v of videos.items ?? []) {
        const title = v.snippet?.title ?? '';
        if (filter && !filter.test(title)) continue;
        scanned += 1;
        for (const code of findDeckstrings(v.snippet?.description ?? '')) {
          found.push({
            source: src,
            videoId: v.id,
            title,
            publishedAt: v.snippet?.publishedAt ?? '',
            code,
          });
        }
      }
    } catch (err) {
      errors.push(`${src.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { found, scanned, errors };
}
