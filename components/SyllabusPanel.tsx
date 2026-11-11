"use client";

import Link from "next/link";
import { displayChapters, useStore } from "@/lib/store";
import type { Course } from "@/lib/types";
import { formatDuration } from "@/lib/url";

export default function SyllabusPanel({
  course,
  done,
  currentVideoId,
}: {
  course: Course;
  done: Record<string, boolean>;
  currentVideoId?: string;
}) {
  const setDone = useStore((s) => s.setDone);
  const byId = new Map(course.videos.map((v) => [v.id, v]));
  const chapters = displayChapters(course);
  const showHeadings = chapters.length > 1;

  return (
    <div className="flex flex-col gap-4">
      {chapters.map((chapter, ci) => {
        const finished = chapter.videoIds.filter((id) => done[id]).length;
        return (
          <section key={`${ci}-${chapter.title}`}>
            {showHeadings && (
              <h3 className="mb-1 flex items-baseline justify-between gap-3 px-1 text-sm font-semibold">
                <span>
                  {ci + 1}. {chapter.title}
                </span>
                <span className="shrink-0 text-xs font-normal text-muted">
                  {finished}/{chapter.videoIds.length}
                </span>
              </h3>
            )}
            <ol>
              {chapter.videoIds.map((id) => {
                const v = byId.get(id);
                if (!v) return null;
                const current = id === currentVideoId;
                return (
                  <li
                    key={id}
                    className={`flex items-start gap-2.5 rounded-lg px-2 py-2 ${
                      current ? "bg-accent-soft" : "hover:bg-surface-2"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-(--accent)"
                      checked={!!done[id]}
                      onChange={(e) => setDone(course.id, id, e.target.checked)}
                      aria-label={`Mark "${v.title}" as done`}
                    />
                    <Link
                      href={`/course/${course.id}/watch/${id}`}
                      aria-current={current ? "true" : undefined}
                      className={`min-w-0 flex-1 text-sm leading-snug hover:underline ${
                        done[id] && !current ? "text-muted" : ""
                      } ${current ? "font-medium" : ""}`}
                    >
                      <span className="text-muted">{v.position + 1}.</span> {v.title}
                    </Link>
                    <span className="shrink-0 font-mono text-xs text-muted">
                      {formatDuration(v.durationSec)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
