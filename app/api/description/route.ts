import { fetchDescription, UserError } from "@/lib/youtube";

/** GET /api/description?id=VIDEO_ID → { description } */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[\w-]{11}$/.test(id)) {
    return Response.json({ error: "Invalid video id." }, { status: 400 });
  }
  try {
    return Response.json(
      { description: await fetchDescription(id) },
      // Descriptions rarely change; let the CDN and browser reuse them for a day.
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
    );
  } catch (e) {
    if (e instanceof UserError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "Could not reach YouTube. Try again." }, { status: 502 });
  }
}
