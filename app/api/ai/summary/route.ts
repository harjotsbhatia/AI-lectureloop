import { z } from "zod";
import {
  aiErrorResponse,
  generateJson,
  LANGUAGE_RULE,
  lectureParts,
  VideoRef,
} from "@/lib/gemini";

const Body = z.object({ video: VideoRef });

const Summary = z.object({
  recap: z.string().min(1),
  keyPoints: z
    .array(z.object({ timeSec: z.number().nonnegative(), text: z.string().min(1) }))
    .min(1)
    .max(15),
});

const jsonSchema = {
  type: "object",
  properties: {
    recap: { type: "string", description: "2-4 sentence recap of the whole lecture" },
    keyPoints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timeSec: {
            type: "integer",
            description: "Where this point is explained, in seconds from the start",
          },
          text: { type: "string" },
        },
        required: ["timeSec", "text"],
      },
    },
  },
  required: ["recap", "keyPoints"],
};

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { video } = body.data;
  try {
    const summary = await generateJson({
      system: `You summarise a lecture for a student revising it. Give a short recap and 5 to 10 key points in the order they are taught, each with the time it is explained. Use only what the lecture says. ${LANGUAGE_RULE}`,
      parts: await lectureParts(video),
      jsonSchema,
      schema: Summary,
    });
    const max = video.durationSec || Infinity;
    return Response.json({
      recap: summary.recap,
      keyPoints: summary.keyPoints.map((k) => ({
        text: k.text,
        timeSec: Math.min(Math.floor(k.timeSec), max),
      })),
    });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
