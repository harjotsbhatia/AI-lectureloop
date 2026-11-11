"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  getDuration(): number;
  setPlaybackRate(rate: number): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    options: {
      videoId: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

export interface PlayerHandle {
  seekTo(sec: number): void;
  getCurrentTime(): number;
  setRate(rate: number): void;
  /** Fills the screen with the player, or leaves full screen if it is already on. */
  toggleFullscreen(): void;
}

/**
 * YouTube draws the video's title along the top of its player and its controls along the
 * bottom, on top of the picture, whenever the video is paused. That hides whatever the
 * lecture shows there (a question, a diagram). So the player is made taller than the
 * picture by a band above and below: the title and controls then sit in the
 * black bands instead of on the picture. The top band is cropped away; the bottom band
 * stays visible, holding the controls under the picture.
 * The bands are wider than the title and controls themselves, because YouTube also draws
 * a dark fade under each of them, and the time readout sits above the control bar.
 */
const BAND = "[--band:88px] sm:[--band:120px]"; // YouTube's phone-width controls are shorter
/** At full-screen size YouTube draws its title and controls larger. */
const BAND_FULLSCREEN = "[--band:160px]";

/** The YouTube player for one video. Remount it (with `key`) to change video. */
export default function Player({
  videoId,
  startAt,
  onProgress,
  ref,
}: {
  videoId: string;
  startAt: number;
  /** Called every few seconds while the video is on screen */
  onProgress: (currentSec: number, durationSec: number) => void;
  ref: Ref<PlayerHandle>;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  // YouTube's player state: 1 is playing, 3 is buffering.
  const state = useRef(-1);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  // While paused, YouTube's controls stay covered unless the student asks for them.
  const [controlsWanted, setControlsWanted] = useState(false);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frame.current?.requestFullscreen?.().catch(() => {});
  };
  const togglePlay = () => {
    if (!ready.current) return;
    if (state.current === 1 || state.current === 3) {
      // Cover the controls at once, before YouTube reports the pause, so a quick
      // pointer move onto them cannot bring the dimming back.
      setPaused(true);
      player.current?.pauseVideo();
    } else {
      player.current?.playVideo();
    }
  };
  const player = useRef<YTPlayer | null>(null);
  const ready = useRef(false);
  const initialStart = useRef(startAt);
  const progress = useRef(onProgress);

  useEffect(() => {
    progress.current = onProgress;
  }, [onProgress]);

  useImperativeHandle(
    ref,
    () => ({
      seekTo(sec) {
        if (!ready.current) return;
        player.current?.seekTo(sec, true);
        player.current?.playVideo();
      },
      getCurrentTime() {
        return ready.current ? (player.current?.getCurrentTime() ?? 0) : 0;
      },
      setRate(rate) {
        if (ready.current) player.current?.setPlaybackRate(rate);
      },
      toggleFullscreen,
    }),
    [],
  );

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frame.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const host = holder.current;
    if (!host) return;
    let cancelled = false;
    // The API replaces the element it is given, so hand it one React does not manage.
    const mount = document.createElement("div");
    host.appendChild(mount);

    const report = () => {
      const p = player.current;
      if (!p || !ready.current) return;
      const cur = p.getCurrentTime();
      if (cur > 0) progress.current(cur, p.getDuration());
    };

    loadApi().then((YT) => {
      if (cancelled) return;
      player.current = new YT.Player(mount, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: {
          rel: 0,
          // YouTube's own full screen would bring the title back over the picture;
          // toggleFullscreen() above replaces it.
          fs: 0,
          playsinline: 1,
          start: Math.floor(initialStart.current),
        },
        events: {
          onReady: () => {
            ready.current = true;
          },
          onStateChange: (e) => {
            state.current = e.data;
            if (e.data === 1) {
              setStarted(true);
              setControlsWanted(false);
            }
            setPaused(e.data === 2);
            report();
          },
        },
      });
    });
    const timer = window.setInterval(report, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      ready.current = false;
      player.current?.destroy();
      player.current = null;
      host.replaceChildren();
    };
  }, [videoId]);

  return (
    <div
      ref={frame}
      className={`flex w-full justify-center overflow-hidden bg-black ${
        fullscreen ? BAND_FULLSCREEN : `${BAND} rounded-xl`
      }`}
    >
      <div
        className="relative w-full overflow-hidden"
        style={
          fullscreen
            ? {
                // Leave room for the controls band under a picture that still fits the screen.
                width: "min(100vw, calc((100vh - var(--band)) * 16 / 9))",
                height: "100vh",
              }
            : { paddingBottom: "var(--band)" }
        }
      >
        {!fullscreen && <div className="aspect-video" />}
        <div
          ref={holder}
          className="absolute inset-x-0 bottom-0 [&>iframe]:size-full"
          style={{ top: "calc(var(--band) * -1)" }}
        />
        {/* YouTube dims the picture and draws a play button over it only when the pointer
            clicks inside its player. Once the video has started, this layer takes clicks on
            the picture instead and pauses or plays through the API, so a paused frame stays
            clear. The controls in the band below are not covered. */}
        {started && (
          <button
            type="button"
            aria-label="Play or pause"
            title="Click to pause or play · double-click for full screen"
            className="absolute inset-x-0 top-0 cursor-pointer"
            style={{ bottom: "var(--band)" }}
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
          />
        )}
        {/* Moving the pointer onto YouTube's controls while paused also brings the dimming
            back, and it then stays until the video plays again. So the controls are covered
            while paused, with a button to uncover them. */}
        {started && paused && !controlsWanted && (
          <div
            className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 bg-black px-4 text-sm text-white/70"
            style={{ height: "var(--band)" }}
          >
            <button type="button" className="btn btn-primary" onClick={togglePlay}>
              ▶ Play
            </button>
            <button type="button" className="btn" onClick={() => setControlsWanted(true)}>
              Show YouTube controls
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
