import { Suspense } from "react";

import { ActivitySidebar } from "@/components/activity/activity-sidebar";
import { AdminEditorShell } from "@/components/editor/admin-editor-shell";
import { getArticleBySlug, listArticleMetadata } from "@/lib/content/articles";

export default async function AdminDashboardPage() {
  const [article, metadata] = await Promise.all([
    getArticleBySlug("guides/getting-started"),
    listArticleMetadata({ includeDrafts: true }),
  ]);

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
                  summary: article.summary ?? "",
                  category: article.category,
                  subcategory: article.subcategory ?? "",
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
