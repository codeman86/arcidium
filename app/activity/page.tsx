import Link from "next/link";

import { ActivityStreamListener } from "@/components/activity/activity-stream-listener";
import { listArticleMetadata } from "@/lib/content/articles";
import { formatDistanceToNow } from "@/lib/date/format-distance";

const NEW_THRESHOLD_DAYS = 3;

export const metadata = {
  title: "Activity • Arcidium",
  description: "Timeline of recent Arcidium knowledge base updates across all categories.",
};

export default async function ActivityPage() {
  const articles = await listArticleMetadata({ includeDrafts: true });

  if (articles.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-10 py-16">
        <header className="space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">Knowledge Base Activity</h1>
          <p className="text-muted-foreground">
            As soon as the first Markdown article is added or updated, it will appear here with a
            timestamp.
          </p>
        </header>

        <p className="text-sm text-muted-foreground">
          Tip: Drop a Markdown file in <code>content/</code>, or create one via the admin editor,
          then revisit this page.
        </p>
        <ActivityStreamListener />
      </div>
    );
  }

  const timeline = articles
    .map((article) => {
      const timestamp = new Date(article.updated ?? article.created);
      return {
        slug: article.slug,
        title: article.title,
        category: article.category,
        summary: article.summary,
        tags: article.tags,
        updatedAt: timestamp,
        createdAt: new Date(article.created),
        isDraft: article.draft,
        isNew: isRecentlyUpdated(timestamp, NEW_THRESHOLD_DAYS),
      };
    })
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-16">
      <header className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight">Knowledge Base Activity</h1>
        <p className="text-muted-foreground">
          Latest updates across categories, pulled from Markdown front matter. Newly updated entries
          are tagged, and drafts are noted.
        </p>
      </header>

      <ol className="relative border-l border-border/60 pl-6">
        {timeline.map((item) => (
          <li key={`${item.slug}-${item.updatedAt.toISOString()}`} className="mb-10 ml-4">
            <div className="absolute -left-[9px] top-2 h-3 w-3 rounded-full border border-background bg-primary shadow-sm" />
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
              <span>{formatDistanceToNow(item.updatedAt)} ago</span>
              {item.isDraft ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                  Draft
                </span>
              ) : null}
              {item.isNew ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
                  New
                </span>
              ) : null}
            </div>

            <div className="mt-3 flex flex-col gap-3 rounded-2xl border bg-card/75 p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/docs/${item.slug}`}
                  className="text-lg font-semibold text-foreground transition hover:text-primary"
                >
                  {item.title}
                </Link>
                <div className="flex gap-2">
                  <Link
                    href={`/docs/${item.slug}`}
                    className="rounded-md border border-primary/40 px-2 py-1 text-xs text-primary transition hover:bg-primary/10"
                  >
                    View
                  </Link>
                  <a
                    href={`/api/articles/${item.slug}`}
                    download={`${item.slug.split("/").at(-1) ?? "article"}.md`}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                  >
                    Download
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{item.slug}</span>
                {item.category ? (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>{item.category}</span>
                  </>
                ) : null}
              </div>

              {item.summary ? (
                <p className="text-sm text-muted-foreground">{item.summary}</p>
              ) : null}

              {item.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <ActivityStreamListener />
    </div>
  );
}

function isRecentlyUpdated(date: Date, thresholdDays: number) {
  const diff = Date.now() - date.getTime();
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  return diff >= 0 && diff <= thresholdMs;
}
