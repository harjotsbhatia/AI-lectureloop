"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { courseProgress, NO_DONE, useMounted, useStore } from "@/lib/store";
import type { Course, Video } from "@/lib/types";
import { formatDuration } from "@/lib/url";
import { Logo, PageMessage } from "./Chrome";
import Description from "./Description";
import StudyTimer from "./StudyTimer";
import NotesPanel from "./NotesPanel";
import Player, { type PlayerHandle } from "./Player";
import QuizPanel from "./QuizPanel";
import SummaryPanel from "./SummaryPanel";
import SyllabusPanel from "./SyllabusPanel";
import TutorPanel from "./TutorPanel";

const TABS = [
  ["syllabus", "Syllabus"],
  ["notes", "Notes"],
  ["tutor", "AI Tutor"],
  ["quiz", "Quiz"],
  ["summary", "Summary"],
] as const;
type Tab = (typeof TABS)[number][0];

// Every speed YouTube's embedded player accepts; it has nothing above 2×.
const SKIP_SEC = 10;

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export default function Classroom() {
  const { id, videoId } = useParams<{ id: string; videoId: string }>();
  const mounted = useMounted();
  const course = useStore((s) => s.courses[id]);

  if (!mounted) return <PageMessage>Loading lesson…</PageMessage>;
  const video = course?.videos.find((v) => v.id === videoId);
  if (!course || !video) {
    return <PageMessage home>This lesson isn&apos;t saved in this browser.</PageMessage>;
  }
  return <Lesson key={video.id} course={course} video={video} />;
}

function Lesson({ course, video }: { course: Course; video: Video }) {
  const done = useStore((s) => s.done[course.id]) ?? NO_DONE;
  const setDone = useStore((s) => s.setDone);
  const setPosition = useStore((s) => s.setPosition);
  const setLastVideo = useStore((s) => s.setLastVideo);
  const noteCount = useStore(
    (s) => s.notes.filter((n) => n.courseId === course.id && n.videoId === video.id).length,
  );

  const player = useRef<PlayerHandle>(null);
  const autoMarked = useRef(false);
  const [tab, setTab] = useState<Tab>("syllabus");
  const [focus, setFocus] = useState(false);
  const [rate, setRate] = useState(1);
  // Resume where the student left off, unless they had all but finished.
  const [startAt] = useState(() => {
    const saved = useStore.getState().positions[video.id] ?? 0;
    return saved > video.durationSec * 0.95 ? 0 : saved;
  });

  useEffect(() => {
    setLastVideo(course.id, video.id);
  }, [course.id, video.id, setLastVideo]);

  const seek = useCallback((sec: number) => player.current?.seekTo(sec), []);
  const skip = useCallback((sec: number) => player.current?.skipBy(sec), []);

  // ← / → (or J / L, as on YouTube) jump 10 seconds, except while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return;
      const key = e.key.toLowerCase();
      const delta = key === "arrowleft" || key === "j" ? -SKIP_SEC : key === "arrowright" || key === "l" ? SKIP_SEC : 0;
      if (!delta) return;
      e.preventDefault();
      skip(delta);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skip]);
  const getTime = useCallback(() => player.current?.getCurrentTime() ?? 0, []);

  const onProgress = useCallback(
    (cur: number, dur: number) => {
      setPosition(video.id, cur);
      // Mark the lesson done once, at 90% watched; the student can still untick it.
      if (!autoMarked.current && dur > 0 && cur / dur >= 0.9) {
        autoMarked.current = true;
        setDone(course.id, video.id, true);
      }
    },
    [course.id, video.id, setDone, setPosition],
  );

  const index = course.videos.findIndex((v) => v.id === video.id);
  const prev = course.videos[index - 1];
  const next = course.videos[index + 1];
  const p = courseProgress(course, done);
  const isDone = !!done[video.id];

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
          <Logo compact />
          {/* The link is only as wide as its text, so the empty bar beside it is not clickable. */}
          <div className="hidden min-w-0 flex-1 sm:flex">
            <Link
              href={`/course/${course.id}`}
              className="truncate text-sm text-muted hover:text-ink"
            >
              ← {course.title}
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <StudyTimer />
            <span className="hidden text-sm text-muted xl:inline">{p.percent}% done</span>
            <label className="flex items-center gap-1.5 text-sm text-muted">
              <span className="sr-only sm:not-sr-only">Speed</span>
              <select
                className="field py-1.5"
                value={rate}
                onChange={(e) => {
                  const r = Number(e.target.value);
                  setRate(r);
                  player.current?.setRate(r);
                }}
              >
                {RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}×
                  </option>
                ))}
              </select>
            </label>
            {/* On phones these two don't fit beside the timer; double-tap the video for full screen. */}
            <button
              type="button"
              className="btn hidden sm:inline-flex"
              onClick={() => player.current?.toggleFullscreen()}
            >
              Full screen
            </button>
            <button
              type="button"
              className={`btn hidden sm:inline-flex ${focus ? "btn-primary" : ""}`}
              aria-pressed={focus}
              onClick={() => setFocus((f) => !f)}
            >
              Focus
            </button>
          </div>
        </div>
      </header>

      <main
        className={`mx-auto w-full flex-1 ${
          focus
            ? "max-w-5xl"
            : "max-w-[1600px] lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-start"
        }`}
      >
        <section className="p-4">
          <Link
            href={`/course/${course.id}`}
            className="mb-3 block w-fit max-w-full truncate text-sm text-muted hover:text-ink sm:hidden"
          >
            ← {course.title}
          </Link>
          <Player ref={player} videoId={video.id} startAt={startAt} onProgress={onProgress} />
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold leading-snug sm:text-xl">{video.title}</h1>
              <p className="mt-1 text-sm text-muted">
                Lesson {index + 1} of {course.videos.length} · {formatDuration(video.durationSec)}
              </p>
            </div>
            <button
              type="button"
              className={`btn ${isDone ? "" : "btn-primary"}`}
              aria-pressed={isDone}
              onClick={() => setDone(course.id, video.id, !isDone)}
            >
              {isDone ? "✓ Done" : "Mark as done"}
            </button>
          </div>
          <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="Lessons">
            {prev ? (
              <Link href={`/course/${course.id}/watch/${prev.id}`} className="btn">
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            {/* On phones the skip buttons get their own row above Previous / Next. */}
            <div className="order-first flex w-full justify-center gap-2 sm:order-none sm:w-auto">
              <button
                type="button"
                className="btn"
                onClick={() => skip(-SKIP_SEC)}
                aria-label="Back 10 seconds"
                title="Back 10 seconds (← or J)"
              >
                ↺ 10s
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => skip(SKIP_SEC)}
                aria-label="Forward 10 seconds"
                title="Forward 10 seconds (→ or L)"
              >
                10s ↻
              </button>
            </div>
            {next ? (
              <Link href={`/course/${course.id}/watch/${next.id}`} className="btn">
                Next lesson →
              </Link>
            ) : (
              <span />
            )}
          </nav>
          <Description videoId={video.id} durationSec={video.durationSec} onSeek={seek} />
        </section>

        <aside
          className={
            focus
              ? "hidden"
              : "border-t border-line bg-surface lg:sticky lg:top-14 lg:flex lg:h-[calc(100vh-3.5rem)] lg:flex-col lg:border-t-0 lg:border-l"
          }
        >
          <div role="tablist" aria-label="Study tools" className="flex overflow-x-auto border-b border-line px-2">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`tab-${key}`}
                aria-selected={tab === key}
                aria-controls={`panel-${key}`}
                onClick={() => setTab(key)}
                className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium ${
                  tab === key
                    ? "border-accent text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {label}
                {key === "notes" && noteCount > 0 && (
                  <span className="ml-1 text-xs text-muted">({noteCount})</span>
                )}
              </button>
            ))}
          </div>
          {/* All panels stay mounted so a tutor answer keeps streaming while another tab is open. */}
          {TABS.map(([key]) => (
            <div
              key={key}
              role="tabpanel"
              id={`panel-${key}`}
              aria-labelledby={`tab-${key}`}
              hidden={tab !== key}
              className="min-h-64 flex-1 overflow-y-auto p-4"
            >
              {key === "syllabus" && (
                <SyllabusPanel course={course} done={done} currentVideoId={video.id} />
              )}
              {key === "notes" && (
                <NotesPanel courseId={course.id} videoId={video.id} getTime={getTime} onSeek={seek} />
              )}
              {key === "tutor" && <TutorPanel video={video} getTime={getTime} onSeek={seek} />}
              {key === "quiz" && <QuizPanel video={video} onSeek={seek} />}
              {key === "summary" && <SummaryPanel video={video} onSeek={seek} />}
            </div>
          ))}
        </aside>
      </main>
    </>
  );
}
