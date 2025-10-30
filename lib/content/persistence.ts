import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import { CONTENT_ROOT, type NormalizedArticleFrontMatter } from "@/lib/content/articles";

export type ArticleSavePayload = {
  slug: string;
  frontMatter: NormalizedArticleFrontMatter;
  content: string;
};

export function slugToFilePath(slug: string) {
  const normalized = normalizeSlug(slug);
  const relativePath = normalized.join("/");
  return path.join(CONTENT_ROOT, `${relativePath}.md`);
}

export async function saveArticleToFile({ slug, frontMatter, content }: ArticleSavePayload) {
  const filePath = slugToFilePath(slug);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const markdown = serializeMarkdown(frontMatter, content);
  await fs.writeFile(filePath, ensureTrailingNewline(markdown), "utf8");
  return filePath;
}

export function normalizeSlug(input: string) {
  const cleaned = input.replace(/\\/g, "/").split("/").filter(Boolean);
  if (cleaned.length === 0) {
    throw new Error("Article slug cannot be empty.");
  }
  if (cleaned.some((segment) => segment === "..")) {
    throw new Error("Article slug must not contain parent directory segments.");
  }
  const segmentPattern = /^[a-z0-9](?:[a-z0-9-_]*[a-z0-9])?$/i;
  for (const segment of cleaned) {
    if (!segmentPattern.test(segment)) {
      throw new Error(
        "Article slug segments may only contain alphanumeric characters, hyphens, or underscores and must start/end with a letter or number.",
      );
    }
  }
  return cleaned;
}

function serializeMarkdown(frontMatter: NormalizedArticleFrontMatter, content: string) {
  const data = filterUndefined({
    title: frontMatter.title,
    summary: frontMatter.summary,
    category: frontMatter.category,
    subcategory: frontMatter.subcategory,
    tags: frontMatter.tags.length > 0 ? frontMatter.tags : undefined,
    created: frontMatter.created,
    updated: frontMatter.updated,
    draft: frontMatter.draft ?? undefined,
  });

  return matter.stringify(normalizeContent(content), data);
}

function normalizeContent(content: string) {
  if (!content) {
    return "\n";
  }
  return content.endsWith("\n") ? content : `${content}\n`;
}

function ensureTrailingNewline(value: string) {
  return value.endsWith("\n") ? value : `${value}\n`;
}

function filterUndefined<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        !(typeof value === "string" && value.trim().length === 0),
    ),
  );
}
