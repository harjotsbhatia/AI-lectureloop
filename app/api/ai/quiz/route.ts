import { z } from "zod";
import {
  aiErrorResponse,
  generateJson,
  LANGUAGE_RULE,
  lectureParts,
  VideoRef,
} from "@/lib/gemini";

const Body = z.object({ video: VideoRef });

const Quiz = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        options: z.array(z.string().min(1)).length(4),
        answerIndex: z.number().int().min(0).max(3),
        explanation: z.string(),
        timeSec: z.number().nonnegative(),
      }),
    )
    .min(1)
    .max(10),
});

const jsonSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
          answerIndex: { type: "integer", description: "Index (0-3) of the correct option" },
          explanation: { type: "string", description: "One or two sentences on why it is correct" },
          timeSec: {
            type: "integer",
            description: "Where the lecture covers this, in seconds from the start",
          },
        },
        required: ["question", "options", "answerIndex", "explanation", "timeSec"],
      },
    },
  },
  required: ["questions"],
};

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { video } = body.data;
  try {
    const quiz = await generateJson({
      system: `You write a recall quiz for a student who has just watched a lecture. Write 5 multiple-choice questions that test understanding of the ideas taught, not trivia about the video. Each has exactly 4 options and one correct answer; vary which position is correct. Use only what the lecture teaches. ${LANGUAGE_RULE}`,
      parts: await lectureParts(video),
      jsonSchema,
      schema: Quiz,
    });
    const max = video.durationSec || Infinity;
    return Response.json({
      questions: quiz.questions.map((q) => ({
        ...q,
        timeSec: Math.min(Math.floor(q.timeSec), max),
      })),
    });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
