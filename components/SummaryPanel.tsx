"use client";

import { useState } from "react";
import { postJson } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { Summary, Video } from "@/lib/types";
import { formatTime } from "@/lib/url";
import { ErrorNote } from "./Chrome";

export default function SummaryPanel({
  video,
  onSeek,
}: {
  video: Video;
  onSeek: (sec: number) => void;
}) {
  const summary = useStore((s) => s.summaries[video.id]);
  const setSummary = useStore((s) => s.setSummary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<Summary>("/api/ai/summary", {
        video: { id: video.id, title: video.title, durationSec: video.durationSec },
      });
      setSummary(video.id, result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted">
          Get the key points of this lecture, each linked to where it is explained.
        </p>
        <button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>
          {busy ? "Summarising…" : "Summarise this lesson"}
        </button>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed">{summary.recap}</p>
      <div>
        <h3 className="text-sm font-semibold">Key points</h3>
        <ul className="mt-2 flex flex-col gap-2.5">
          {summary.keyPoints.map((k, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm">
              <button
                type="button"
                className="ts mt-0.5 shrink-0"
                onClick={() => onSeek(k.timeSec)}
                aria-label={`Jump to ${formatTime(k.timeSec)}`}
              >
                {formatTime(k.timeSec)}
              </button>
              <span>{k.text}</span>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className="btn self-start" onClick={generate} disabled={busy}>
        {busy ? "Summarising…" : "Regenerate"}
      </button>
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
