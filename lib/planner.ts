export interface PlanVideo {
  id: string;
  durationSec: number;
}

export interface PlanEntry {
  videoId: string;
  fromSec: number;
  toSec: number;
}

export interface PlanDay {
  /** YYYY-MM-DD */
  date: string;
  entries: PlanEntry[];
  totalSec: number;
}

export type PlanState = "done" | "not-started" | "ahead" | "on-track" | "behind";

export interface PlanStatus {
  state: PlanState;
  totalSec: number;
  doneSec: number;
  /** Watch time the plan expected to be finished before today */
  expectedSec: number;
  /** Schedule for what is still unwatched, starting today (or the start date if later) */
  remaining: PlanDay[];
  finishDate: string | null;
}

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: string, n: number): string {
  return new Date(toUtc(date) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (negative if `b` is earlier) */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
}

/** Today's date in the user's own time zone */
export function localDate(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Packs videos, in order, into days of `secPerDay`.
 * A video that fits in a day is never split; a day may run up to 15% over to finish one.
 * A video longer than a day is spread across consecutive days.
 */
export function buildSchedule(
  videos: PlanVideo[],
  secPerDay: number,
  startDate: string,
): PlanDay[] {
  const budget = Math.max(60, Math.round(secPerDay));
  const slack = budget * 0.15;
  const days: PlanDay[] = [];
  let cur: PlanDay = { date: startDate, entries: [], totalSec: 0 };

  const closeDay = () => {
    if (cur.entries.length > 0) days.push(cur);
    cur = { date: addDays(startDate, days.length), entries: [], totalSec: 0 };
  };
  const add = (videoId: string, fromSec: number, toSec: number) => {
    cur.entries.push({ videoId, fromSec, toSec });
    cur.totalSec += toSec - fromSec;
  };

  for (const v of videos) {
    if (v.durationSec <= 0) continue;
    let from = 0;
    while (from < v.durationSec) {
      const left = v.durationSec - from;
      const space = budget - cur.totalSec;
      if (left <= space + slack) {
        add(v.id, from, v.durationSec);
        from = v.durationSec;
      } else if (cur.totalSec > 0 && (space < 60 || (from === 0 && v.durationSec <= budget + slack))) {
        closeDay();
      } else {
        add(v.id, from, from + space);
        from += space;
        closeDay();
      }
    }
    if (cur.totalSec >= budget) closeDay();
  }
  closeDay();
  return days;
}

export function planStatus(args: {
  videos: PlanVideo[];
  done: Record<string, boolean>;
  hoursPerDay: number;
  startDate: string;
  today: string;
}): PlanStatus {
  const { videos, done, hoursPerDay, startDate, today } = args;
  const budget = Math.max(60, Math.round(hoursPerDay * 3600));
  const totalSec = videos.reduce((n, v) => n + v.durationSec, 0);
  const doneSec = videos.reduce((n, v) => n + (done[v.id] ? v.durationSec : 0), 0);
  const elapsedDays = daysBetween(startDate, today);
  const expectedSec = Math.min(totalSec, Math.max(0, elapsedDays) * budget);

  const from = elapsedDays < 0 ? startDate : today;
  const remaining = buildSchedule(
    videos.filter((v) => !done[v.id]),
    budget,
    from,
  );

  let state: PlanState;
  if (videos.length > 0 && videos.every((v) => done[v.id])) state = "done";
  else if (elapsedDays < 0) state = "not-started";
  else if (doneSec < expectedSec) state = "behind";
  else if (doneSec >= expectedSec + budget) state = "ahead";
  else state = "on-track";

  return {
    state,
    totalSec,
    doneSec,
    expectedSec,
    remaining,
    finishDate: remaining.length > 0 ? remaining[remaining.length - 1].date : null,
  };
}
