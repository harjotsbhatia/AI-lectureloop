"use client";

import { useState } from "react";
import { postJson } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { QuizQuestion, Video } from "@/lib/types";
import { formatTime } from "@/lib/url";
import { ErrorNote } from "./Chrome";

export default function QuizPanel({
  video,
  onSeek,
}: {
  video: Video;
  onSeek: (sec: number) => void;
}) {
  const quiz = useStore((s) => s.quizzes[video.id]);
  const setQuiz = useStore((s) => s.setQuiz);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const { questions } = await postJson<{ questions: QuizQuestion[] }>("/api/ai/quiz", {
        video: { id: video.id, title: video.title, durationSec: video.durationSec },
      });
      setQuiz(video.id, questions);
      setAnswers({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (!quiz) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted">
          Check what stuck. The quiz is written from this lecture, five questions at a time.
        </p>
        <button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>
          {busy ? "Writing questions…" : "Generate quiz"}
        </button>
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    );
  }

  const answered = Object.keys(answers).length;
  const correct = quiz.filter((q, i) => answers[i] === q.answerIndex).length;

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-5">
        {quiz.map((q, qi) => {
          const picked = answers[qi];
          const revealed = picked !== undefined;
          return (
            <li key={qi}>
              <fieldset disabled={revealed}>
                <legend className="text-sm font-medium">
                  {qi + 1}. {q.question}
                </legend>
                <div className="mt-2 flex flex-col gap-1.5">
                  {q.options.map((opt, oi) => {
                    const isAnswer = oi === q.answerIndex;
                    const tone = !revealed
                      ? "border-line hover:bg-surface-2"
                      : isAnswer
                        ? "border-good bg-good/10"
                        : oi === picked
                          ? "border-bad bg-bad/10"
                          : "border-line opacity-60";
                    return (
                      <button
                        key={oi}
                        type="button"
                        className={`rounded-lg border px-3 py-2 text-left text-sm ${tone}`}
                        onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                      >
                        {opt}
                        {revealed && isAnswer && <span className="sr-only"> (correct answer)</span>}
                        {revealed && oi === picked && !isAnswer && (
                          <span className="sr-only"> (your answer)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {revealed && (
                <p className="mt-2 text-sm text-muted" aria-live="polite">
                  <strong className={picked === q.answerIndex ? "text-good" : "text-bad"}>
                    {picked === q.answerIndex ? "Correct." : "Not quite."}
                  </strong>{" "}
                  {q.explanation}{" "}
                  <button type="button" className="ts" onClick={() => onSeek(q.timeSec)}>
                    Rewatch at {formatTime(q.timeSec)}
                  </button>
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <p className="text-sm">
          {answered === quiz.length ? (
            <strong>
              You got {correct} of {quiz.length}.
            </strong>
          ) : (
            <span className="text-muted">
              {answered} of {quiz.length} answered
            </span>
          )}
        </p>
        <div className="flex gap-2">
          {answered > 0 && (
            <button type="button" className="btn btn-quiet" onClick={() => setAnswers({})}>
              Retry
            </button>
          )}
          <button type="button" className="btn" onClick={generate} disabled={busy}>
            {busy ? "Writing…" : "New questions"}
          </button>
        </div>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}
