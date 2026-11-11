import "server-only";
import { GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod";
import { getTranscript, transcriptToText } from "./transcript";

/**
 * Models to try, in order. The newest Flash model is often overloaded on the free tier
 * (HTTP 503), so older ones follow as fallbacks. GEMINI_MODEL in .env.local goes first.
 */
const MODELS = [
  ...new Set(
    [process.env.GEMINI_MODEL, "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash"].filter(
      (m): m is string => !!m,
    ),
  ),
];
export class AiError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

interface HttpLimits {
  timeout: number;
  retryOptions: { attempts: number };
}

/**
 * Models found busy, and until when to skip them. Kept on globalThis because each
 * route gets its own copy of this module in development.
 */
const store = globalThis as typeof globalThis & { __geminiBusy?: Map<string, number> };
const busyUntil = (store.__geminiBusy ??= new Map<string, number>());
/** A model that hung is skipped for longer than one that answered "busy" straight away. */
const SKIP_AFTER_TIMEOUT_MS = 10 * 60_000;
const SKIP_AFTER_REFUSAL_MS = 60_000;
/** The free tier allows a small number of requests per model per day. */
const SKIP_AFTER_QUOTA_MS = 60 * 60_000;

function isBusy(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return (
    status === 429 ||
    status === 500 ||
    status === 503 ||
    status === 504 ||
    status === 404 ||
    /timeout|timed out|abort|overloaded|high demand|UNAVAILABLE/i.test(text)
  );
}

/**
 * Runs `call` with each model in turn until one answers: models not recently busy first.
 * A model gets 30 seconds, with no silent SDK retries; the last one left gets 2 minutes.
 * Errors that are not about load (bad key, quota) are thrown at once.
 */
export async function withModel<T>(
  call: (model: string, httpOptions: HttpLimits) => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const wait = (m: string) => Math.max(0, (busyUntil.get(m) ?? 0) - now);
  // Available models in their listed order, then busy ones, soonest-to-recover first.
  const order = [...MODELS].sort((a, b) => wait(a) - wait(b));
  let last: unknown;
  let quotaHit = false;
  for (const [i, model] of order.entries()) {
    const isLast = i === order.length - 1;
    try {
      const result = await call(model, {
        timeout: isLast ? 120_000 : 30_000,
        retryOptions: { attempts: 1 },
      });
      busyUntil.delete(model);
      return result;
    } catch (e) {
      // Our own errors (such as a missing key) are not about load: no other model would help.
      if (e instanceof AiError || !isBusy(e)) throw e;
      const status = (e as { status?: number })?.status;
      if (status === 429) quotaHit = true;
      const skip =
        status === 429
          ? SKIP_AFTER_QUOTA_MS
          : typeof status === "number"
            ? SKIP_AFTER_REFUSAL_MS
            : SKIP_AFTER_TIMEOUT_MS;
      busyUntil.set(model, Date.now() + skip);
      console.warn(`Gemini model ${model} unavailable, trying the next one.`);
      last = e;
    }
  }
  console.error("All Gemini models failed:", last instanceof Error ? last.message : last);
  if (quotaHit) {
    throw new AiError(
      "Gemini's free-tier quota is used up for now (it allows about 20 requests per model per day). Try again later, or enable billing on the key.",
      429,
    );
  }
  throw new AiError(
    "Gemini is overloaded right now on every model this app tries. Wait a minute and try again.",
    503,
  );
}

let client: GoogleGenAI | null = null;

export function ai(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AiError(
      "No Gemini API key is set, so the AI features are off. Add GEMINI_API_KEY to .env.local (or to the host's environment variables) and restart.",
    );
  }
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export const VideoRef = z.object({
  id: z.string().regex(/^[\w-]{11}$/),
  title: z.string().max(300),
  durationSec: z.number().nonnegative(),
});
export type VideoRef = z.infer<typeof VideoRef>;

/**
 * The lecture material to send to Gemini: the caption transcript when there is one,
 * otherwise the public video itself (Gemini accepts YouTube URLs as video input).
 */
export async function lectureParts(video: VideoRef): Promise<Part[]> {
  const segments = await getTranscript(video.id, video.durationSec);
  if (segments) {
    return [
      {
        text: `Lecture title: ${video.title}\n\nTranscript, each line starting with its timestamp:\n${transcriptToText(segments)}`,
      },
    ];
  }
  return [
    { fileData: { fileUri: `https://www.youtube.com/watch?v=${video.id}` } },
    { text: `Lecture title: ${video.title}` },
  ];
}

/** One structured-output call: Gemini is held to `jsonSchema`, and the reply is checked with `schema`. */
export async function generateJson<T>(args: {
  system: string;
  parts: Part[];
  jsonSchema: unknown;
  schema: z.ZodType<T>;
}): Promise<T> {
  const response = await withModel((model, httpOptions) =>
    ai().models.generateContent({
      model,
      contents: [{ role: "user", parts: args.parts }],
      config: {
        systemInstruction: args.system,
        responseMimeType: "application/json",
        responseJsonSchema: args.jsonSchema,
        httpOptions,
      },
    }),
  );
  let data: unknown;
  try {
    data = JSON.parse(response.text ?? "");
  } catch {
    throw new AiError("Gemini returned an unreadable answer. Try again.", 502);
  }
  const parsed = args.schema.safeParse(data);
  if (!parsed.success) {
    throw new AiError("Gemini returned an answer in an unexpected shape. Try again.", 502);
  }
  return parsed.data;
}

/** Turns anything thrown by an AI route into a JSON error the UI can show. */
export function aiErrorResponse(e: unknown): Response {
  if (e instanceof AiError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  const status = (e as { status?: number })?.status;
  const detail = e instanceof Error ? e.message : String(e);
  console.error("Gemini request failed:", detail);
  if (status === 429) {
    return Response.json(
      { error: "Gemini's rate limit or quota was reached. Wait a minute and try again." },
      { status: 429 },
    );
  }
  if (status === 401 || status === 403 || /API key not valid/i.test(detail)) {
    return Response.json(
      { error: "Gemini rejected the API key. Check GEMINI_API_KEY in .env.local." },
      { status: 500 },
    );
  }
  return Response.json(
    { error: "The AI request failed. Try again in a moment." },
    { status: 502 },
  );
}

export const LANGUAGE_RULE =
  "Write in English unless the lecture is clearly taught in another language and the student writes in it.";
