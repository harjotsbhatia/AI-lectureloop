"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  formatClock,
  FRESH_TIMER,
  pauseTimer,
  readTimer,
  restartTimer,
  resumeTimer,
  type TimerState,
} from "@/lib/timer";
import { useMounted } from "@/lib/store";

/**
 * Saved in the browser on its own, so the timer keeps going across lessons and reloads
 * (and keeps counting while the tab is closed, like a wall clock).
 */
const useTimer = create<TimerState & { set: (t: TimerState) => void }>()(
  persist(
    (set) => ({ ...FRESH_TIMER, set: (t) => set(t) }),
    {
      name: "lectureloop-timer",
      partialize: ({ startedAt, pausedElapsed }) => ({ startedAt, pausedElapsed }),
    },
  ),
);

/** A 3-hour study timer: time left counting down and time done counting up, in a loop. */
export default function StudyTimer() {
  const mounted = useMounted();
  const startedAt = useTimer((s) => s.startedAt);
  const pausedElapsed = useTimer((s) => s.pausedElapsed);
  const set = useTimer((s) => s.set);
  const state: TimerState = { startedAt, pausedElapsed };
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!mounted) return null;
  const t = readTimer(state, startedAt === null ? 0 : now);
  const left = formatClock(t.remaining, true);
  const done = formatClock(t.elapsed);

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-line bg-surface py-0.5 pr-0.5 pl-2.5"
      role="timer"
      aria-label={`Study timer: ${left} left, ${done} done${t.running ? "" : ", paused"}`}
    >
      <div className="flex items-baseline gap-2 font-mono text-sm tabular-nums">
        <span title="Time left in this 3-hour session">
          <span className="text-ink">{left}</span>
          <span className="ml-1 hidden font-sans text-xs text-muted lg:inline">left</span>
        </span>
        <span className="text-line" aria-hidden>
          |
        </span>
        <span title="Time studied in this 3-hour session">
          <span className="text-accent">{done}</span>
          <span className="ml-1 hidden font-sans text-xs text-muted lg:inline">done</span>
        </span>
        {t.round > 1 && (
          <span className="hidden font-sans text-xs text-muted xl:inline">· round {t.round}</span>
        )}
      </div>
      <button
        type="button"
        className="btn btn-quiet px-2 py-1"
        aria-label={t.running ? "Pause timer" : t.elapsed === 0 && t.round === 1 ? "Start timer" : "Resume timer"}
        title={t.running ? "Pause" : "Start"}
        onClick={() => {
          const n = Date.now();
          setNow(n);
          set(t.running ? pauseTimer(state, n) : resumeTimer(state, n));
        }}
      >
        {t.running ? "❚❚" : "▶"}
      </button>
      <button
        type="button"
        className="btn btn-quiet px-2 py-1"
        aria-label="Restart timer"
        title="Restart from 3:00:00"
        onClick={() => {
          const n = Date.now();
          setNow(n);
          set(restartTimer(n));
        }}
      >
        ↺
      </button>
    </div>
  );
}
