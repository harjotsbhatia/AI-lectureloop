import "server-only";
import type { ImportedCourse, SearchResult, Video } from "./types";
import { parseIsoDuration, type ParsedSource } from "./url";

const API = "https://www.googleapis.com/youtube/v3";
const MAX_VIDEOS = 500;

/** An error whose message is safe to show to the user */
export class UserError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function apiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new UserError(
      "No YouTube API key is set. Add YOUTUBE_API_KEY to .env.local and restart the dev server.",
      500,
    );
  }
  return key;
}

async function yt<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: apiKey() });
  const res = await fetch(`${API}/${path}?${qs}`, { cache: "no-store" });
  if (!res.ok) {
    let reason = `YouTube API error (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) reason = `YouTube API: ${body.error.message}`;
    } catch {
      // keep the generic reason
    }
    throw new UserError(reason, res.status === 404 ? 404 : 502);
  }
  return (await res.json()) as T;
}

interface VideosResponse {
  items: {
    id: string;
    snippet: { title: string; channelTitle: string; categoryId?: string };
    contentDetails: { duration: string };
    topicDetails?: { topicCategories?: string[] };
  }[];
}

type FetchedVideo = Video & { channel: string; categoryId: string; topics: string[] };

async function fetchVideos(ids: string[]): Promise<FetchedVideo[]> {
  const out: FetchedVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const data = await yt<VideosResponse>("videos", {
      part: "snippet,contentDetails,topicDetails",
      id: ids.slice(i, i + 50).join(","),
      maxResults: "50",
    });
    for (const item of data.items) {
      out.push({
        id: item.id,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        categoryId: item.snippet.categoryId ?? "",
        // Topic labels are Wikipedia URLs; keep the last path segment, e.g. "Knowledge".
        topics: (item.topicDetails?.topicCategories ?? []).map((u) => u.split("/").pop() ?? ""),
        durationSec: parseIsoDuration(item.contentDetails.duration),
        position: 0,
      });
    }
  }
  // Keep playlist order; drop private, deleted and not-yet-live videos.
  const byId = new Map(out.map((v) => [v.id, v]));
  return ids
    .map((id) => byId.get(id))
    .filter((v): v is FetchedVideo => !!v && v.durationSec > 0)
    .map((v, i) => ({ ...v, position: i }));
}

/** YouTube's category id for "Education". Uploaders pick a video's category themselves. */
const EDUCATION_CATEGORY = "27";
/** YouTube's "Knowledge" topic, which YouTube assigns from the video's content. */
const KNOWLEDGE_TOPIC_ID = "/m/01k8wb";
const KNOWLEDGE_TOPIC = "Knowledge";

/**
 * The app's one rule for what counts as educational: the uploader filed the video under
 * Education, and YouTube itself labelled it with the Knowledge topic. The category alone
 * is not enough, because anyone can file a cat compilation under Education.
 */
function isEducational(v: FetchedVideo): boolean {
  return v.categoryId === EDUCATION_CATEGORY && v.topics.includes(KNOWLEDGE_TOPIC);
}

export async function importSource(source: ParsedSource): Promise<ImportedCourse> {
  if (source.kind === "video") {
    const [video] = await fetchVideos([source.id]);
    if (!video) throw new UserError("That video could not be found, or it is private.", 404);
    if (!isEducational(video)) {
      throw new UserError(
        "That video isn't an educational one, so it can't be added. Only videos filed under Education that YouTube labels as knowledge content are allowed.",
        422,
      );
    }
    return {
      id: source.id,
      kind: "video",
      title: video.title,
      channel: video.channel,
      videos: [{ id: video.id, title: video.title, durationSec: video.durationSec, position: 0 }],
    };
  }

  const meta = await yt<{
    items: { snippet: { title: string; channelTitle: string } }[];
  }>("playlists", { part: "snippet", id: source.id });
  if (meta.items.length === 0) {
    throw new UserError("That playlist could not be found, or it is private.", 404);
  }

  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = await yt<{
      items: { contentDetails: { videoId: string } }[];
      nextPageToken?: string;
    }>("playlistItems", {
      part: "contentDetails",
      playlistId: source.id,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    ids.push(...page.items.map((i) => i.contentDetails.videoId));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < MAX_VIDEOS);

  const playable = await fetchVideos([...new Set(ids)].slice(0, MAX_VIDEOS));
  if (playable.length === 0) throw new UserError("That playlist has no playable videos.", 404);
  // Only educational videos are kept; the rest of the playlist is left out.
  const videos = playable.filter(isEducational).map((v, i) => ({ ...v, position: i }));
  if (videos.length === 0) {
    throw new UserError(
      "None of the videos in that playlist are educational, so it can't be added.",
      422,
    );
  }

  return {
    id: source.id,
    kind: "playlist",
    title: meta.items[0].snippet.title,
    channel: meta.items[0].snippet.channelTitle,
    skipped: playable.length - videos.length,
    videos: videos.map((v) => ({
      id: v.id,
      title: v.title,
      durationSec: v.durationSec,
      position: v.position,
    })),
  };
}

/**
 * Searches YouTube for educational videos only. The Education and Knowledge filters
 * go to YouTube's search, and every result is checked again with isEducational,
 * so nothing else is ever returned.
 * One search costs 100 of the key's 10,000 daily quota units.
 */
export async function searchEducational(query: string): Promise<SearchResult[]> {
  const found = await yt<{ items: { id: { videoId?: string } }[] }>("search", {
    part: "id",
    type: "video",
    q: query,
    videoCategoryId: EDUCATION_CATEGORY,
    topicId: KNOWLEDGE_TOPIC_ID,
    safeSearch: "strict",
    videoEmbeddable: "true",
    maxResults: "24",
  });
  const ids = found.items.map((i) => i.id.videoId).filter((id): id is string => !!id);
  if (ids.length === 0) return [];
  const videos = await fetchVideos([...new Set(ids)]);
  return videos
    .filter(isEducational)
    .map((v) => ({ id: v.id, title: v.title, channel: v.channel, durationSec: v.durationSec }));
}
