import path from "node:path";

import chokidar from "chokidar";

import { listArticleMetadata } from "@/lib/content/articles";

type Subscriber = (payload: ActivityUpdate) => void;

type ActivityUpdate = {
  type: "update" | "delete";
  slug: string;
  title: string;
  category?: string;
  updatedAt: string;
  createdAt: string;
  isDraft: boolean;
};

type WatcherController = {
  subscribe: (subscriber: Subscriber) => () => void;
};

const CONTENT_GLOB = path.join(process.cwd(), "content", "**", "*.md");

let controller: WatcherController | null = null;

export function getActivityWatcher() {
  if (controller) {
    return controller;
  }

  const subscribers = new Set<Subscriber>();

  const watcher = chokidar.watch(CONTENT_GLOB, {
    ignoreInitial: true,
  });

  const emit = (payload: ActivityUpdate) => {
    for (const subscriber of subscribers) {
      subscriber(payload);
    }
  };

  const handleChange = async (filePath: string, type: "update" | "delete") => {
    const slug = filePathToSlug(filePath);
    if (!slug) return;

    const metadata = await listArticleMetadata({ includeDrafts: true });
    const article = metadata.find((item) => item.slug === slug);

    if (!article) {
      emit({
        type: "delete",
        slug,
        title: slug.split("/").at(-1) ?? slug,
        category: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDraft: false,
      });
      return;
    }

    emit({
      type,
      slug: article.slug,
      title: article.title,
      category: article.category,
      createdAt: article.created,
      updatedAt: article.updated ?? article.created,
      isDraft: article.draft ?? false,
    });
  };

  watcher
    .on("add", (filePath) => handleChange(filePath, "update"))
    .on("change", (filePath) => handleChange(filePath, "update"))
    .on("unlink", (filePath) => handleChange(filePath, "delete"))
    .on("error", (error) => {
      console.error("[ActivityWatcher] watcher error", error);
    });

  controller = {
    subscribe(subscriber: Subscriber) {
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
        if (subscribers.size === 0) {
          watcher
            .close()
            .catch((error) =>
              console.error("[ActivityWatcher] error closing watcher", error)
            );
          controller = null;
        }
      };
    },
  };

  return controller;
}

function filePathToSlug(filePath: string) {
  const relative = path.relative(path.join(process.cwd(), "content"), filePath);
  if (!relative || relative.startsWith("..")) return null;
  return relative.replace(/\.md$/i, "").replace(/\\/g, "/");
}

export type { ActivityUpdate, WatcherController };
