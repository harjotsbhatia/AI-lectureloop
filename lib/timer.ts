/** Length of one study session: the timer loops back to the start after this. */
export const SESSION_MS = 3 * 60 * 60 * 1000;

/**
 * The timer's whole state. Both clocks are read from this one value, so they can never
 * drift apart. While running, `startedAt` is when the timer would have started had it
 * never been paused; while paused, `pausedElapsed` holds the time counted so far.
 */
export interface TimerState {
  startedAt: number | null;
  pausedElapsed: number;
}

export const FRESH_TIMER: TimerState = { startedAt: null, pausedElapsed: 0 };

export function totalElapsed(t: TimerState, now: number): number {
  return t.startedAt === null ? t.pausedElapsed : Math.max(0, now - t.startedAt);
}

/** Time counted up and time left in the current 3-hour round, plus the round number. */
export function readTimer(t: TimerState, now: number) {
  const total = totalElapsed(t, now);
  const elapsed = total % SESSION_MS;
  return {
    elapsed,
    remaining: SESSION_MS - elapsed,
    round: Math.floor(total / SESSION_MS) + 1,
    running: t.startedAt !== null,
  };
}

export function pauseTimer(t: TimerState, now: number): TimerState {
  return t.startedAt === null ? t : { startedAt: null, pausedElapsed: totalElapsed(t, now) };
}

export function resumeTimer(t: TimerState, now: number): TimerState {
  return t.startedAt !== null ? t : { startedAt: now - t.pausedElapsed, pausedElapsed: 0 };
}

/** Back to 3:00:00 left and 0:00:00 done, running. */
export function restartTimer(now: number): TimerState {
  return { startedAt: now, pausedElapsed: 0 };
}

/** Milliseconds → "H:MM:SS". Rounds down for time done and up for time left, so they add to 3:00:00. */
export function formatClock(ms: number, roundUp = false): string {
  const s = roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
