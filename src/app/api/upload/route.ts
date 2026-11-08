import { requireApiSession } from "@/lib/ai/api-helpers";
import { NextRequest, NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { isAllowedImageUpload } from "@/lib/upload-validation";
import { consumeRateLimit } from "@/lib/rate-limit-d1";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const MULTIPART_OVERHEAD = 64 * 1024; // boundaries + part headers
const UPLOADS_PER_HOUR = 30;

export async function POST(req: NextRequest) {
  const { session, error } = await requireApiSession();
  if (error) return error;
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Reject before parsing: formData() would buffer the whole body first.
  const contentLength = Number(req.headers.get("content-length"));
  if (!Number.isFinite(contentLength) || contentLength <= 0 || contentLength > MAX_SIZE + MULTIPART_OVERHEAD) {
    return NextResponse.json(
      { error: "Ukuran unggahan tidak valid atau melebihi 5MB." },
      { status: 413 }
    );
  }

  const quota = await consumeRateLimit(`upload:${session.user.id}`, 3600, UPLOADS_PER_HOUR);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak unggahan. Coba lagi nanti." },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSec) } }
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Content-Type harus multipart/form-data." },
      { status: 400 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Body request tidak valid." },
      { status: 400 }
    );
  }
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum 5MB." }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = isAllowedImageUpload({ declaredType: file.type, extension: ext, buffer });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 });
  }

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  // Served back by src/app/uploads/comments/[file]/route.ts under the same public URL as before.
  await env.UPLOADS.put(`comments/${filename}`, buffer, {
    httpMetadata: { contentType: validation.mimeType },
  });

  return NextResponse.json({ url: `/uploads/comments/${filename}` });
}
