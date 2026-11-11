import { z } from "zod";
import { ai, aiErrorResponse, LANGUAGE_RULE, lectureParts, VideoRef, withModel } from "@/lib/gemini";
import { formatTime } from "@/lib/url";

const Body = z.object({
  video: VideoRef,
  currentTimeSec: z.number().nonnegative(),
  messages: z
    .array(z.object({ role: z.enum(["user", "model"]), text: z.string().min(1).max(8000) }))
    .min(1)
    .max(40),
});

/** Streams the tutor's reply as plain text. */
export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { video, currentTimeSec, messages } = body.data;
  if (messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const parts = await lectureParts(video);
    const system = `You are a patient tutor helping a student with the lecture they are watching. The student is currently at ${formatTime(currentTimeSec)} in the video, so "this", "here" or "what he just said" refers to that part.
- Ground your answers in the lecture. When you point to a moment in it, cite the time in square brackets like [12:34]; the app turns these into links.
- If the lecture does not cover what is asked, say so, then answer from general knowledge and make clear which is which.
- Be concise. Use short markdown, worked steps for problems, and plain language.
${LANGUAGE_RULE}`;
    const stream = await withModel((model, httpOptions) =>
      ai().models.generateContentStream({
        model,
        contents: [
          { role: "user", parts },
          { role: "model", parts: [{ text: "I have the lecture. What would you like to ask?" }] },
          ...messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        ],
        config: { systemInstruction: system, httpOptions },
      }),
    );

    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
            }
            controller.close();
          } catch (e) {
            console.error("Tutor stream failed:", e instanceof Error ? e.message : e);
            controller.error(e);
          }
        },
      }),
      { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return aiErrorResponse(e);
  }
}
