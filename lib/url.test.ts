import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatTime,
  parseIsoDuration,
  parseTime,
  parseYouTubeUrl,
} from "./url";

const PL = "PLu0W_9lII9agq5TrH9XLIKQvv0iaF2X3w";
const V = "dQw4w9WgXcQ";

describe("parseYouTubeUrl", () => {
  it("reads playlist links", () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/playlist?list=${PL}`)).toEqual({
      kind: "playlist",
      id: PL,
    });
    expect(parseYouTubeUrl(`youtube.com/playlist?list=${PL}`)?.kind).toBe("playlist");
    expect(parseYouTubeUrl(PL)).toEqual({ kind: "playlist", id: PL });
  });

  it("treats a watch link inside a playlist as the playlist", () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${V}&list=${PL}&index=3`)).toEqual({
      kind: "playlist",
      id: PL,
    });
    expect(parseYouTubeUrl(`https://youtu.be/${V}?list=${PL}`)?.kind).toBe("playlist");
  });

  it("reads video links in their various shapes", () => {
    const video = { kind: "video", id: V };
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${V}`)).toEqual(video);
    expect(parseYouTubeUrl(`https://m.youtube.com/watch?v=${V}&t=42s`)).toEqual(video);
    expect(parseYouTubeUrl(`https://youtu.be/${V}?si=abc`)).toEqual(video);
    expect(parseYouTubeUrl(`https://www.youtube.com/embed/${V}`)).toEqual(video);
    expect(parseYouTubeUrl(`https://www.youtube.com/shorts/${V}`)).toEqual(video);
    expect(parseYouTubeUrl(`https://www.youtube.com/live/${V}?feature=share`)).toEqual(video);
    expect(parseYouTubeUrl(`  ${V} `)).toEqual(video);
  });

  it("falls back to the video when the list is a mix, which cannot be imported", () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${V}&list=RD${V}`)).toEqual({
      kind: "video",
      id: V,
    });
  });

  it("rejects everything else", () => {
    expect(parseYouTubeUrl("")).toBeNull();
    expect(parseYouTubeUrl("hello world")).toBeNull();
    expect(parseYouTubeUrl(`https://vimeo.com/watch?v=${V}`)).toBeNull();
    expect(parseYouTubeUrl(`https://notyoutube.com/watch?v=${V}`)).toBeNull();
    expect(parseYouTubeUrl("https://www.youtube.com/@somechannel")).toBeNull();
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=short")).toBeNull();
  });
});

describe("time helpers", () => {
  it("formats clock times", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(125)).toBe("2:05");
    expect(formatTime(3725.9)).toBe("1:02:05");
  });

  it("formats durations", () => {
    expect(formatDuration(180)).toBe("3m");
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(56 * 3600 + 30 * 60)).toBe("56h 30m");
  });

  it("parses clock times back to seconds", () => {
    expect(parseTime("2:05")).toBe(125);
    expect(parseTime("1:02:05")).toBe(3725);
    expect(parseTime("12")).toBeNull();
    expect(parseTime("abc")).toBeNull();
  });

  it("parses ISO durations from the YouTube API", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("PT12M")).toBe(720);
    expect(parseIsoDuration("P1DT1H")).toBe(90000);
    expect(parseIsoDuration("P0D")).toBe(0);
    expect(parseIsoDuration("nonsense")).toBe(0);
  });
});
