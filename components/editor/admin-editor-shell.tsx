"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useDebouncedCallback } from "use-debounce";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

import { Button } from "@/components/ui/button";
import { ToastVariant, useToast } from "@/components/ui/use-toast";
import { MarkdownEditor } from "@/components/editor/markdown-editor";
import { ACTIVITY_EVENT_NAME, type ActivityStreamPayload } from "@/lib/activity/stream";
import { cn } from "@/lib/utils";

type AdminEditorShellProps = {
  article: {
    slug: string;
    title: string;
    summary?: string;
    category: string;
    subcategory?: string;
    tags: string[];
    created: string;
    updated?: string;
    draft: boolean;
    content: string;
  } | null;
  existingSlugs: string[];
};

type DraftState = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  subcategory: string;
  tags: string;
  created: string;
  draft: boolean;
  markdown: string;
};

type SaveStatus =
  | { type: "idle"; message?: string }
  | { type: "saving"; message: string }
  | { type: "saved"; message: string }
  | { type: "error"; message: string };

type SaveInfo = {
  slug: string;
  title?: string;
  location?: string;
  isNew: boolean;
  timestamp: string;
  source: "local" | "remote";
};

const DEFAULT_MARKDOWN = "# New Arcidium Article\n\nStart writing your documentation here.\n";

export function AdminEditorShell({ article, existingSlugs }: AdminEditorShellProps) {
  const initialDraft = React.useMemo(() => createInitialDraft(article), [article]);
  const [draft, setDraft] = React.useState<DraftState>(initialDraft);
  const lastSavedRef = React.useRef<DraftState>(initialDraft);
  const initialSlugRef = React.useRef(initialDraft.slug);
  const router = useRouter();
  const [isDirty, setIsDirty] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState<SaveStatus>({
    type: "idle",
    message: article ? "Loaded article." : "Ready to draft.",
  });
  const [recentSaves, setRecentSaves] = React.useState<SaveInfo[]>(() =>
    article
      ? [
          {
            slug: article.slug,
            title: article.title,
            location: undefined,
            isNew: false,
            timestamp: article.updated ?? article.created,
            source: "local",
          },
        ]
      : [],
  );
  const [knownSlugs, setKnownSlugs] = React.useState<string[]>(() =>
    Array.from(new Set(existingSlugs)),
  );
  const [previewMode, setPreviewMode] = React.useState<"edit" | "preview">("edit");
  const [previewHtml, setPreviewHtml] = React.useState<string>("");
  const [previewLoading, setPreviewLoading] = React.useState<boolean>(false);
  const { toast } = useToast();
  const abortRef = React.useRef<AbortController | null>(null);
  const lastAutosaveToastRef = React.useRef<number>(0);
  const refreshTimerRef = React.useRef<number | null>(null);
  const activitySearchTimestampRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    setKnownSlugs((current) => Array.from(new Set([...current, ...existingSlugs])));
  }, [existingSlugs]);

  React.useEffect(() => {
    let cancelled = false;
    setPreviewLoading(true);

    async function convert() {
      try {
        const file = await unified()
          .use(remarkParse)
          .use(remarkGfm)
          .use(remarkRehype, { allowDangerousHtml: true })
          .use(rehypeStringify, { allowDangerousHtml: true })
          .process(draft.markdown || "");

        if (!cancelled) {
          setPreviewHtml(String(file));
        }
      } catch (error) {
        console.error("[AdminEditor] Failed to render preview", error);
        if (!cancelled) {
          setPreviewHtml("<p class='text-destructive'>Preview unavailable.</p>");
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    }

    convert();

    return () => {
      cancelled = true;
    };
  }, [draft.markdown]);

  const updateDraft = React.useCallback((updater: (prev: DraftState) => DraftState) => {
    setDraft((prev) => {
      const next = updater(prev);
      setIsDirty(!draftsEqual(next, lastSavedRef.current));
      return next;
    });
  }, []);

  const slugError = React.useMemo(() => {
    const slug = draft.slug.trim();
    if (!slug) {
      return "Slug is required.";
    }
    if (slug !== initialSlugRef.current && knownSlugs.includes(slug)) {
      return "Slug already exists.";
    }
    return null;
  }, [draft.slug, knownSlugs]);

  const persistDraft = React.useCallback(
    async (nextDraft: DraftState, options?: { manual?: boolean }) => {
      const slug = nextDraft.slug.trim();
      const title = nextDraft.title.trim();

      if (!slug) {
        setStatus({
          type: "error",
          message: "Add a slug (e.g. guides/new-article) before saving.",
        });
        return;
      }

      if (!title) {
        setStatus({
          type: "error",
          message: "Title is required before saving.",
        });
        return;
      }

      if (slug !== initialSlugRef.current && knownSlugs.includes(slug)) {
        setStatus({
          type: "error",
          message: "Slug already exists. Choose a unique slug before saving.",
        });
        return;
      }

      try {
        if (abortRef.current) {
          abortRef.current.abort();
        }

        const controller = new AbortController();
        abortRef.current = controller;

        setStatus({
          type: "saving",
          message: options?.manual ? "Saving changes…" : "Autosaving…",
        });

        const payload = {
          slug,
          title,
          summary: nextDraft.summary || undefined,
          category: nextDraft.category || undefined,
          subcategory: nextDraft.subcategory || undefined,
          tags: splitTagsString(nextDraft.tags),
          created: ensureIsoString(nextDraft.created),
          draft: nextDraft.draft,
          content: nextDraft.markdown,
        };

        const response = await fetch("/api/articles", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(typeof data?.error === "string" ? data.error : "Failed to save article.");
        }

        const serverArticle = data?.article ?? null;
        const savedDraft: DraftState = {
          slug: (serverArticle?.slug as string | undefined) ?? slug,
          title: (serverArticle?.title as string | undefined) ?? title,
          summary: (serverArticle?.summary as string | undefined) ?? nextDraft.summary,
          category: (serverArticle?.category as string | undefined) ?? nextDraft.category,
          subcategory: (serverArticle?.subcategory as string | undefined) ?? nextDraft.subcategory,
          tags: (
            (serverArticle?.tags as string[] | undefined) ?? splitTagsString(nextDraft.tags)
          ).join(", "),
          created:
            (serverArticle?.created as string | undefined) ?? ensureIsoString(nextDraft.created),
          draft: (serverArticle?.draft as boolean | undefined) ?? nextDraft.draft,
          markdown: (serverArticle?.content as string | undefined) ?? nextDraft.markdown,
        };

        lastSavedRef.current = savedDraft;
        setDraft(savedDraft);
        setIsDirty(false);
        const now = new Date();
        setStatus({
          type: "saved",
          message: options?.manual ? "Draft saved." : `Autosaved ${formatTime(now)}`,
        });
        const saveRecord: SaveInfo = {
          slug: savedDraft.slug,
          title: savedDraft.title,
          location: typeof data?.location === "string" ? data.location : undefined,
          isNew: response.status === 201,
          timestamp: now.toISOString(),
          source: "local",
        };
        setRecentSaves((current) => {
          const existingIndex = current.findIndex((item) => item.slug === saveRecord.slug);
          const next =
            existingIndex >= 0
              ? [saveRecord, ...current.filter((_, idx) => idx !== existingIndex)]
              : [saveRecord, ...current];
          return next.slice(0, 5);
        });
        triggerToastFeedback({
          toast,
          isManual: options?.manual ?? false,
          lastAutosaveToastRef,
          payload: {
            title:
              response.status === 201
                ? "Article created"
                : options?.manual
                  ? "Draft saved"
                  : "Autosaved",
            description:
              response.status === 201
                ? `Created ${savedDraft.slug}`
                : options?.manual
                  ? `Saved at ${formatTime(now)}`
                  : `Autosaved at ${formatTime(now)}`,
          },
        });

        setKnownSlugs((current) =>
          current.includes(savedDraft.slug) ? current : [...current, savedDraft.slug],
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("[Arcidium] article save error", error);
        const message = error instanceof Error ? error.message : "Unable to save article.";
        setStatus({ type: "error", message });
        toast({
          variant: "destructive",
          title: "Save failed",
          description: message,
        });
      } finally {
        abortRef.current = null;
      }
    },
    [knownSlugs, toast],
  );

  const autosave = useDebouncedCallback((next: DraftState) => {
    persistDraft(next).catch(() => {});
  }, 1500);

  React.useEffect(() => {
    if (!isDirty) {
      return;
    }
    if (!draft.slug.trim() || !draft.title.trim()) {
      return;
    }
    autosave(draft);
    return () => {
      autosave.cancel();
    };
  }, [draft, autosave, isDirty]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    let source: EventSource | null = null;
    let reconnectTimer: number | null = null;

    const scheduleActivityRefresh = () => {
      if (refreshTimerRef.current !== null) {
        return;
      }
      refreshTimerRef.current = window.setTimeout(() => {
        router.refresh();
        refreshTimerRef.current = null;
      }, 750);
    };

    const handleUpdate = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as ActivityStreamPayload;

        if (!payload || !payload.slug) return;

        const nextSearchTimestamp = payload.searchGeneratedAt ?? null;
        const shouldTriggerRefresh =
          typeof nextSearchTimestamp === "number"
            ? (() => {
                const lastTimestamp = activitySearchTimestampRef.current;
                if (typeof lastTimestamp === "number" && nextSearchTimestamp <= lastTimestamp) {
                  return false;
                }
                activitySearchTimestampRef.current = nextSearchTimestamp;
                return true;
              })()
            : true;

        if (payload.type === "article:deleted") {
          setRecentSaves((current) => current.filter((item) => item.slug !== payload.slug));
          setKnownSlugs((current) => current.filter((slug) => slug !== payload.slug));
          toast({
            id: `activity-${payload.slug}`,
            title: "Article removed",
            description: payload.meta?.title ?? payload.slug,
            variant: "destructive",
          });
          if (shouldTriggerRefresh) {
            scheduleActivityRefresh();
          }
          return;
        }

        if (payload.type !== "article:saved") {
          return;
        }

        const timestamp =
          payload.timestamp ??
          payload.meta?.updatedAt ??
          payload.meta?.createdAt ??
          new Date().toISOString();
        const title = payload.meta?.title ?? payload.slug;

        setRecentSaves((current) => {
          const existingIndex = current.findIndex((item) => item.slug === payload.slug);
          const flaggedNew = isRecentlyUpdatedTimestamp(timestamp, 3);
          const previousLocation = existingIndex >= 0 ? current[existingIndex].location : undefined;
          const nextRecord: SaveInfo = {
            slug: payload.slug,
            title,
            location: previousLocation,
            isNew: flaggedNew,
            timestamp,
            source: "remote",
          };

          const trimmed =
            existingIndex >= 0 ? current.filter((_, idx) => idx !== existingIndex) : current;

          return [nextRecord, ...trimmed].slice(0, 5);
        });
        setKnownSlugs((current) =>
          current.includes(payload.slug) ? current : [...current, payload.slug],
        );

        toast({
          id: `activity-${payload.slug}`,
          title: "Activity update",
          description: title,
          variant: "default",
          duration: 3500,
        });
        if (shouldTriggerRefresh) {
          scheduleActivityRefresh();
        }
      } catch (error) {
        console.error("[AdminEditor] Failed to parse activity event", error);
      }
    };

    const connect = () => {
      if (source) {
        source.close();
      }
      source = new EventSource("/api/events");
      source.addEventListener(ACTIVITY_EVENT_NAME, handleUpdate as EventListener);
      source.onerror = () => {
        toast({
          id: "activity-disconnected",
          title: "Activity stream disconnected",
          description: "Reconnecting…",
          variant: "default",
          duration: 4000,
        });
        source?.close();
        if (reconnectTimer) {
          window.clearTimeout(reconnectTimer);
        }
        reconnectTimer = window.setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      if (source) {
        source.close();
      }
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [router, toast]);

  React.useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  React.useEffect(() => {
    if (status.type !== "saved") return;
    const timeout = setTimeout(() => {
      if (!isDirty) {
        setStatus({
          type: "idle",
          message: "All changes synced.",
        });
      }
    }, 3500);
    return () => clearTimeout(timeout);
  }, [status, isDirty]);

  const handleFieldChange =
    (field: keyof DraftState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement;
      const nextValue =
        target.type === "checkbox" ? (target as HTMLInputElement).checked : target.value;

      updateDraft((prev) => {
        if (field === "slug" && typeof nextValue === "string") {
          return {
            ...prev,
            slug: sanitizeSlugInput(nextValue),
          };
        }

        if (field === "created" && typeof nextValue === "string") {
          return {
            ...prev,
            created: fromDateTimeLocal(nextValue),
          };
        }

        return {
          ...prev,
          [field]: nextValue,
        } as DraftState;
      });
    };

  const handleMarkdownChange = React.useCallback(
    (value: string) => {
      updateDraft((prev) => ({
        ...prev,
        markdown: value,
      }));
    },
    [updateDraft],
  );

  const handleReset = () => {
    const restored = { ...lastSavedRef.current };
    setDraft(restored);
    setIsDirty(false);
    setStatus({
      type: "idle",
      message: "Reverted to the last saved version.",
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    persistDraft(draft, { manual: true });
  };

  const statusLabel = isDirty ? "Unsaved changes" : (status.message ?? "Autosave ready.");

  const isSaving = status.type === "saving";
  const saveDisabled =
    isSaving || Boolean(slugError) || !draft.title.trim() || draft.markdown.trim().length === 0;

  return (
    <form className="grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)]" onSubmit={handleSubmit}>
      <section className="space-y-6 rounded-2xl border bg-card/70 p-6 shadow-sm">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {article ? "Edit article" : "New article"}
          </p>
          <h2 className="text-xl font-semibold">Metadata</h2>
          <p className="text-sm text-muted-foreground">
            Update the front matter fields—these power category filters, search, and change history.
          </p>
        </header>

        <div className="space-y-4">
          <Field
            label="Slug"
            required
            value={draft.slug}
            onChange={handleFieldChange("slug")}
            placeholder="guides/getting-started"
            helperText={
              slugError ??
              "Use folder/slug format so the Markdown file lands in the right directory."
            }
            aria-invalid={Boolean(slugError)}
            className={cn(
              slugError &&
                "border-destructive text-destructive placeholder:text-destructive focus-visible:ring-destructive focus-visible:ring-offset-destructive/20",
            )}
          />
          {slugError ? <p className="text-sm text-destructive">{slugError}</p> : null}
          <Field
            label="Title"
            required
            value={draft.title}
            onChange={handleFieldChange("title")}
            placeholder="Maps & Atlases Runbook"
          />
          <Field
            label="Summary"
            as="textarea"
            value={draft.summary}
            onChange={handleFieldChange("summary")}
            placeholder="One-paragraph overview of the article."
            rows={3}
          />
          <Field
            label="Category"
            value={draft.category}
            onChange={handleFieldChange("category")}
            placeholder="Guides"
          />
          <Field
            label="Subcategory"
            value={draft.subcategory}
            onChange={handleFieldChange("subcategory")}
            placeholder="Introduction"
          />
          <Field
            label="Tags"
            value={draft.tags}
            onChange={handleFieldChange("tags")}
            placeholder="setup, overview, markdown"
            helperText="Separate tags with commas."
          />
          <Field
            label="Created"
            type="datetime-local"
            value={toDateTimeLocal(draft.created)}
            onChange={handleFieldChange("created")}
            helperText="Stored as ISO-8601 in the Markdown front matter."
          />
          <CheckboxField
            label="Mark as draft (hidden from public listings)"
            checked={draft.draft}
            onChange={handleFieldChange("draft")}
          />
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" disabled={saveDisabled}>
              {isSaving ? "Saving…" : "Save Draft"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isSaving || (!isDirty && status.type !== "error")}
            >
              Reset
            </Button>
          </div>
          <p
            className={cn(
              "text-sm",
              status.type === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {statusLabel}
          </p>
          {recentSaves.length > 0 ? (
            <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-primary">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-primary/80">
                <span>Recently Saved</span>
                <span>{recentSaves.length}</span>
              </div>
              <ul className="space-y-2">
                {recentSaves.map((save) => (
                  <li
                    key={`${save.slug}-${save.timestamp}`}
                    className="rounded-lg border border-primary/20 bg-background/80 p-3 text-foreground shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">
                            {save.title ?? save.slug}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {save.slug}
                          </span>
                        </div>
                        {save.isNew ? (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
                            New
                          </span>
                        ) : null}
                        {save.source === "remote" ? (
                          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-accent-foreground">
                            Live
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(save.timestamp)}
                      </span>
                    </div>
                    {save.location ? (
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {formatFilePath(save.location)}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button asChild variant="secondary" size="sm" className="h-8 px-3 text-xs">
                        <Link href={`/docs/${save.slug}`}>View</Link>
                      </Button>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs text-primary underline-offset-4 hover:underline"
                      >
                        <a
                          href={`/api/articles/${save.slug}`}
                          download={`${save.slug.split("/").at(-1) ?? "article"}.md`}
                        >
                          Download
                        </a>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <header className="space-y-2">
            <h2 className="text-xl font-semibold">Content</h2>
            <p className="text-sm text-muted-foreground">
              Draft in the WYSIWYG editor or switch to preview to inspect the rendered Markdown.
            </p>
          </header>
          <div className="inline-flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={previewMode === "edit" ? "secondary" : "ghost"}
              onClick={() => setPreviewMode("edit")}
            >
              Editor
            </Button>
            <Button
              type="button"
              size="sm"
              variant={previewMode === "preview" ? "secondary" : "ghost"}
              onClick={() => setPreviewMode("preview")}
            >
              Preview
            </Button>
          </div>
        </div>

        {previewMode === "edit" ? (
          <MarkdownEditor value={draft.markdown} onChange={handleMarkdownChange} />
        ) : (
          <div className="rounded-2xl border border-border/60 bg-background/90 p-6">
            {previewLoading ? (
              <p className="text-sm text-muted-foreground">Rendering preview…</p>
            ) : previewHtml ? (
              <div
                className="prose max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing to preview yet—start writing Markdown above.
              </p>
            )}
          </div>
        )}
      </section>
    </form>
  );
}

type FieldProps = {
  label: string;
  helperText?: string;
  as?: "input" | "textarea";
} & Omit<React.ComponentPropsWithoutRef<"input">, "as"> &
  Omit<React.ComponentPropsWithoutRef<"textarea">, "as">;

function Field({ label, helperText, as = "input", className, ...props }: FieldProps) {
  const id = React.useId();
  const Comp = as;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Comp
        id={id}
        className={cn(
          "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
          as === "textarea" && "min-h-[120px] resize-y",
          className,
        )}
        {...props}
      />
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}

type CheckboxFieldProps = {
  label: string;
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  const id = React.useId();
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-2 rounded-md border border-transparent px-2 py-2 text-sm transition hover:border-border"
    >
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        checked={checked}
        onChange={onChange}
      />
      <span className="text-muted-foreground">{label}</span>
    </label>
  );
}

function createInitialDraft(article: AdminEditorShellProps["article"]): DraftState {
  return {
    slug: article?.slug ?? "",
    title: article?.title ?? "",
    summary: article?.summary ?? "",
    category: article?.category ?? "",
    subcategory: article?.subcategory ?? "",
    tags: article?.tags.join(", ") ?? "",
    created: article?.created ?? new Date().toISOString(),
    draft: article?.draft ?? false,
    markdown: article?.content ?? DEFAULT_MARKDOWN,
  };
}

function draftsEqual(a: DraftState, b: DraftState) {
  return (
    a.slug === b.slug &&
    a.title === b.title &&
    a.summary === b.summary &&
    a.category === b.category &&
    a.subcategory === b.subcategory &&
    a.tags === b.tags &&
    a.created === b.created &&
    a.draft === b.draft &&
    a.markdown === b.markdown
  );
}

function sanitizeSlugInput(value: string) {
  return value
    .trim()
    .replace(/^[\/\\]+/, "")
    .replace(/[\/\\]+$/, "")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-");
}

function splitTagsString(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function toDateTimeLocal(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value) {
    return new Date().toISOString();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function ensureIsoString(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function formatTime(value: Date) {
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatFilePath(location: string) {
  const normalized = location.replace(/\\/g, "/");
  const marker = "/content/";
  const idx = normalized.indexOf(marker);
  if (idx !== -1) {
    return normalized.slice(idx + 1);
  }
  return normalized;
}

const AUTO_TOAST_ID = "autosave-status";
const AUTO_TOAST_INTERVAL_MS = 5 * 60 * 1000;

function triggerToastFeedback({
  toast,
  payload,
  isManual,
  lastAutosaveToastRef,
}: {
  toast: (options: {
    id?: string;
    title?: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
  }) => string;
  payload: { title?: string; description?: string };
  isManual: boolean;
  lastAutosaveToastRef: React.MutableRefObject<number>;
}) {
  if (isManual) {
    toast({
      ...payload,
      variant: "success",
      duration: 4000,
    });
    return;
  }

  const now = Date.now();
  if (now - lastAutosaveToastRef.current > AUTO_TOAST_INTERVAL_MS) {
    toast({
      id: AUTO_TOAST_ID,
      ...payload,
      variant: "default",
      duration: 2500,
    });
    lastAutosaveToastRef.current = now;
  }
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isRecentlyUpdatedTimestamp(iso: string, thresholdDays: number) {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  const diff = Date.now() - time;
  const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
  return diff >= 0 && diff <= thresholdMs;
}
