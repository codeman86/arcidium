import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import {
  getArticleBySlug,
  type ArticleFrontMatter,
  type NormalizedArticleFrontMatter,
} from "@/lib/content/articles";
import {
  normalizeSlug,
  saveArticleToFile,
  slugToFilePath,
} from "@/lib/content/persistence";

type ArticleMutationPayload = {
  slug: string;
  title: string;
  summary?: string;
  category?: string;
  subcategory?: string;
  tags?: string[] | string;
  created?: string;
  draft?: boolean;
  content: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<ArticleMutationPayload>;
    const payload = validatePayload(body);

    const slugSegments = normalizeSlug(payload.slug);
    const slug = slugSegments.join("/");

    const existing = await getArticleBySlug(slug);
    const now = new Date().toISOString();

    const frontMatter: NormalizedArticleFrontMatter = {
      title: payload.title,
      summary: payload.summary,
      category: payload.category ?? existing?.category,
      subcategory: payload.subcategory ?? existing?.subcategory,
      tags: normalizeTags(payload.tags ?? existing?.tags ?? []),
      created: coerceIsoString(payload.created ?? existing?.created ?? now),
      updated: now,
      draft: payload.draft ?? existing?.draft ?? false,
    };

    await saveArticleToFile({
      slug,
      frontMatter,
      content: payload.content,
    });

    const updatedArticle = await getArticleBySlug(slug);

    await triggerRevalidation(slug);

    return NextResponse.json(
      {
        ok: true,
        article: updatedArticle,
        location: slugToFilePath(slug),
      },
      { status: existing ? 200 : 201 }
    );
  } catch (error) {
    console.error("[Arcidium] Article persistence error", error);
    const message =
      error instanceof Error ? error.message : "Unable to save article.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

function validatePayload(
  body: Partial<ArticleMutationPayload>
): ArticleMutationPayload {
  if (!body.slug || typeof body.slug !== "string") {
    throw new Error("A valid article slug is required.");
  }
  if (!body.title || typeof body.title !== "string") {
    throw new Error("Article title is required.");
  }
  if (!body.content || typeof body.content !== "string") {
    throw new Error("Article content is required.");
  }

  return {
    slug: body.slug.trim(),
    title: body.title.trim(),
    summary: typeof body.summary === "string" ? body.summary.trim() : undefined,
    category:
      typeof body.category === "string" ? body.category.trim() : undefined,
    subcategory:
      typeof body.subcategory === "string"
        ? body.subcategory.trim()
        : undefined,
    tags: body.tags,
    created: body.created,
    draft: typeof body.draft === "boolean" ? body.draft : undefined,
    content: body.content,
  };
}

function normalizeTags(value: ArticleFrontMatter["tags"]) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function coerceIsoString(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

async function triggerRevalidation(slug: string) {
  revalidatePath("/");
  revalidatePath("/docs");
  revalidatePath(`/docs/${slug}`);
  revalidatePath("/search");
  revalidatePath("/admin");
}
