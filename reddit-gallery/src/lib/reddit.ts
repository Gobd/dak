import type { Post } from '../types';

export interface FetchPostsResult {
  posts: Post[];
  after: string | null;
}

export function formatNumber(num: number): string {
  return num >= 1000 ? (num / 1000).toFixed(1) + 'k' : String(num);
}

function filterAndMap(children: unknown[], includeTextOnly = false): Post[] {
  return (children as Array<{ data: Record<string, unknown> }>)
    .filter((child) => {
      const d = child.data;
      const url = d.url as string | undefined;
      if (!url) return false;
      if (d.is_video && (d.media as Record<string, unknown> | undefined)?.reddit_video) return true;
      if ((d.preview as Record<string, unknown> | undefined)?.reddit_video_preview) return true;
      if (/\.(mp4|webm)$/i.test(url)) return true;
      if (/\.(jpeg|jpg|gif|png|webp)$/i.test(url)) return true;
      if ((d.preview as Record<string, unknown> | undefined)?.images) return true;
      if (d.gallery_data && d.media_metadata) return true;
      if (includeTextOnly && d.is_self) return true;
      return false;
    })
    .map((child) => {
      const d = child.data;
      let type: Post['type'] = 'image';
      let mediaUrl = d.url as string;
      const sourceUrl = d.url as string;

      const redditVideo = (d.media as Record<string, unknown> | undefined)?.reddit_video as
        | Record<string, unknown>
        | undefined;
      const videoPreview = (d.preview as Record<string, unknown> | undefined)
        ?.reddit_video_preview as Record<string, unknown> | undefined;

      // Multi-image gallery post
      if (d.gallery_data && d.media_metadata) {
        const galleryData = d.gallery_data as { items: Array<{ media_id: string }> };
        const mediaMetadata = d.media_metadata as Record<
          string,
          { status: string; e: string; s?: { u?: string; gif?: string } }
        >;
        const galleryImages = galleryData.items
          .map((item) => {
            const meta = mediaMetadata[item.media_id];
            if (!meta || meta.status !== 'valid') return null;
            const src = meta.s?.gif ?? meta.s?.u ?? null;
            return src ? src.replace(/&amp;/g, '&') : null;
          })
          .filter((url): url is string => url !== null);

        return {
          id: d.id as string,
          title: d.title as string,
          mediaUrl: galleryImages[0] ?? '',
          type: 'gallery' as const,
          permalink: d.permalink as string,
          ups: d.ups as number,
          numComments: d.num_comments as number,
          author: d.author as string,
          galleryImages,
        };
      }

      if (d.is_self) {
        type = 'text';
        mediaUrl = '';
      } else if (d.is_video && redditVideo?.fallback_url) {
        type = 'video';
        mediaUrl = redditVideo.fallback_url as string;
      } else if (videoPreview?.fallback_url) {
        type = 'video';
        mediaUrl = videoPreview.fallback_url as string;
      } else if (/\.(mp4|webm)$/i.test(mediaUrl)) {
        type = 'video';
      } else if (!/\.(jpeg|jpg|gif|png|webp)$/i.test(mediaUrl)) {
        const preview = d.preview as Record<string, unknown> | undefined;
        const images = preview?.images as Array<{ source: { url: string } }> | undefined;
        if (images?.length) {
          mediaUrl = images[0].source.url.replace(/&amp;/g, '&');
        }
      }

      return {
        id: d.id as string,
        title: d.title as string,
        mediaUrl,
        type,
        permalink: d.permalink as string,
        ups: d.ups as number,
        numComments: d.num_comments as number,
        selftext: d.is_self ? (d.selftext as string | undefined) : undefined,
        author: d.author as string,
        ...(sourceUrl !== mediaUrl ? { sourceUrl } : {}),
      };
    });
}

function makeHeaders(apiKey: string, oauthToken: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (apiKey) headers['X-Reddit-Key'] = apiKey;
  if (oauthToken) headers['X-Reddit-Token'] = oauthToken;
  return headers;
}

export async function fetchPosts(
  subreddit: string,
  sort: string,
  after: string | null,
  apiKey: string,
  oauthToken: string,
  includeTextOnly = false,
): Promise<FetchPostsResult> {
  const targetSub = subreddit.replace(/\s+/g, '').replace(/,/g, '+');
  const sortPath = sort && sort !== 'hot' ? `/${sort}` : '';
  let url = `/api/reddit/${targetSub}${sortPath}?limit=25`;
  if (after) url += `&after=${after}`;

  const response = await fetch(url, { headers: makeHeaders(apiKey, oauthToken) });

  if (!response.ok) {
    const status = response.status;
    if (status === 401 && (apiKey || oauthToken)) throw new Error('AUTH_EXPIRED');
    throw new Error(`Reddit fetch failed: ${status}`);
  }

  const json = (await response.json()) as {
    data: { children: unknown[]; after: string | null };
  };

  if (!json.data?.children) throw new Error('Invalid response from Reddit');

  const posts = filterAndMap(json.data.children, includeTextOnly);
  return { posts, after: json.data.after ?? null };
}

export async function fetchUserPosts(
  username: string,
  sort: string,
  after: string | null,
  apiKey: string,
  oauthToken: string,
  includeTextOnly = false,
): Promise<FetchPostsResult> {
  // submitted = posts only (not comments)
  const sortPath = sort && sort !== 'hot' ? `/${sort}` : '';
  let url = `/api/reddit/${username}/submitted${sortPath}?target=user&limit=25`;
  if (after) url += `&after=${after}`;

  const response = await fetch(url, { headers: makeHeaders(apiKey, oauthToken) });

  if (!response.ok) {
    const status = response.status;
    if (status === 401 && (apiKey || oauthToken)) throw new Error('AUTH_EXPIRED');
    throw new Error(`Reddit fetch failed: ${status}`);
  }

  const json = (await response.json()) as {
    data: { children: unknown[]; after: string | null };
  };

  if (!json.data?.children) throw new Error('Invalid response from Reddit');

  const posts = filterAndMap(json.data.children, includeTextOnly);
  return { posts, after: json.data.after ?? null };
}
