import Link from "next/link";

import { listArticleMetadata } from "@/lib/content/articles";
import { formatDistanceToNow } from "@/lib/date/format-distance";

type ActivityItem = {
  slug: string;
  title: string;
  category?: string;
  updatedAt: string;
  createdAt: string;
  isNew: boolean;
};

const MAX_ITEMS = 8;
const NEW_THRESHOLD_HOURS = 72;

export async function ActivitySidebar() {
  const articles = await listArticleMetadata({ includeDrafts: true });
  const items = articles
    .map<ActivityItem>((article) => {
      const updatedAt = article.updated ?? article.created;
      return {
        slug: article.slug,
        title: article.title,
        category: article.category,
        updatedAt,
        createdAt: article.created,
        isNew: isRecent(updatedAt ?? article.created, NEW_THRESHOLD_HOURS),
      };
    })
    .sort((a, b) => {
      const timeA = new Date(a.updatedAt ?? a.createdAt).getTime();
      const timeB = new Date(b.updatedAt ?? b.createdAt).getTime();
      return timeB - timeA;
    })
    .slice(0, MAX_ITEMS);

  return (
    <aside className="sticky top-28 hidden h-full min-h-[24rem] flex-col gap-4 lg:flex">
      <div className="flex flex-col gap-2 rounded-2xl border bg-card/80 p-5 shadow-sm">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-muted-foreground">
          <span>Activity</span>
          <span>{items.length}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Latest knowledge base edits across all categories.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card/70 p-5 shadow-sm">
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={`${item.slug}-${item.updatedAt}`}
              className="rounded-lg border border-border/60 bg-background/90 p-3 shadow-sm transition hover:border-primary/50"
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/docs/${item.slug}`}
                  className="font-medium text-foreground transition hover:text-primary"
                >
                  {item.title}
                </Link>
                {item.isNew ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
                    New
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{item.slug}</span>
                {item.category ? (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>{item.category}</span>
                  </>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Updated {formatDistanceToNow(item.updatedAt)} ago
              </div>
              <div className="mt-2 flex gap-2">
                <Link
                  href={`/docs/${item.slug}`}
                  className="rounded-md border border-primary/30 px-2 py-1 text-xs text-primary transition hover:bg-primary/10"
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
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Activity list is generated from Markdown metadata during this request.
          Long-term, we can move this to a realtime feed powered by file-system
          watchers or database events.
        </p>
      </div>
    </aside>
  );
}

function isRecent(isoDate: string, thresholdHours: number) {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) return false;
  const diffMs = Date.now() - timestamp;
  const thresholdMs = thresholdHours * 60 * 60 * 1000;
  return diffMs <= thresholdMs;
}
