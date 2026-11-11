"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Chapter,
  ChatMessage,
  Course,
  ImportedCourse,
  Note,
  Plan,
  QuizQuestion,
  Summary,
} from "./types";

interface State {
  courses: Record<string, Course>;
  /** courseId → videoId → completed */
  done: Record<string, Record<string, boolean>>;
  /** videoId → last playback position in seconds */
  positions: Record<string, number>;
  notes: Note[];
  summaries: Record<string, Summary>;
  quizzes: Record<string, QuizQuestion[]>;
  chats: Record<string, ChatMessage[]>;

  addCourse: (course: ImportedCourse, startDate: string) => void;
  removeCourse: (courseId: string) => void;
  setDone: (courseId: string, videoId: string, value: boolean) => void;
  setPosition: (videoId: string, sec: number) => void;
  setLastVideo: (courseId: string, videoId: string) => void;
  setPlan: (courseId: string, plan: Plan) => void;
  setChapters: (courseId: string, chapters: Chapter[] | null) => void;
  addNote: (note: Note) => void;
  deleteNote: (noteId: string) => void;
  setSummary: (videoId: string, summary: Summary) => void;
  setQuiz: (videoId: string, quiz: QuizQuestion[]) => void;
  setChat: (videoId: string, messages: ChatMessage[]) => void;
}

function patchCourse(
  courses: Record<string, Course>,
  id: string,
  patch: Partial<Course>,
): Record<string, Course> {
  const course = courses[id];
  return course ? { ...courses, [id]: { ...course, ...patch } } : courses;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      courses: {},
      done: {},
      positions: {},
      notes: [],
      summaries: {},
      quizzes: {},
      chats: {},

      addCourse: (imported, startDate) =>
        set((s) => {
          if (s.courses[imported.id]) return s;
          const course: Course = {
            ...imported,
            chapters: null,
            plan: { hoursPerDay: 1, startDate },
            createdAt: Date.now(),
          };
          return { courses: { ...s.courses, [course.id]: course } };
        }),

      removeCourse: (courseId) =>
        set((s) => {
          const courses = { ...s.courses };
          const done = { ...s.done };
          delete courses[courseId];
          delete done[courseId];
          return {
            courses,
            done,
            notes: s.notes.filter((n) => n.courseId !== courseId),
          };
        }),

      setDone: (courseId, videoId, value) =>
        set((s) => ({
          done: {
            ...s.done,
            [courseId]: { ...s.done[courseId], [videoId]: value },
          },
        })),

      setPosition: (videoId, sec) =>
        set((s) => ({ positions: { ...s.positions, [videoId]: Math.floor(sec) } })),

      setLastVideo: (courseId, lastVideoId) =>
        set((s) => ({ courses: patchCourse(s.courses, courseId, { lastVideoId }) })),

      setPlan: (courseId, plan) =>
        set((s) => ({ courses: patchCourse(s.courses, courseId, { plan }) })),

      setChapters: (courseId, chapters) =>
        set((s) => ({ courses: patchCourse(s.courses, courseId, { chapters }) })),

      addNote: (note) => set((s) => ({ notes: [...s.notes, note] })),
      deleteNote: (noteId) =>
        set((s) => ({ notes: s.notes.filter((n) => n.id !== noteId) })),

      setSummary: (videoId, summary) =>
        set((s) => ({ summaries: { ...s.summaries, [videoId]: summary } })),
      setQuiz: (videoId, quiz) =>
        set((s) => ({ quizzes: { ...s.quizzes, [videoId]: quiz } })),
      setChat: (videoId, messages) =>
        set((s) => ({ chats: { ...s.chats, [videoId]: messages } })),
    }),
    { name: "lectureloop-v1" },
  ),
);

const noop = () => () => {};

/**
 * False on the server and during hydration, true afterwards.
 * Saved data lives in localStorage, so pages wait for this before rendering it.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export const NO_DONE: Record<string, boolean> = {};

/** Chapters to display: the AI grouping if present, with any ungrouped videos appended. */
export function displayChapters(course: Course): Chapter[] {
  const all = course.videos.map((v) => v.id);
  if (!course.chapters || course.chapters.length === 0) {
    return [{ title: "All lessons", videoIds: all }];
  }
  const known = new Set(all);
  const seen = new Set<string>();
  const chapters = course.chapters
    .map((c) => ({
      title: c.title,
      videoIds: c.videoIds.filter((id) => {
        if (!known.has(id) || seen.has(id)) return false;
        seen.add(id);
        return true;
      }),
    }))
    .filter((c) => c.videoIds.length > 0);
  const rest = all.filter((id) => !seen.has(id));
  if (rest.length > 0) chapters.push({ title: "More lessons", videoIds: rest });
  return chapters;
}

export function courseProgress(course: Course, done: Record<string, boolean>) {
  const total = course.videos.length;
  const completed = course.videos.filter((v) => done[v.id]).length;
  const totalSec = course.videos.reduce((n, v) => n + v.durationSec, 0);
  return {
    total,
    completed,
    totalSec,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

/** Where "Continue" should go: the last watched video if unfinished, else the first unfinished one. */
export function nextVideoId(course: Course, done: Record<string, boolean>): string | null {
  if (course.lastVideoId && !done[course.lastVideoId]) return course.lastVideoId;
  const next = course.videos.find((v) => !done[v.id]);
  return (next ?? course.videos[0])?.id ?? null;
}
