"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { postJson } from "@/lib/api";
import { localDate } from "@/lib/planner";
import { courseProgress, nextVideoId, NO_DONE, useMounted, useStore } from "@/lib/store";
import type { Course, ImportedCourse } from "@/lib/types";
import { formatDuration, parseYouTubeUrl, thumbnailUrl } from "@/lib/url";
import { ErrorNote, TopBar } from "./Chrome";
import SearchPanel from "./SearchPanel";

const FEATURES = [
  ["Just the lesson", "A plain player with your syllabus beside it. No feed, no comments, no autoplay."],
  ["Notes that remember where", "Every note is stamped with the moment you wrote it. Click one to jump back."],
  ["A plan you can keep", "Say how long you can study each day and see what to watch today and when you'll finish."],
  ["Help when you're stuck", "Ask the AI tutor about the lecture, get a summary, or test yourself with a quiz."],
];

export default function Home() {
  const router = useRouter();
  const mounted = useMounted();
  const courses = useStore((s) => s.courses);
  const addCourse = useStore((s) => s.addCourse);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [built, setBuilt] = useState<{ id: string; title: string; skipped: number } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBuilt(null);
    const source = parseYouTubeUrl(url);
    if (!source) {
      setError("That doesn't look like a YouTube playlist or video link.");
      return;
    }
    if (useStore.getState().courses[source.id]) {
      router.push(`/course/${source.id}`);
      return;
    }
    setBusy(true);
    try {
      const course = await postJson<ImportedCourse>("/api/playlist", { url });
      addCourse(course, localDate());
      if (course.skipped) {
        // Stay here so the student sees that part of the playlist was left out.
        setBuilt({ id: course.id, title: course.title, skipped: course.skipped });
        setUrl("");
      } else {
        router.push(`/course/${course.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const list = Object.values(courses).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-20">
        <section className="py-14 sm:py-20">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Finish the playlists you start.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Paste a YouTube playlist and study it like a course: lessons in order, progress
            tracked, notes tied to the video, and an AI tutor that has watched it too.
          </p>
          <form onSubmit={onSubmit} className="mt-8 flex max-w-2xl flex-col gap-2 sm:flex-row">
            <label htmlFor="url" className="sr-only">
              YouTube playlist or video link
            </label>
            <input
              id="url"
              className="field h-11 flex-1"
              placeholder="https://www.youtube.com/playlist?list=…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
              inputMode="url"
            />
            <button className="btn btn-primary h-11 px-5" disabled={busy || !url.trim()}>
              {busy ? "Building…" : "Build course"}
            </button>
          </form>
          <p className="mt-2 text-sm text-muted">
            A playlist becomes a full course; a single video link becomes a one-lesson course.
            Only educational videos are accepted.
          </p>
          {built && (
            <p role="status" className="card mt-4 max-w-2xl p-4 text-sm">
              “{built.title}” is ready. {built.skipped}{" "}
              {built.skipped === 1 ? "video was" : "videos were"} left out because{" "}
              {built.skipped === 1 ? "it isn't" : "they aren't"} educational.{" "}
              <Link href={`/course/${built.id}`} className="font-medium text-accent hover:underline">
                Open course
              </Link>
            </p>
          )}
          {error && (
            <div className="mt-4 max-w-2xl">
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}
        </section>

        <SearchPanel />

        {mounted && list.length > 0 && (
          <section aria-labelledby="your-courses" className="mb-14">
            <h2 id="your-courses" className="text-lg font-semibold">
              Your courses
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((c) => (
                <li key={c.id}>
                  <CourseCard course={c} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {mounted && list.length === 0 && (
          <section className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map(([title, body]) => (
              <div key={title} className="card p-5">
                <h2 className="font-medium">{title}</h2>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </div>
            ))}
          </section>
        )}
      </main>
    </>
  );
}

function CourseCard({ course }: { course: Course }) {
  const done = useStore((s) => s.done[course.id]) ?? NO_DONE;
  const removeCourse = useStore((s) => s.removeCourse);
  const p = courseProgress(course, done);
  const next = nextVideoId(course, done);

  return (
    <article className="card flex h-full flex-col overflow-hidden">
      <Link href={`/course/${course.id}`} className="block bg-surface-2">
        <Image
          src={thumbnailUrl(course.videos[0]?.id ?? "")}
          alt=""
          width={320}
          height={180}
          className="aspect-video w-full object-cover"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 font-medium leading-snug">
            <Link href={`/course/${course.id}`} className="hover:underline">
              {course.title}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-muted">
            {course.channel} · {p.total} {p.total === 1 ? "lesson" : "lessons"} ·{" "}
            {formatDuration(p.totalSec)}
          </p>
        </div>
        <div className="mt-auto">
          <div className="mb-1 flex justify-between text-xs text-muted">
            <span>
              {p.completed} of {p.total} done
            </span>
            <span>{p.percent}%</span>
          </div>
          <div className="bar" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${p.percent}%` }} />
          </div>
        </div>
        <div className="flex gap-2">
          {next && (
            <Link href={`/course/${course.id}/watch/${next}`} className="btn btn-primary flex-1">
              {p.completed === 0 ? "Start" : "Continue"}
            </Link>
          )}
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              if (window.confirm(`Remove "${course.title}" and its progress and notes?`)) {
                removeCourse(course.id);
              }
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </article>
  );
}
