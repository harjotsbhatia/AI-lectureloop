import "server-only";
import { fetchTranscript } from "youtube-transcript";
import { formatTime } from "./url";

export interface Segment {
  startSec: number;
  text: string;
}

const MAX_CHARS = 1_200_000;
const cache = new Map<string, Segment[] | null>();

/**
 * Captions for a video, or null when it has none (or YouTube refuses the request).
 * This reads YouTube's public caption tracks, which is unofficial and can stop working.
 */
export async function getTranscript(
  videoId: string,
  durationSec: number,
): Promise<Segment[] | null> {
  if (cache.has(videoId)) return cache.get(videoId) ?? null;
  let segments: Segment[] | null = null;
  try {
    // Without a language the library takes the first track listed, which can be a
    // translation. Prefer English, then fall back to whatever the video has.
    const raw = await fetchTranscript(videoId, { lang: "en" }).catch(() =>
      fetchTranscript(videoId),
    );
    if (raw.length > 0) {
      // The library returns milliseconds for one caption format and seconds for the other.
      const last = raw[raw.length - 1].offset;
      const inMs = durationSec > 0 ? last > durationSec * 2 : last > 43_200;
      segments = raw.map((r) => ({
        startSec: inMs ? r.offset / 1000 : r.offset,
        text: r.text.replace(/\s+/g, " ").trim(),
      }));
    }
  } catch (e) {
    console.warn(`No transcript for ${videoId}:`, e instanceof Error ? e.message : e);
  }
  if (cache.size > 200) cache.clear();
  cache.set(videoId, segments);
  return segments;
}

/** Joins caption fragments into ~30-second lines, each prefixed with its [m:ss] timestamp. */
export function transcriptToText(segments: Segment[]): string {
  const lines: string[] = [];
  let lineStart = -Infinity;
  let buf: string[] = [];
  const flush = () => {
    if (buf.length > 0) lines.push(`[${formatTime(lineStart)}] ${buf.join(" ")}`);
    buf = [];
  };
  for (const s of segments) {
    if (!s.text) continue;
    if (s.startSec - lineStart >= 30) {
      flush();
      lineStart = s.startSec;
    }
    buf.push(s.text);
  }
  flush();
  const text = lines.join("\n");
  return text.length > MAX_CHARS
    ? `${text.slice(0, MAX_CHARS)}\n[transcript cut off here because of its length]`
    : text;
}
