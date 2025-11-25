import Link from 'next/link';

import { listArticleMetadata } from '@/lib/content/articles';
import { formatDistanceToNow } from '@/lib/date/format-distance';

type ActivityItem = {
  slug: string;
  title: string;
  category?: string;
  updatedAt: string;
  createdAt: string;
  isNew: boolean;
};

const MAX_ITEMS = 12;
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
          <span>Articles</span>
          <span>{articles.length}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Jump between docs or monitor when something was last updated.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-card/70 p-5 shadow-sm">
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={`${item.slug}-${item.updatedAt}`}
              className="rounded-lg border border-border/60 bg-background/90 p-4 shadow-sm transition hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Link
                    href={`/docs/${item.slug}`}
                    className="font-medium text-foreground transition hover:text-primary"
                  >
                    {item.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Last modified {formatDistanceToNow(item.updatedAt)} ago ·{' '}
                    {formatAbsoluteTimestamp(item.updatedAt)}
                  </p>
                </div>
                {item.isNew ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
                    New
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{item.slug}</span>
                {item.category ? (
                  <>
                    <span aria-hidden="true">•</span>
                    <span>{item.category}</span>
                  </>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/admin?slug=${encodeURIComponent(item.slug)}`}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  Edit
                </Link>
                <Link
                  href={`/docs/${item.slug}`}
                  className="rounded-md border border-primary/30 px-2 py-1 text-xs text-primary transition hover:bg-primary/10"
                >
                  View
                </Link>
                <a
                  href={`/api/articles/${item.slug}`}
                  download={`${item.slug.split('/').at(-1) ?? 'article'}.md`}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  Download
                </a>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Sidebar list is generated from Markdown metadata during each visit.
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

function formatAbsoluteTimestamp(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
