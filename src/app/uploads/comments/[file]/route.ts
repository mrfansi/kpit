import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Comment images used to be static files in public/uploads/comments; stored HTML
// still references /uploads/comments/<file>, so they are served from R2 at the same path.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  if (!(await auth())?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { file } = await params;
  if (!/^[\w-]+\.(jpe?g|png|gif|webp)$/i.test(file)) return new Response("Not found", { status: 404 });

  const object = await env.UPLOADS.get(`comments/${file}`);
  if (!object) return new Response("Not found", { status: 404 });

  return new Response(object.body as ReadableStream, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      // File names are unique per upload and never overwritten; private because the image requires a login.
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: object.httpEtag,
    },
  });
}
