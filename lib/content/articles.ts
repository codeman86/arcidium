import { promises as fs } from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

export const CONTENT_ROOT = path.join(process.cwd(), "content");

export type ArticleFrontMatter = {
  title: string;
  summary?: string;
  category?: string;
  subcategory?: string;
  tags?: string[] | string;
  created: string;
  updated?: string;
  draft?: boolean;
};

export type NormalizedArticleFrontMatter = Omit<ArticleFrontMatter, "tags"> & {
  tags: string[];
};

export type ArticleMeta = {
  slug: string;
  slugSegments: string[];
  title: string;
  summary?: string;
  category: string;
  subcategory?: string;
  tags: string[];
  created: string;
  updated?: string;
  draft: boolean;
  filePath: string;
};

export type Article = ArticleMeta & {
  content: string;
  html: string;
};

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeStringify, { allowDangerousHtml: true });

export async function getAllArticles(options?: { includeDrafts?: boolean }) {
  const includeDrafts = options?.includeDrafts ?? false;

  const filePaths = await readMarkdownFilePaths(CONTENT_ROOT);
  const articles = await Promise.all(filePaths.map(parseArticleFromFile));
  return articles.filter((article) => includeDrafts || !article.draft);
}

export async function getArticleBySlug(slug: string) {
  const target = slug.replace(/^\//, "");
  const filePath = path.join(CONTENT_ROOT, `${target}.md`);

  const stat = await safeStat(filePath);
  if (!stat?.isFile()) {
    return null;
  }

  return parseArticleFromFile(filePath);
}

export async function listArticleMetadata(options?: {
  includeDrafts?: boolean;
}) {
  const articles = await getAllArticles(options);
  return articles.map<ArticleMeta>(
    ({ content: _content, html: _html, ...meta }) => meta
  );
}

async function parseArticleFromFile(filePath: string): Promise<Article> {
  const fileContents = await fs.readFile(filePath, "utf8");
  const { data, content } = matter(fileContents);

  const frontMatter = normalizeFrontMatter(data, filePath);

  const relativePath = path.relative(CONTENT_ROOT, filePath);
  const slugSegments = removeFileExtension(relativePath).split(path.sep);
  const slug = slugSegments.join("/");

  const html = String(await markdownProcessor.process(content));

  return {
    slug,
    slugSegments,
    title: frontMatter.title,
    summary: frontMatter.summary,
    category: frontMatter.category ?? slugSegments[0] ?? "uncategorized",
    subcategory: frontMatter.subcategory ?? slugSegments[1],
    tags: frontMatter.tags,
    created: frontMatter.created,
    updated: frontMatter.updated,
    draft: frontMatter.draft ?? false,
    filePath,
    content,
    html,
  };
}

async function readMarkdownFilePaths(dir: string): Promise<string[]> {
  const entries = await safeReadDir(dir);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry);
      const stat = await safeStat(entryPath);

      if (!stat) return [];

      if (stat.isDirectory()) {
        return readMarkdownFilePaths(entryPath);
      }

      return entry.toLowerCase().endsWith(".md") ? [entryPath] : [];
    })
  );

  return files.flat();
}

async function safeReadDir(dir: string): Promise<string[]> {
  try {
    return await fs.readdir(dir);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function safeStat(filePath: string) {
  try {
    return await fs.stat(filePath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function normalizeFrontMatter(
  data: Record<string, unknown>,
  filePath: string
): NormalizedArticleFrontMatter {
  if (typeof data.title !== "string" || data.title.trim().length === 0) {
    throw new Error(
      `Missing required "title" in front matter for ${filePath}`
    );
  }

  if (typeof data.created !== "string") {
    throw new Error(
      `Missing required "created" (ISO date string) in front matter for ${filePath}`
    );
  }

  return {
    title: data.title,
    summary:
      typeof data.summary === "string" ? data.summary.trim() : undefined,
    category:
      typeof data.category === "string" ? data.category.trim() : undefined,
    subcategory:
      typeof data.subcategory === "string"
        ? data.subcategory.trim()
        : undefined,
    tags: coerceTags(data.tags),
    created: data.created,
    updated:
      typeof data.updated === "string" ? data.updated.trim() : undefined,
    draft: typeof data.draft === "boolean" ? data.draft : false,
  };
}

function coerceTags(value: unknown) {
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

function removeFileExtension(filePath: string) {
  const ext = path.extname(filePath);
  return ext ? filePath.slice(0, -ext.length) : filePath;
}
