import { getAllArticles } from "@/lib/content/articles";
import {
  buildTaxonomy,
  type TaxonomyCategory,
} from "@/lib/content/taxonomy";

export type SearchDocument = {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  category: string;
  categorySlug: string;
  subcategory?: string;
  subcategorySlug?: string;
  tags: string[];
  tagSlugs: string[];
  excerpt: string;
  content: string;
};

export async function buildSearchIndex(): Promise<SearchDocument[]> {
  const articles = await getAllArticles();
  return articles.map(transformArticleToDocument);
}

export async function buildSearchDataset(): Promise<{
  documents: SearchDocument[];
  taxonomy: TaxonomyCategory[];
}> {
  const articles = await getAllArticles();
  const documents = articles.map(transformArticleToDocument);
  const taxonomy = buildTaxonomy(articles);
  return { documents, taxonomy };
}

function transformArticleToDocument(article: Awaited<
  ReturnType<typeof getAllArticles>
>[number]): SearchDocument {
  const categorySlug = toFilterSlug(article.category ?? "uncategorized");
  const subcategorySlug = article.subcategory
    ? toFilterSlug(article.subcategory)
    : undefined;

  return {
    id: article.slug,
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    category: article.category,
    categorySlug,
    subcategory: article.subcategory,
    subcategorySlug,
    tags: article.tags,
    tagSlugs: article.tags.map((tag) => toFilterSlug(tag)),
    content: stripMarkdown(article.content),
    excerpt: createExcerpt(article.html),
  };
}

function createExcerpt(html: string, maxWords = 40) {
  const text = stripHtml(html);
  if (!text) return "";
  const words = text.split(/\s+/).filter(Boolean);
  const excerpt = words.slice(0, maxWords).join(" ");
  return words.length > maxWords ? `${excerpt}…` : excerpt;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function stripMarkdown(markdown: string) {
  return markdown
    .replace(/[`*_~>#-]+/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/!\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function toFilterSlug(value: string | undefined) {
  if (!value) return "uncategorized";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
