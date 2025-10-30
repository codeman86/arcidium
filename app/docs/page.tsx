import Link from "next/link";

import { listArticleMetadata } from "@/lib/content/articles";

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(isoDate));
}

type ArticleCollection = Awaited<ReturnType<typeof listArticleMetadata>>;
type ArticleMetaItem = ArticleCollection[number];

export default async function DocsIndexPage() {
  const articles = await listArticleMetadata();

  if (articles.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-8 py-16">
        <header className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            Arcidium Knowledge Base
          </h1>
          <p className="text-muted-foreground">
            Add Markdown articles to the <code>content/</code> directory to see
            them appear here.
          </p>
        </header>
      </div>
    );
  }

  const groupedByCategory = articles.reduce<
    Record<string, { label: string; items: ArticleMetaItem[] }>
  >((acc, article) => {
      const categoryKey =
        article.category?.toLowerCase().replace(/\s+/g, "-") ?? "uncategorized";
      if (!acc[categoryKey]) {
        acc[categoryKey] = {
          label: article.category ?? "Uncategorized",
          items: [],
        };
      }
      acc[categoryKey].items.push(article);
      return acc;
    }, {});

  const sortedCategories = Object.values(groupedByCategory).map((category) => ({
    ...category,
    items: [...category.items].sort((a, b) => {
      const dateA = new Date(a.updated ?? a.created).getTime();
      const dateB = new Date(b.updated ?? b.created).getTime();
      return dateB - dateA;
    }),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-12 py-16">
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">
          Arcidium Knowledge Base
        </h1>
        <p className="text-muted-foreground">
          Browse Markdown-authored knowledge grouped by category. Each entry is
          sourced directly from the <code>content/</code> directory.
        </p>
      </header>

      <div className="space-y-12">
        {sortedCategories.map((category) => (
          <section key={category.label} className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">{category.label}</h2>
              <p className="text-sm text-muted-foreground">
                {category.items.length}{" "}
                {category.items.length === 1 ? "article" : "articles"}
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {category.items.map((article) => (
                <Link
                  key={article.slug}
                  href={`/docs/${article.slug}`}
                  className="group flex h-full flex-col justify-between rounded-2xl border bg-card/70 p-5 transition hover:border-primary/60 hover:shadow-lg"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      <span>{article.subcategory ?? "General"}</span>
                      <div className="flex items-center gap-2">
                        {isRecentlyUpdated(article.updated ?? article.created) ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
                            New
                          </span>
                        ) : null}
                        <span>{formatDate(article.updated ?? article.created)}</span>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold leading-tight group-hover:text-primary">
                      {article.title}
                    </h3>
                    {article.summary ? (
                      <p className="text-sm text-muted-foreground">
                        {article.summary}
                      </p>
                    ) : null}
                  </div>
                  {article.tags.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {article.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function isRecentlyUpdated(isoDate: string, thresholdDays = 3) {
  const updatedTime = new Date(isoDate).getTime();
  if (Number.isNaN(updatedTime)) {
    return false;
  }

  const diff = Date.now() - updatedTime;
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  return diff >= 0 && diff <= thresholdMs;
}
