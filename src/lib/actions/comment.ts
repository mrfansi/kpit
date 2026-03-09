"use server";

import { db } from "@/lib/db";
import { kpiComments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-utils";
import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "em", "s", "u",
    "h2", "h3",
    "ul", "ol", "li",
    "a", "img",
    "blockquote", "code", "pre",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
  },
  allowedSchemes: ["http", "https"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
  },
};

function sanitize(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

import { isEmptyHtml } from "@/lib/html-utils";

export async function createComment(kpiId: number, periodDate: string, content: string) {
  const session = await requireAuth();
  const author = session.user.name ?? session.user.email ?? "Admin";
  if (!kpiId || !periodDate) return;

  const clean = sanitize(content);
  if (isEmptyHtml(clean) || clean.length > 50000) return;

  await db.insert(kpiComments).values({ kpiId, periodDate, content: clean, author });
  revalidatePath(`/kpi/${kpiId}`);
}

export async function deleteComment(id: number, kpiId: number) {
  await requireAuth();
  await db.delete(kpiComments).where(eq(kpiComments.id, id));
  revalidatePath(`/kpi/${kpiId}`);
}
