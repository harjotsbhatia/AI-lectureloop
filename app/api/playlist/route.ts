import { z } from "zod";
import { parseYouTubeUrl } from "@/lib/url";
import { importSource, UserError } from "@/lib/youtube";

const Body = z.object({ url: z.string().min(1).max(500) });

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Paste a YouTube playlist or video link." }, { status: 400 });
  }
  const source = parseYouTubeUrl(parsed.data.url);
  if (!source) {
    return Response.json(
      { error: "That doesn't look like a YouTube playlist or video link." },
      { status: 400 },
    );
  }
  try {
    return Response.json(await importSource(source));
  } catch (e) {
    if (e instanceof UserError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return Response.json({ error: "Could not reach YouTube. Try again." }, { status: 502 });
  }
}
