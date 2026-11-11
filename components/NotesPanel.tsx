"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { formatTime } from "@/lib/url";
import Md from "./Md";

export default function NotesPanel({
  courseId,
  videoId,
  getTime,
  onSeek,
}: {
  courseId: string;
  videoId: string;
  getTime: () => number;
  onSeek: (sec: number) => void;
}) {
  const allNotes = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const [text, setText] = useState("");

  const notes = useMemo(
    () =>
      allNotes
        .filter((n) => n.courseId === courseId && n.videoId === videoId)
        .sort((a, b) => a.timeSec - b.timeSec),
    [allNotes, courseId, videoId],
  );

  function save() {
    const body = text.trim();
    if (!body) return;
    addNote({
      id: crypto.randomUUID(),
      courseId,
      videoId,
      timeSec: Math.floor(getTime()),
      text: body,
      createdAt: Date.now(),
    });
    setText("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="note" className="sr-only">
          New note
        </label>
        <textarea
          id="note"
          className="field min-h-24 w-full resize-y"
          placeholder="Write a note. Markdown works. It is saved with the video's current time."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted">⌘/Ctrl + Enter to save</span>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!text.trim()}>
            Save note at current time
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-muted">
          No notes for this lesson yet. Each note links back to the moment you wrote it.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  className="ts"
                  onClick={() => onSeek(n.timeSec)}
                  aria-label={`Jump to ${formatTime(n.timeSec)}`}
                >
                  {formatTime(n.timeSec)}
                </button>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-bad"
                  onClick={() => deleteNote(n.id)}
                >
                  Delete
                </button>
              </div>
              <Md text={n.text} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
