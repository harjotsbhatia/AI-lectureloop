"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { ChatMessage, Video } from "@/lib/types";
import { ErrorNote } from "./Chrome";
import Md from "./Md";

const NO_CHAT: ChatMessage[] = [];
const STARTERS = [
  "Explain the part I'm watching in simpler words",
  "What should I already know before this lesson?",
  "Give me a practice problem on this",
];

export default function TutorPanel({
  video,
  getTime,
  onSeek,
}: {
  video: Video;
  getTime: () => number;
  onSeek: (sec: number) => void;
}) {
  const messages = useStore((s) => s.chats[video.id]) ?? NO_CHAT;
  const setChat = useStore((s) => s.setChat);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const busy = streaming !== null;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, streaming]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history = [...messages, { role: "user" as const, text: q }];
    setChat(video.id, history);
    setInput("");
    setError(null);
    setStreaming("");

    // Send recent turns only, starting on one of the student's.
    let recent = history.slice(-30);
    if (recent[0].role === "model") recent = recent.slice(1);

    try {
      const res = await fetch("/api/ai/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video: { id: video.id, title: video.title, durationSec: video.durationSec },
          currentTimeSec: Math.floor(getTime()),
          messages: recent,
        }),
      });
      if (!res.ok || !res.body) throw new Error(await errorMessage(res));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setStreaming(answer);
      }
      if (!answer.trim()) throw new Error("The tutor returned an empty answer. Try again.");
      setChat(video.id, [...history, { role: "model", text: answer }]);
    } catch (e) {
      // Take the unanswered question back out of the history and return it to the box.
      setChat(video.id, messages);
      setInput(q);
      setError(
        e instanceof Error && e.message && e.name !== "TypeError"
          ? e.message
          : "The answer was interrupted. Try again.",
      );
    } finally {
      setStreaming(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-1 flex-col gap-3">
        {messages.length === 0 && !busy && (
          <div>
            <p className="text-sm text-muted">
              Ask about anything in this lesson. The tutor reads the lecture&apos;s transcript and
              knows where you are in the video.
            </p>
            <div className="mt-3 flex flex-col items-start gap-2">
              {STARTERS.map((s) => (
                <button key={s} type="button" className="btn text-left" onClick={() => void ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <Bubble key={i} message={m} onSeek={onSeek} />
        ))}
        {busy &&
          (streaming ? (
            <Bubble message={{ role: "model", text: streaming }} onSeek={onSeek} />
          ) : (
            <p className="text-sm text-muted" aria-live="polite">
              Reading the lecture…
            </p>
          ))}
        {error && <ErrorNote>{error}</ErrorNote>}
        <div ref={bottom} />
      </div>

      <form onSubmit={onSubmit} className="sticky bottom-0 flex gap-2 bg-surface pt-2">
        <label htmlFor="tutor-input" className="sr-only">
          Question for the tutor
        </label>
        <input
          id="tutor-input"
          className="field min-w-0 flex-1"
          placeholder="Ask about this lesson…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={4000}
          autoComplete="off"
        />
        <button className="btn btn-primary" disabled={busy || !input.trim()}>
          Ask
        </button>
      </form>
      {messages.length > 0 && !busy && (
        <button
          type="button"
          className="self-start text-xs text-muted hover:text-ink"
          onClick={() => setChat(video.id, [])}
        >
          Clear conversation
        </button>
      )}
    </div>
  );
}

function Bubble({ message, onSeek }: { message: ChatMessage; onSeek: (sec: number) => void }) {
  if (message.role === "user") {
    return (
      <div className="max-w-[90%] self-end whitespace-pre-wrap rounded-xl rounded-br-sm bg-accent-soft px-3 py-2 text-sm">
        {message.text}
      </div>
    );
  }
  return (
    <div className="max-w-[95%] self-start rounded-xl rounded-bl-sm bg-surface-2 px-3 py-2">
      <Md text={message.text} onSeek={onSeek} />
    </div>
  );
}
