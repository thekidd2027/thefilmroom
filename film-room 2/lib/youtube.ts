// lib/youtube.ts
//
// Real calls to YouTube Data API v3. This module only ever returns metadata
// (title, channel, view counts, publish time) used for discovery and
// scoring — it never downloads video bytes. What a human does with a given
// video (embed it, license it, or skip it) is enforced by the
// mediaSourcing rule in the Brand Brain and reviewed by a human on Today
// before anything is assigned to an editor.

const YT_BASE = "https://www.googleapis.com/youtube/v3";

function key() {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new Error("Missing YOUTUBE_API_KEY env var.");
  return k;
}

export type YouTubeSearchResult = {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  description: string;
};

export async function searchRecentVideos(
  query: string,
  opts: { publishedAfter?: string; maxResults?: number } = {}
): Promise<YouTubeSearchResult[]> {
  const params = new URLSearchParams({
    key: key(),
    part: "snippet",
    q: query,
    type: "video",
    order: "viewCount",
    maxResults: String(opts.maxResults ?? 10),
  });
  if (opts.publishedAfter) params.set("publishedAfter", opts.publishedAfter);

  const res = await fetch(`${YT_BASE}/search?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`YouTube search.list failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();

  return (data.items ?? []).map((item: any) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    description: item.snippet.description,
  }));
}

export type VideoStats = {
  videoId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  durationSeconds: number;
};

// Batches up to 50 IDs per call, per the documented videos.list limit.
export async function getVideoStats(videoIds: string[]): Promise<VideoStats[]> {
  const out: VideoStats[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      key: key(),
      part: "statistics,contentDetails",
      id: batch.join(","),
    });
    const res = await fetch(`${YT_BASE}/videos?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`YouTube videos.list failed: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();
    for (const item of data.items ?? []) {
      out.push({
        videoId: item.id,
        viewCount: Number(item.statistics?.viewCount ?? 0),
        likeCount: Number(item.statistics?.likeCount ?? 0),
        commentCount: Number(item.statistics?.commentCount ?? 0),
        durationSeconds: parseISODuration(item.contentDetails?.duration ?? "PT0S"),
      });
    }
  }
  return out;
}

function parseISODuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (Number(h ?? 0) * 3600) + (Number(m ?? 0) * 60) + Number(s ?? 0);
}
