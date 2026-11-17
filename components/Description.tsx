"use client";

import { type ReactNode, useEffect, useState } from "react";
import { parseTime } from "@/lib/url";

/** Descriptions already loaded in this tab, so going back to a lesson doesn't refetch. */
const loaded = new Map<string, string>();

/** URLs, and timestamps like 4:05 or 1:02:05 (the chapter lists many lecturers post). */
const TOKEN = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])|(?<![\d:])((?:\d{1,2}:)?\d{1,2}:\d{2})(?![\d:])/g;

function linkify(text: string, durationSec: number, onSeek: (sec: number) => void): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const [whole, url, time] = m;
    const sec = time ? parseTime(time) : null;
    // A "time" past the end of the video is something else, such as a ratio.
    if (time && (sec === null || (durationSec > 0 && sec > durationSec))) continue;
    out.push(text.slice(last, m.index));
    out.push(
      url ? (
        <a key={m.index} href={url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          {url}
        </a>
      ) : (
        <button key={m.index} type="button" className="ts" onClick={() => onSeek(sec!)}>
          {time}
        </button>
      ),
    );
    last = m.index + whole.length;
  }
  out.push(text.slice(last));
  return out;
}

export default function Description({
  videoId,
  durationSec,
  onSeek,
}: {
  videoId: string;
  durationSec: number;
  onSeek: (sec: number) => void;
}) {
  const [text, setText] = useState<string | null>(() => loaded.get(videoId) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loaded.has(videoId)) return;
    let cancelled = false;
    fetch(`/api/description?id=${videoId}`)
      .then(async (res) => {
        const body = (await res.json()) as { description?: string; error?: string };
        if (!res.ok) throw new Error(body.error ?? "Could not load the description.");
        return body.description ?? "";
      })
      .then((d) => {
        loaded.set(videoId, d);
        if (!cancelled) setText(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load the description.");
      });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  if (error) return <p className="mt-4 text-sm text-muted">Description unavailable: {error}</p>;
  if (text === null) return <p className="mt-4 text-sm text-muted">Loading description…</p>;
  if (!text) return null;

  const long = text.length > 280 || text.split("\n").length > 4;
  return (
    <section className="card mt-4 p-4" aria-label="Video description">
      <h2 className="mb-2 text-sm font-semibold">Description</h2>
      <div
        className={`whitespace-pre-wrap break-words text-sm leading-relaxed text-muted ${
          long && !open ? "line-clamp-4" : ""
        }`}
      >
        {linkify(text, durationSec, onSeek)}
      </div>
      {long && (
        <button
          type="button"
          className="mt-2 text-sm font-medium text-ink hover:underline"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </section>
  );
}
