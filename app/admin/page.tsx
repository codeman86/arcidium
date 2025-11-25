import { Suspense } from 'react';

import { ActivitySidebar } from '@/components/activity/activity-sidebar';
import { AdminEditorShell } from '@/components/editor/admin-editor-shell';
import { getArticleBySlug, listArticleMetadata } from '@/lib/content/articles';

type AdminDashboardPageProps = {
  searchParams?: {
    slug?: string;
    new?: string;
  };
};

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const metadata = await listArticleMetadata({ includeDrafts: true });

  const fallbackSlug = metadata.at(0)?.slug ?? 'guides/getting-started';
  const requestedSlugParam =
    typeof searchParams?.slug === 'string' &&
    searchParams.slug.trim().length > 0
      ? searchParams.slug
      : undefined;
  const shouldStartBlank = searchParams?.new === '1';
  const slugToLoad = shouldStartBlank
    ? null
    : (requestedSlugParam ?? fallbackSlug);

  const article = slugToLoad ? await getArticleBySlug(slugToLoad) : null;

  const existingSlugs = metadata.map((item) => item.slug);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Article Editor
        </h1>
        <p className="text-muted-foreground">
          Draft knowledge base updates, manage metadata, and stay on top of
          recent activity.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <AdminEditorShell
          article={
            article
              ? {
                  slug: article.slug,
                  title: article.title,
                  summary: article.summary ?? '',
                  category: article.category,
                  subcategory: article.subcategory ?? '',
                  tags: article.tags,
                  created: article.created,
                  updated: article.updated,
                  draft: article.draft,
                  content: article.content,
                }
              : null
          }
          existingSlugs={existingSlugs}
        />
        <Suspense fallback={<ActivitySidebarSkeleton />}>
          <ActivitySidebar />
        </Suspense>
      </div>
    </div>
  );
}

function ActivitySidebarSkeleton() {
  return (
    <aside className="sticky top-28 hidden min-h-[24rem] flex-col gap-4 lg:flex">
      <div className="h-24 rounded-2xl border bg-card/60 shadow-sm" />
      <div className="flex flex-1 flex-col gap-3 rounded-2xl border bg-card/60 p-5 shadow-sm">
        <div className="h-5 w-24 rounded bg-muted/60" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-16 rounded-xl border border-border/70 bg-background/80"
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
