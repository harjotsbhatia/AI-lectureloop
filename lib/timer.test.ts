import { describe, expect, it } from "vitest";
import {
  FRESH_TIMER,
  formatClock,
  formatMinutes,
  pauseTimer,
  readTimer,
  restartTimer,
  resumeTimer,
  SESSION_MS,
} from "./timer";

const MIN = 60_000;

describe("study timer", () => {
  it("starts paused at 3:00:00 left and 0:00:00 done", () => {
    const r = readTimer(FRESH_TIMER, 1_000_000);
    expect(r).toEqual({ elapsed: 0, remaining: SESSION_MS, round: 1, running: false });
  });

  it("counts up and down together, always adding to 3 hours", () => {
    const t = restartTimer(0);
    const r = readTimer(t, 25 * MIN);
    expect(r.elapsed).toBe(25 * MIN);
    expect(r.remaining).toBe(155 * MIN);
    expect(r.elapsed + r.remaining).toBe(SESSION_MS);
  });

  it("loops back to the start after 3 hours", () => {
    const r = readTimer(restartTimer(0), SESSION_MS + 10 * MIN);
    expect(r.elapsed).toBe(10 * MIN);
    expect(r.remaining).toBe(170 * MIN);
    expect(r.round).toBe(2);
  });

  it("does not count while paused", () => {
    let t = restartTimer(0);
    t = pauseTimer(t, 10 * MIN);
    expect(readTimer(t, 50 * MIN).elapsed).toBe(10 * MIN);
    t = resumeTimer(t, 50 * MIN);
    expect(readTimer(t, 55 * MIN).elapsed).toBe(15 * MIN);
  });

  it("formats both clocks so they add to 3:00:00", () => {
    expect(formatClock(1500)).toBe("0:00:01");
    expect(formatClock(SESSION_MS - 1500, true)).toBe("2:59:59");
    expect(formatClock(SESSION_MS, true)).toBe("3:00:00");
  });

  it("shows time left as total minutes and seconds", () => {
    expect(formatMinutes(SESSION_MS)).toBe("180:00");
    expect(formatMinutes(117.5 * MIN)).toBe("117:30");
    expect(formatMinutes(59_500)).toBe("1:00");
    expect(formatMinutes(5_000)).toBe("0:05");
  });
});
