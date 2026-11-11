import { describe, expect, it } from "vitest";
import { addDays, buildSchedule, daysBetween, planStatus } from "./planner";

const H = 3600;
const vids = (...mins: number[]) => mins.map((m, i) => ({ id: `v${i + 1}`, durationSec: m * 60 }));
const watched = (days: ReturnType<typeof buildSchedule>) =>
  days.reduce((n, d) => n + d.totalSec, 0);

describe("date helpers", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-10", -10)).toBe("2026-02-28");
  });
  it("counts days between dates", () => {
    expect(daysBetween("2026-11-09", "2026-11-09")).toBe(0);
    expect(daysBetween("2026-11-09", "2026-11-12")).toBe(3);
    expect(daysBetween("2026-11-09", "2026-11-01")).toBe(-8);
  });
});

describe("buildSchedule", () => {
  it("packs short videos into days without splitting them", () => {
    const days = buildSchedule(vids(30, 30, 30), H, "2026-11-09");
    expect(days.map((d) => d.entries.map((e) => e.videoId))).toEqual([["v1", "v2"], ["v3"]]);
    expect(days.map((d) => d.date)).toEqual(["2026-11-09", "2026-11-10"]);
  });

  it("moves a video that will not fit to the next day", () => {
    const days = buildSchedule(vids(40, 40, 40), H, "2026-11-09");
    expect(days).toHaveLength(3);
    expect(days.every((d) => d.entries.length === 1)).toBe(true);
  });

  it("lets a day run slightly over to finish a video", () => {
    // 30 + 35 = 65 minutes: within the 15% allowance on a 60-minute day.
    const days = buildSchedule(vids(30, 35), H, "2026-11-09");
    expect(days).toHaveLength(1);
  });

  it("spreads a long video over consecutive days", () => {
    const days = buildSchedule(vids(300), H, "2026-11-09");
    expect(days).toHaveLength(5);
    expect(days[0].entries[0]).toEqual({ videoId: "v1", fromSec: 0, toSec: H });
    expect(days[4].entries[0]).toEqual({ videoId: "v1", fromSec: 4 * H, toSec: 5 * H });
  });

  it("accounts for every second exactly once", () => {
    const videos = vids(7, 95, 12, 240, 3, 61, 59, 180, 45);
    for (const hours of [0.5, 1, 1.5, 3]) {
      const days = buildSchedule(videos, hours * H, "2026-11-09");
      expect(watched(days)).toBe(videos.reduce((n, v) => n + v.durationSec, 0));
      for (const v of videos) {
        const parts = days.flatMap((d) => d.entries).filter((e) => e.videoId === v.id);
        expect(parts[0].fromSec).toBe(0);
        expect(parts[parts.length - 1].toSec).toBe(v.durationSec);
        parts.slice(1).forEach((p, i) => expect(p.fromSec).toBe(parts[i].toSec));
      }
      expect(days.every((d) => d.totalSec <= hours * H * 1.15 + 1)).toBe(true);
      days.forEach((d, i) => expect(d.date).toBe(addDays("2026-11-09", i)));
    }
  });

  it("skips zero-length videos and handles an empty list", () => {
    expect(buildSchedule([], H, "2026-11-09")).toEqual([]);
    expect(buildSchedule(vids(0, 10), H, "2026-11-09")).toHaveLength(1);
  });
});

describe("planStatus", () => {
  const videos = vids(60, 60, 60, 60);
  const base = { videos, hoursPerDay: 1, startDate: "2026-11-09" };

  it("is on track on day one with nothing watched", () => {
    const s = planStatus({ ...base, done: {}, today: "2026-11-09" });
    expect(s.state).toBe("on-track");
    expect(s.remaining).toHaveLength(4);
    expect(s.finishDate).toBe("2026-11-12");
  });

  it("is behind when earlier days were missed, and re-plans from today", () => {
    const s = planStatus({ ...base, done: { v1: true }, today: "2026-11-12" });
    expect(s.state).toBe("behind");
    expect(s.expectedSec - s.doneSec).toBe(2 * H);
    expect(s.remaining[0].date).toBe("2026-11-12");
    expect(s.finishDate).toBe("2026-11-14");
  });

  it("is ahead when a day's worth more than expected is done", () => {
    const s = planStatus({ ...base, done: { v1: true, v2: true }, today: "2026-11-10" });
    expect(s.state).toBe("ahead");
  });

  it("reports a future start and a finished course", () => {
    expect(planStatus({ ...base, done: {}, today: "2026-11-01" }).state).toBe("not-started");
    expect(planStatus({ ...base, done: {}, today: "2026-11-01" }).remaining[0].date).toBe(
      "2026-11-09",
    );
    const all = { v1: true, v2: true, v3: true, v4: true };
    const s = planStatus({ ...base, done: all, today: "2026-11-10" });
    expect(s.state).toBe("done");
    expect(s.finishDate).toBeNull();
  });
});
