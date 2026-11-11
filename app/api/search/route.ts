import { z } from "zod";
import { searchEducational, UserError } from "@/lib/youtube";

const Body = z.object({ query: z.string().trim().min(2).max(120) });

/** Education-only video search. The restriction is enforced in lib/youtube.ts. */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Type a topic to search for." }, { status: 400 });
  }
  try {
    return Response.json({ results: await searchEducational(parsed.data.query) });
  } catch (e) {
    if (e instanceof UserError) {
      const quota = /quota/i.test(e.message);
      return Response.json(
        {
          error: quota
            ? "The YouTube key's daily search allowance is used up. It resets at midnight Pacific time."
            : e.message,
        },
        { status: quota ? 429 : e.status },
      );
    }
    console.error(e);
    return Response.json({ error: "Could not reach YouTube. Try again." }, { status: 502 });
  }
}
