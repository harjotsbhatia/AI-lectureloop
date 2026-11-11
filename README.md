# LectureLoop

Turn a YouTube playlist into a course you can finish: lessons in order, progress tracking,
notes tied to the video's timestamp, a daily study plan, and AI help (tutor, quiz, summary,
chapter grouping) powered by Google Gemini.

Everything you do is saved in your browser (localStorage). There are no accounts and no database.

## Setup

1. Copy the example env file:

   ```bash
   cp .env.example .env.local
   ```

2. Put two keys in `.env.local`:

   - `YOUTUBE_API_KEY` — in Google Cloud Console, create a project, enable **YouTube Data API v3**,
     then create an API key under *Credentials*. Needed to import playlists.
   - `GEMINI_API_KEY` — create one at <https://aistudio.google.com/apikey>. Needed for the AI features.

3. Install and run:

   ```bash
   npm install
   ```

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>.

Next.js 16 needs Node 20.9 or newer. This project installs Node 22 as a dev dependency, so the
`npm run …` scripts work even if your system Node is older.

## How it works

| Part | Where |
|---|---|
| Playlist import (YouTube Data API) | `app/api/playlist/route.ts`, `lib/youtube.ts` |
| Education-only video search | `app/api/search/route.ts`, `searchEducational` in `lib/youtube.ts`, `components/SearchPanel.tsx` |
| Player (YouTube IFrame API), resume, auto-complete at 90% | `components/Player.tsx`, `components/Classroom.tsx` |
| Study plan (pure function, no AI) | `lib/planner.ts`, `components/PlannerCard.tsx` |
| Saved data | `lib/store.ts` |
| Gemini client, model name, error handling | `lib/gemini.ts` |
| AI routes | `app/api/ai/{tutor,quiz,summary,syllabus}/route.ts` |
| Captions for the AI | `lib/transcript.ts` |

The AI features work from the lecture's captions. Captions are read with the `youtube-transcript`
package, which uses YouTube's public caption tracks unofficially and may stop working. When a video
has no captions, the video's URL is passed to Gemini as video input instead, which is slower and
uses more quota.

`lib/gemini.ts` tries a list of Gemini Flash models in order and moves to the next when one is
overloaded or out of quota; set `GEMINI_MODEL` in `.env.local` to put a model of your choice first.
On Google's free tier each model allows about 20 requests per day, and every summary, quiz, tutor
question and chapter grouping is one request, so a free key runs out quickly.

Only educational videos are allowed, in search and in pasted links alike. A video must be filed under
YouTube's Education category by its uploader and carry YouTube's own "Knowledge" topic label
(`isEducational` in `lib/youtube.ts`). Search sends both as filters and checks every result again;
a pasted video that fails is refused, and a playlist keeps only the videos that pass. Each search costs 100 of the YouTube key's 10,000
daily quota units, so about 100 searches a day.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm test` — unit tests for URL parsing and the planner
