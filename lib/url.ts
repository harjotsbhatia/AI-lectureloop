export type ParsedSource =
  | { kind: "playlist"; id: string }
  | { kind: "video"; id: string };

const VIDEO_ID = /^[\w-]{11}$/;
// Mixes ("RD…") are generated per viewer and cannot be read through the Data API.
const PLAYLIST_ID = /^(PL|UU|LL|FL|OL)[\w-]{10,}$/;

/** Accepts a playlist or video URL (or bare id). A URL with a `list` param is treated as a playlist. */
export function parseYouTubeUrl(input: string): ParsedSource | null {
  const raw = input.trim();
  if (!raw) return null;
  if (PLAYLIST_ID.test(raw)) return { kind: "playlist", id: raw };
  if (VIDEO_ID.test(raw)) return { kind: "video", id: raw };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
  const isShort = host === "youtu.be";
  if (!isShort && host !== "youtube.com" && host !== "youtube-nocookie.com") {
    return null;
  }

  const list = url.searchParams.get("list");
  if (list && PLAYLIST_ID.test(list)) return { kind: "playlist", id: list };

  if (isShort) {
    const id = url.pathname.split("/")[1] ?? "";
    return VIDEO_ID.test(id) ? { kind: "video", id } : null;
  }
  const v = url.searchParams.get("v");
  if (v && VIDEO_ID.test(v)) return { kind: "video", id: v };
  const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})(?:\/|$)/);
  return m ? { kind: "video", id: m[1] } : null;
}

/** 3725 → "1:02:05", 125 → "2:05" */
export function formatTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** 203400 → "56h 30m", 180 → "3m" */
export function formatDuration(totalSec: number): string {
  const mins = Math.max(0, Math.round(totalSec / 60));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "1:02:05" or "2:05" → seconds; null if not a timestamp */
export function parseTime(text: string): number | null {
  const m = text.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** ISO-8601 duration as returned by the YouTube Data API, e.g. "PT1H2M3S" */
export function parseIsoDuration(iso: string): number {
  const m = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const [d, h, min, s] = m.slice(1).map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}
