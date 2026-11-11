export interface Video {
  id: string;
  title: string;
  durationSec: number;
  position: number;
}

export interface Chapter {
  title: string;
  videoIds: string[];
}

export interface Plan {
  hoursPerDay: number;
  /** Local date, YYYY-MM-DD */
  startDate: string;
}

export interface Course {
  /** Playlist id, or video id for a single-video course */
  id: string;
  kind: "playlist" | "video";
  title: string;
  channel: string;
  videos: Video[];
  /** AI-generated grouping; null until generated */
  chapters: Chapter[] | null;
  plan: Plan;
  createdAt: number;
  lastVideoId?: string;
}

export interface Note {
  id: string;
  courseId: string;
  videoId: string;
  timeSec: number;
  text: string;
  createdAt: number;
}

export interface KeyPoint {
  timeSec: number;
  text: string;
}

export interface Summary {
  recap: string;
  keyPoints: KeyPoint[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  timeSec: number;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

/** What the playlist import route returns */
export interface ImportedCourse {
  id: string;
  kind: "playlist" | "video";
  title: string;
  channel: string;
  videos: Video[];
  /** Playlist videos left out because they are not educational */
  skipped?: number;
}

/** One video from the education-only search */
export interface SearchResult {
  id: string;
  title: string;
  channel: string;
  durationSec: number;
}
