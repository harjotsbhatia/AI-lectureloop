"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { postJson } from "@/lib/api";
import { localDate } from "@/lib/planner";
import { useStore } from "@/lib/store";
import type { SearchResult } from "@/lib/types";
import { formatDuration, thumbnailUrl } from "@/lib/url";
import { ErrorNote } from "./Chrome";

/** Search limited to YouTube's Education category; a result opens as a one-lesson course. */
export default function SearchPanel() {
  const router = useRouter();
  const addCourse = useStore((s) => s.addCourse);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searched, setSearched] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2 || busy) return;
    setError(null);
    setBusy(true);
    try {
      const data = await postJson<{ results: SearchResult[] }>("/api/search", { query: q });
      setResults(data.results);
      setSearched(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function open(r: SearchResult) {
    if (!useStore.getState().courses[r.id]) {
      addCourse(
        {
          id: r.id,
          kind: "video",
          title: r.title,
          channel: r.channel,
          videos: [{ id: r.id, title: r.title, durationSec: r.durationSec, position: 0 }],
        },
        localDate(),
      );
    }
    router.push(`/course/${r.id}/watch/${r.id}`);
  }

  return (
    <section aria-labelledby="search-heading" className="mb-14">
      <h2 id="search-heading" className="text-lg font-semibold">
        Find a lesson
      </h2>
      <p className="mt-1 text-sm text-muted">
        Only educational videos are searched: ones filed under Education that YouTube also
        labels as knowledge content. Anything else is left out.
      </p>
      <form onSubmit={onSubmit} role="search" className="mt-4 flex max-w-2xl flex-col gap-2 sm:flex-row">
        <label htmlFor="search" className="sr-only">
          Search educational videos
        </label>
        <input
          id="search"
          type="search"
          className="field h-11 flex-1"
          placeholder="e.g. linear algebra eigenvalues"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={120}
          autoComplete="off"
        />
        <button className="btn h-11 px-5" disabled={busy || query.trim().length < 2}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>
      {error && (
        <div className="mt-4 max-w-2xl">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      {results && results.length === 0 && !error && (
        <p className="mt-4 text-sm text-muted">
          No educational videos found for “{searched}”. Try different words.
        </p>
      )}
      {results && results.length > 0 && (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={`Results for ${searched}`}>
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => open(r)}
                className="card flex h-full w-full flex-col overflow-hidden text-left hover:border-accent"
              >
                <Image
                  src={thumbnailUrl(r.id)}
                  alt=""
                  width={320}
                  height={180}
                  className="aspect-video w-full bg-surface-2 object-cover"
                />
                <span className="block p-4">
                  <span className="line-clamp-2 font-medium leading-snug">{r.title}</span>
                  <span className="mt-1 block text-sm text-muted">
                    {r.channel} · {formatDuration(r.durationSec)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
