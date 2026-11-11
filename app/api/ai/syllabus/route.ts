import { z } from "zod";
import { aiErrorResponse, generateJson } from "@/lib/gemini";
import { formatDuration } from "@/lib/url";

const Body = z.object({
  courseTitle: z.string().max(300),
  videos: z
    .array(
      z.object({
        id: z.string().min(1).max(20),
        title: z.string().max(300),
        durationSec: z.number().nonnegative(),
      }),
    )
    .min(2)
    .max(500),
});

const Outline = z.object({
  chapters: z
    .array(z.object({ title: z.string().min(1), firstLesson: z.number().int().min(1) }))
    .min(1),
});

const jsonSchema = {
  type: "object",
  properties: {
    chapters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short chapter name, without numbering" },
          firstLesson: {
            type: "integer",
            description: "Number of the first lesson in this chapter",
          },
        },
        required: ["title", "firstLesson"],
      },
    },
  },
  required: ["chapters"],
};

/** Groups a playlist into chapters. Lesson order is kept; the model only chooses where chapters begin. */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { courseTitle, videos } = body.data;

  const list = videos
    .map((v, i) => `${i + 1}. ${v.title} (${formatDuration(v.durationSec)})`)
    .join("\n");
  try {
    const outline = await generateJson({
      system:
        "You organise a video playlist into a course outline. Keep the lessons in their given order and split them into consecutive chapters by topic. Aim for chapters of roughly 3 to 10 lessons; a short playlist may need only two or three chapters. The first chapter must start at lesson 1.",
      parts: [{ text: `Course: ${courseTitle}\n\nLessons:\n${list}` }],
      jsonSchema,
      schema: Outline,
    });

    const starts = outline.chapters
      .filter((c) => c.firstLesson <= videos.length)
      .sort((a, b) => a.firstLesson - b.firstLesson)
      .filter((c, i, arr) => i === 0 || c.firstLesson !== arr[i - 1].firstLesson);
    if (starts.length === 0) throw new Error("empty outline");
    starts[0] = { ...starts[0], firstLesson: 1 };

    const chapters = starts.map((c, i) => ({
      title: c.title,
      videoIds: videos
        .slice(c.firstLesson - 1, i + 1 < starts.length ? starts[i + 1].firstLesson - 1 : undefined)
        .map((v) => v.id),
    }));
    return Response.json({ chapters });
  } catch (e) {
    return aiErrorResponse(e);
  }
}
