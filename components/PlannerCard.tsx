"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { daysBetween, localDate, planStatus, type PlanDay, type PlanState } from "@/lib/planner";
import { useStore } from "@/lib/store";
import type { Course } from "@/lib/types";
import { formatDuration, formatTime } from "@/lib/url";

const STATE_LABEL: Record<PlanState, string> = {
  done: "Course finished",
  "not-started": "Starts later",
  ahead: "Ahead of plan",
  "on-track": "On track",
  behind: "Behind plan",
};

function prettyDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export default function PlannerCard({
  course,
  done,
}: {
  course: Course;
  done: Record<string, boolean>;
}) {
  const setPlan = useStore((s) => s.setPlan);
  const [today] = useState(() => localDate());
  const { hoursPerDay, startDate } = course.plan;

  const status = useMemo(
    () => planStatus({ videos: course.videos, done, hoursPerDay, startDate, today }),
    [course.videos, done, hoursPerDay, startDate, today],
  );
  const titles = useMemo(
    () => new Map(course.videos.map((v) => [v.id, v])),
    [course.videos],
  );

  const first = status.remaining[0];
  const firstIsToday = first?.date === today;
  const daysLeft = status.remaining.length;
  const behindBy = status.expectedSec - status.doneSec;

  return (
    <section className="card p-5" aria-labelledby="plan-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="plan-heading" className="font-semibold">
          Study plan
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            status.state === "behind"
              ? "bg-bad/15 text-bad"
              : status.state === "not-started"
                ? "bg-surface-2 text-muted"
                : "bg-good/15 text-good"
          }`}
        >
          {STATE_LABEL[status.state]}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Hours per day</span>
          <input
            type="number"
            className="field w-28"
            min={0.25}
            max={16}
            step={0.25}
            value={hoursPerDay}
            onChange={(e) => {
              const h = Number(e.target.value);
              if (Number.isFinite(h) && h >= 0.25 && h <= 16) {
                setPlan(course.id, { hoursPerDay: h, startDate });
              }
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Start date</span>
          <input
            type="date"
            className="field"
            value={startDate}
            onChange={(e) => {
              if (e.target.value) setPlan(course.id, { hoursPerDay, startDate: e.target.value });
            }}
          />
        </label>
      </div>

      {status.state === "done" ? (
        <p className="mt-4 text-sm text-muted">Every lesson is marked done. Nice work.</p>
      ) : (
        <>
          <p className="mt-4 text-sm">
            {formatDuration(status.totalSec - status.doneSec)} left.{" "}
            <strong className="font-semibold">
              {daysLeft} {daysLeft === 1 ? "day" : "days"} to go
            </strong>
            {status.finishDate && <> — finishing {prettyDate(status.finishDate)}.</>}
          </p>
          {status.state === "behind" && (
            <p className="mt-1 text-sm text-muted">
              You are {formatDuration(behindBy)} behind the pace you set on{" "}
              {prettyDate(startDate)}. The dates below are re-planned from today.
            </p>
          )}

          {first && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold">
                {firstIsToday ? "Today" : prettyDate(first.date)} ·{" "}
                <span className="font-normal text-muted">{formatDuration(first.totalSec)}</span>
              </h3>
              <DayEntries day={first} course={course} titles={titles} />
            </div>
          )}

          {status.remaining.length > 1 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted hover:text-ink">
                Show the coming days
              </summary>
              <ol className="mt-3 flex flex-col gap-3">
                {status.remaining.slice(1, 15).map((day) => (
                  <li key={day.date}>
                    <h3 className="text-sm font-medium">
                      {prettyDate(day.date)}{" "}
                      <span className="font-normal text-muted">
                        · day {daysBetween(status.remaining[0].date, day.date) + 1} ·{" "}
                        {formatDuration(day.totalSec)}
                      </span>
                    </h3>
                    <DayEntries day={day} course={course} titles={titles} />
                  </li>
                ))}
              </ol>
              {status.remaining.length > 15 && (
                <p className="mt-3 text-sm text-muted">
                  …and {status.remaining.length - 15} more days.
                </p>
              )}
            </details>
          )}
        </>
      )}
    </section>
  );
}

function DayEntries({
  day,
  course,
  titles,
}: {
  day: PlanDay;
  course: Course;
  titles: Map<string, { title: string; durationSec: number; position: number }>;
}) {
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {day.entries.map((e) => {
        const v = titles.get(e.videoId);
        if (!v) return null;
        const partial = e.fromSec > 0 || e.toSec < v.durationSec;
        return (
          <li key={`${e.videoId}-${e.fromSec}`} className="flex gap-2 text-sm">
            <Link
              href={`/course/${course.id}/watch/${e.videoId}`}
              className="min-w-0 flex-1 truncate hover:underline"
            >
              <span className="text-muted">{v.position + 1}.</span> {v.title}
            </Link>
            <span className="shrink-0 font-mono text-xs text-muted">
              {partial
                ? `${formatTime(e.fromSec)}–${formatTime(e.toSec)}`
                : formatDuration(v.durationSec)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
