"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/api";
import { courseProgress, nextVideoId, NO_DONE, useMounted, useStore } from "@/lib/store";
import type { Chapter } from "@/lib/types";
import { formatDuration } from "@/lib/url";
import { ErrorNote, PageMessage, TopBar } from "./Chrome";
import PlannerCard from "./PlannerCard";
import SyllabusPanel from "./SyllabusPanel";

export default function CourseOverview() {
  const { id } = useParams<{ id: string }>();
  const mounted = useMounted();
  const course = useStore((s) => s.courses[id]);
  const done = useStore((s) => s.done[id]) ?? NO_DONE;
  const setChapters = useStore((s) => s.setChapters);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!mounted) return <PageMessage>Loading course…</PageMessage>;
  if (!course) {
    return <PageMessage home>This course isn&apos;t saved in this browser.</PageMessage>;
  }

  const p = courseProgress(course, done);
  const next = nextVideoId(course, done);

  async function organise() {
    if (!course) return;
    setBusy(true);
    setError(null);
    try {
      const { chapters } = await postJson<{ chapters: Chapter[] }>("/api/ai/syllabus", {
        courseTitle: course.title,
        videos: course.videos.map((v) => ({
          id: v.id,
          title: v.title,
          durationSec: v.durationSec,
        })),
      });
      setChapters(course.id, chapters);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← All courses
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{course.title}</h1>
            <p className="mt-1 text-muted">
              {course.channel} · {p.total} {p.total === 1 ? "lesson" : "lessons"} ·{" "}
              {formatDuration(p.totalSec)}
            </p>
          </div>
          {next && (
            <Link href={`/course/${course.id}/watch/${next}`} className="btn btn-primary px-5">
              {p.completed === 0 ? "Start learning" : "Continue"}
            </Link>
          )}
        </div>

        <div className="mt-5 max-w-xl">
          <div className="mb-1 flex justify-between text-sm text-muted">
            <span>
              {p.completed} of {p.total} lessons done
            </span>
            <span>{p.percent}%</span>
          </div>
          <div className="bar" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${p.percent}%` }} />
          </div>
        </div>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <section className="card p-5" aria-labelledby="syllabus-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 id="syllabus-heading" className="font-semibold">
                Syllabus
              </h2>
              {course.videos.length >= 2 && (
                <div className="flex gap-2">
                  {course.chapters && (
                    <button
                      type="button"
                      className="btn btn-quiet"
                      onClick={() => setChapters(course.id, null)}
                    >
                      Remove chapters
                    </button>
                  )}
                  <button type="button" className="btn" onClick={organise} disabled={busy}>
                    {busy
                      ? "Organising…"
                      : course.chapters
                        ? "Regroup with AI"
                        : "Group into chapters with AI"}
                  </button>
                </div>
              )}
            </div>
            {error && (
              <div className="mb-4">
                <ErrorNote>{error}</ErrorNote>
              </div>
            )}
            <SyllabusPanel course={course} done={done} />
          </section>
          <PlannerCard course={course} done={done} />
        </div>
      </main>
    </>
  );
}
