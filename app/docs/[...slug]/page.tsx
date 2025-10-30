import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getArticleBySlug,
  listArticleMetadata,
} from "@/lib/content/articles";
import { Button } from "@/components/ui/button";

type DocsPageProps = {
  params: {
    slug?: string[] | string;
  };
};

export async function generateStaticParams() {
  const articles = await listArticleMetadata();
  return articles.map((article) => ({
    slug: article.slugSegments,
  }));
}

export async function generateMetadata({
  params,
}: DocsPageProps): Promise<Metadata> {
  const slugSegments = normalizeSlug(params.slug);
  if (slugSegments.length === 0) {
    return {
      title: "Article not found",
    };
  }
  const slug = slugSegments.join("/");
  const article = await getArticleBySlug(slug);

  if (!article) {
    return {
      title: "Article not found",
    };
  }

  const description =
    article.summary ??
    `Knowledge base article in ${article.category}${
      article.subcategory ? ` / ${article.subcategory}` : ""
    }.`;

  return {
    title: article.title,
    description,
  };
}

export default async function DocsArticlePage({ params }: DocsPageProps) {
  const slugSegments = normalizeSlug(params.slug);
  if (slugSegments.length === 0) {
    notFound();
  }
  const slug = slugSegments.join("/");
  const article = await getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-8 py-16">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Link
            href="/docs"
            className="transition hover:text-primary hover:underline"
          >
            Knowledge Base
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/docs?category=${encodeURIComponent(article.category)}`}
            className="transition hover:text-primary hover:underline"
          >
            {article.category}
          </Link>
          {article.subcategory ? (
            <>
              <span aria-hidden="true">/</span>
              <span>{article.subcategory}</span>
            </>
          ) : null}
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">
          {article.title}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <time dateTime={article.created}>
            Created: {new Date(article.created).toLocaleDateString()}
          </time>
          {article.updated ? (
            <time dateTime={article.updated}>
              Updated: {new Date(article.updated).toLocaleDateString()}
            </time>
          ) : null}
          <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground/80">
            {article.slug}
          </span>
        </div>
        {article.summary ? (
          <p className="max-w-2xl text-base text-muted-foreground">
            {article.summary}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/docs">Back to index</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={`/api/articles/${slug}`}
              download={`${article.slugSegments.at(-1) ?? "article"}.md`}
            >
              Download Markdown
            </a>
          </Button>
        </div>
      </header>

      <div
        className="prose prose-slate max-w-none dark:prose-invert prose-headings:scroll-mt-24 prose-pre:bg-muted prose-code:text-accent-foreground"
        dangerouslySetInnerHTML={{ __html: article.html }}
      />
    </article>
  );
}

function normalizeSlug(value: DocsPageProps["params"]["slug"]) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    return value.split("/").filter(Boolean);
  }
  return [];
}
