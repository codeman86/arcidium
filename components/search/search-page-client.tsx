"use client";

import * as React from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import {
  Command,
  Loader2,
  RefreshCcw,
  Search as SearchIcon,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Document as FlexSearchDocument } from "flexsearch";

import { Button } from "@/components/ui/button";
import { ACTIVITY_EVENT_NAME, type ActivityStreamPayload } from "@/lib/activity/stream";
import type { TaxonomyCategory } from "@/lib/content/taxonomy";
import type { SearchDocument } from "@/lib/search/index";
import { formatDistanceToNow } from "@/lib/date/format-distance";
import { cn } from "@/lib/utils";

type SearchDataset = {
  documents: SearchDocument[];
  taxonomy: TaxonomyCategory[];
};

export type SearchDatasetResponse = {
  data: SearchDataset;
  cached: boolean;
  generatedAt: number;
};

type SearchIndexRecord = SearchDocument & {
  tagsText: string;
};

type SearchPageClientProps = {
  initialData: SearchDatasetResponse;
};

const SEARCH_ENDPOINT = "/api/search/index";

async function fetchSearchDataset(url: string): Promise<SearchDatasetResponse> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch search dataset (status ${response.status})`);
  }

  return (await response.json()) as SearchDatasetResponse;
}

export function SearchPageClient({ initialData }: SearchPageClientProps) {
  const router = useRouter();

  // Senior Dev Note: seed SWR with the SSR payload so the page renders instantly while background revalidation quietly refreshes the shared dataset.
  const { data, error, isValidating, mutate } = useSWR<SearchDatasetResponse>(
    SEARCH_ENDPOINT,
    fetchSearchDataset,
    {
      fallbackData: initialData,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );

  const dataset = data?.data ?? initialData.data;
  const documents = dataset.documents;
  const taxonomy = dataset.taxonomy;
  const generatedAt = data?.generatedAt ?? initialData.generatedAt;
  const cachedResult = data?.cached ?? initialData.cached;

  const [query, setQuery] = React.useState("");
  const [rawResults, setRawResults] = React.useState<SearchDocument[]>(documents);
  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
  const [subcategoryFilter, setSubcategoryFilter] = React.useState<string | null>(null);
  const [tagFilters, setTagFilters] = React.useState<string[]>([]);

  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [paletteQuery, setPaletteQuery] = React.useState("");

  const indexRef = React.useRef<FlexSearchDocument<SearchIndexRecord> | null>(null);
  const paletteInputRef = React.useRef<HTMLInputElement | null>(null);
  const realtimeRefreshTimerRef = React.useRef<number | null>(null);
  const searchTimestampRef = React.useRef<number>(generatedAt);

  const [isRebuilding, setIsRebuilding] = React.useState(false);
  const [rebuildError, setRebuildError] = React.useState<string | null>(null);

  React.useEffect(() => {
    searchTimestampRef.current = generatedAt;
  }, [generatedAt]);

  React.useEffect(() => {
    const index = new FlexSearchDocument<SearchIndexRecord>({
      tokenize: "forward",
      document: {
        id: "id",
        index: ["title", "summary", "tagsText", "content"],
        store: [
          "id",
          "slug",
          "title",
          "summary",
          "category",
          "categorySlug",
          "subcategory",
          "subcategorySlug",
          "tags",
          "tagSlugs",
          "excerpt",
        ],
      },
    });

    documents.forEach((document) => {
      index.add({
        ...document,
        tagsText: document.tags.join(" "),
      });
    });

    indexRef.current = index;
    setRawResults(documents);

    return () => {
      indexRef.current = null;
    };
  }, [documents]);

  React.useEffect(() => {
    const index = indexRef.current;
    if (!index) return;

    if (!query.trim()) {
      setRawResults(documents);
      return;
    }

    const matches = index.search(query, {
      limit: 40,
      enrich: true,
      resolve: true,
    });

    setRawResults(extractDocumentsFromMatches(matches));
  }, [documents, query]);

  React.useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let cancelled = false;
    let source: EventSource | null = null;
    let reconnectTimer: number | null = null;

    const scheduleRealtimeRefresh = () => {
      if (realtimeRefreshTimerRef.current !== null || cancelled) {
        return;
      }
      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        realtimeRefreshTimerRef.current = null;
        if (cancelled) {
          return;
        }
        mutate(async () => fetchSearchDataset(`${SEARCH_ENDPOINT}?rebuild=true`), {
          populateCache: true,
          revalidate: false,
          throwOnError: false,
        }).catch((error) => {
          console.error("[SearchPage] Realtime search dataset refresh failed", error);
        });
      }, 750);
    };

    const handleUpdate = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as ActivityStreamPayload;
        if (!payload || !payload.slug) {
          return;
        }
        if (payload.type !== "article:saved" && payload.type !== "article:deleted") {
          return;
        }
        const nextGeneratedAt = payload.searchGeneratedAt ?? null;
        if (typeof nextGeneratedAt === "number" && nextGeneratedAt <= searchTimestampRef.current) {
          return;
        }
        if (typeof nextGeneratedAt === "number") {
          searchTimestampRef.current = nextGeneratedAt;
        }
        scheduleRealtimeRefresh();
      } catch (error) {
        console.error("[SearchPage] Failed to handle activity event", error);
      }
    };

    const connect = () => {
      if (source) {
        source.close();
      }
      source = new EventSource("/api/events");
      source.addEventListener(ACTIVITY_EVENT_NAME, handleUpdate as EventListener);
      source.onerror = () => {
        source?.close();
        if (reconnectTimer !== null) {
          window.clearTimeout(reconnectTimer);
        }
        reconnectTimer = window.setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (source) {
        source.close();
      }
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
    };
  }, [mutate]);

  React.useEffect(() => {
    if (!paletteOpen) return;
    setPaletteQuery("");

    const focusTimer = requestAnimationFrame(() => {
      paletteInputRef.current?.focus();
    });

    const escapeHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", escapeHandler);
    return () => {
      cancelAnimationFrame(focusTimer);
      window.removeEventListener("keydown", escapeHandler);
    };
  }, [paletteOpen]);

  const tagLookup = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const category of taxonomy) {
      for (const tag of category.tags) {
        if (!map.has(tag.slug)) {
          map.set(tag.slug, tag.name);
        }
      }
    }
    return map;
  }, [taxonomy]);

  const activeCategory = React.useMemo(
    () => taxonomy.find((category) => category.slug === categoryFilter) ?? null,
    [taxonomy, categoryFilter],
  );

  const availableSubcategories = activeCategory?.subcategories ?? [];

  const availableTags = React.useMemo(() => {
    if (activeCategory) {
      return activeCategory.tags;
    }

    const aggregated = new Map<string, { name: string; count: number }>();
    for (const category of taxonomy) {
      for (const tag of category.tags) {
        const existing = aggregated.get(tag.slug);
        aggregated.set(tag.slug, {
          name: tag.name,
          count: (existing?.count ?? 0) + tag.count,
        });
      }
    }

    return Array.from(aggregated.entries()).map(([slug, value]) => ({
      slug,
      name: value.name,
      count: value.count,
    }));
  }, [taxonomy, activeCategory]);

  const clearFilters = React.useCallback(() => {
    setCategoryFilter(null);
    setSubcategoryFilter(null);
    setTagFilters([]);
  }, []);

  const filteredResults = React.useMemo(() => {
    const base = query.trim() ? rawResults : documents;
    const filtered = base.filter((document) =>
      matchesFilters(document, categoryFilter, subcategoryFilter, tagFilters),
    );

    if (!query.trim()) {
      return filtered.slice(0, 40);
    }

    return filtered;
  }, [rawResults, documents, query, categoryFilter, subcategoryFilter, tagFilters]);

  const paletteResults = React.useMemo(() => {
    if (!paletteOpen) {
      return [];
    }

    const index = indexRef.current;
    if (!index) return [];

    if (!paletteQuery.trim()) {
      return documents
        .filter((document) =>
          matchesFilters(document, categoryFilter, subcategoryFilter, tagFilters),
        )
        .slice(0, 10);
    }

    const matches = index.search(paletteQuery, {
      limit: 15,
      enrich: true,
      resolve: true,
    });

    return extractDocumentsFromMatches(matches)
      .filter((document) => matchesFilters(document, categoryFilter, subcategoryFilter, tagFilters))
      .slice(0, 15);
  }, [documents, paletteOpen, paletteQuery, categoryFilter, subcategoryFilter, tagFilters]);

  const summaryMessage = query
    ? filteredResults.length === 0
      ? `No matches for “${query}”. Try adjusting your keywords or filters.`
      : `${filteredResults.length} result${filteredResults.length === 1 ? "" : "s"} for “${query}”.`
    : categoryFilter || subcategoryFilter || tagFilters.length > 0
      ? `Showing ${filteredResults.length} article${filteredResults.length === 1 ? "" : "s"} with active filters.`
      : "Start typing or open the command palette (⌘K) to search the knowledge base.";

  const activeFilterLabels = React.useMemo(() => {
    const labels: Array<{ key: string; label: string; onClear: () => void }> = [];

    if (categoryFilter) {
      labels.push({
        key: `category-${categoryFilter}`,
        label: taxonomy.find((cat) => cat.slug === categoryFilter)?.name ?? "Category",
        onClear: () => setCategoryFilter(null),
      });
    }

    if (subcategoryFilter && activeCategory) {
      labels.push({
        key: `subcategory-${subcategoryFilter}`,
        label:
          activeCategory.subcategories.find((sub) => sub.slug === subcategoryFilter)?.name ??
          "Subcategory",
        onClear: () => setSubcategoryFilter(null),
      });
    }

    if (tagFilters.length > 0) {
      for (const tag of tagFilters) {
        labels.push({
          key: `tag-${tag}`,
          label: `#${tagLookup.get(tag) ?? tag}`,
          onClear: () => setTagFilters((current) => current.filter((item) => item !== tag)),
        });
      }
    }

    return labels;
  }, [categoryFilter, subcategoryFilter, tagFilters, taxonomy, activeCategory, tagLookup]);

  const relativeGeneratedAt = React.useMemo(() => {
    const distance = formatDistanceToNow(generatedAt);
    return distance.startsWith("in ") ? "just now" : distance;
  }, [generatedAt]);

  const latestErrorMessage = React.useMemo(() => {
    if (!error) return null;
    return error instanceof Error
      ? error.message
      : "Something went wrong while refreshing the search index.";
  }, [error]);

  const handleRebuild = React.useCallback(async () => {
    setIsRebuilding(true);
    setRebuildError(null);

    try {
      await mutate(async () => fetchSearchDataset(`${SEARCH_ENDPOINT}?rebuild=true`), {
        populateCache: true,
        revalidate: false,
        throwOnError: true,
      });
    } catch (err) {
      // Senior Dev Note: bubble the precise failure so ops can distinguish auth, network, or schema issues without diving into logs.
      const message = err instanceof Error ? err.message : "Failed to rebuild the search index.";
      setRebuildError(message);
    } finally {
      setIsRebuilding(false);
    }
  }, [mutate]);

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="order-2 flex flex-col gap-6 rounded-2xl border bg-card/70 p-6 shadow-sm lg:order-1">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Categories
            </p>
            <div className="flex flex-col gap-2">
              <FilterButton active={categoryFilter === null} onClick={() => clearFilters()}>
                All categories
              </FilterButton>
              {taxonomy.map((category) => (
                <FilterButton
                  key={category.slug}
                  active={categoryFilter === category.slug}
                  onClick={() => {
                    setCategoryFilter((prev) => (prev === category.slug ? null : category.slug));
                    setSubcategoryFilter(null);
                    setTagFilters([]);
                  }}
                  trailingLabel={category.count.toString()}
                >
                  {category.name}
                </FilterButton>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Subcategories
            </p>
            {availableSubcategories.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Choose a category to filter by subcategory.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableSubcategories.map((subcategory) => (
                  <FilterChip
                    key={subcategory.slug}
                    active={subcategoryFilter === subcategory.slug}
                    onClick={() =>
                      setSubcategoryFilter((prev) =>
                        prev === subcategory.slug ? null : subcategory.slug,
                      )
                    }
                  >
                    {subcategory.name}
                  </FilterChip>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              Tags
            </p>
            {availableTags.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No tags available for the current selection.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <FilterChip
                    key={tag.slug}
                    active={tagFilters.includes(tag.slug)}
                    onClick={() =>
                      setTagFilters((current) =>
                        current.includes(tag.slug)
                          ? current.filter((item) => item !== tag.slug)
                          : [...current, tag.slug],
                      )
                    }
                  >
                    #{tag.name}
                    <span className="ml-1 text-[10px] text-muted-foreground">{tag.count}</span>
                  </FilterChip>
                ))}
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={clearFilters}
            disabled={!categoryFilter && !subcategoryFilter && tagFilters.length === 0}
          >
            Clear filters
          </Button>
        </aside>

        <div className="order-1 flex flex-col gap-6 rounded-2xl border bg-card/80 p-8 shadow-sm lg:order-2">
          <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label
                htmlFor="arcidium-search-input"
                className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground"
              >
                Knowledge Base Search
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPaletteOpen(true)}
                className="flex items-center gap-2"
              >
                <Command className="h-4 w-4" aria-hidden="true" />
                <span>Command Palette</span>
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px]">⌘K</kbd>
              </Button>
            </div>
            <div className="relative flex items-center">
              <SearchIcon className="absolute left-3 h-4 w-4 text-muted-foreground" />
              <input
                id="arcidium-search-input"
                type="search"
                value={query}
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title, summary, tags, or keywords…"
                className="w-full rounded-lg border border-input bg-background px-10 py-3 text-base text-foreground shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              {query ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1.5 h-8 px-2 text-xs"
                  onClick={() => setQuery("")}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </form>

          <div className="space-y-2 rounded-xl border border-dashed border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold uppercase tracking-[0.25em] text-foreground">
                  Index status
                </span>
                <span>
                  Updated {relativeGeneratedAt}
                  {cachedResult ? " (cached)" : " (fresh)"}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRebuild}
                disabled={isRebuilding}
                className="flex items-center gap-2"
              >
                {isRebuilding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{isRebuilding ? "Rebuilding…" : "Rebuild index"}</span>
              </Button>
            </div>
            {isValidating && !isRebuilding ? (
              <>
                {/* Senior Dev Note: keep background refresh visible so support can spot stale caches without nagging the editor. */}
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  Refreshing latest dataset…
                </p>
              </>
            ) : null}
            {rebuildError ? <p className="text-destructive">{rebuildError}</p> : null}
            {!rebuildError && latestErrorMessage ? (
              <p className="text-destructive">{latestErrorMessage}</p>
            ) : null}
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{summaryMessage}</p>
            {activeFilterLabels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeFilterLabels.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={filter.onClear}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs transition hover:border-primary/60 hover:text-primary"
                  >
                    {filter.label}
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4">
            {filteredResults.map((result) => (
              <SearchResultCard key={result.id} document={result} />
            ))}
            {filteredResults.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-primary/30 bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                No articles match the current filters. Try broadening your selection.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        query={paletteQuery}
        onQueryChange={setPaletteQuery}
        results={paletteResults}
        inputRef={paletteInputRef}
        onSelect={(document) => {
          setPaletteOpen(false);
          router.push(`/docs/${document.slug}`);
        }}
      />
    </>
  );
}

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  results: SearchDocument[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSelect: (document: SearchDocument) => void;
};

function CommandPalette({
  open,
  onClose,
  query,
  onQueryChange,
  results,
  inputRef,
  onSelect,
}: CommandPaletteProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-background/80 p-4 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="max-h-[70vh] w-full max-w-2xl overflow-hidden rounded-2xl border bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-4 py-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Jump to article…"
            className="w-full bg-transparent text-sm outline-none"
          />
          <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px]">esc</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No results. Try a different keyword.
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {results.map((document) => (
                <li key={document.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(document)}
                    className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition hover:bg-muted/60"
                  >
                    <span className="text-sm font-medium text-foreground">{document.title}</span>
                    <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      {document.category}
                      {document.subcategory ? ` • ${document.subcategory}` : ""}
                    </span>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {document.summary ?? document.excerpt}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border/60 bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
          Navigate with ↑ ↓ · Press enter to open · esc to close
        </div>
      </div>
    </div>
  );
}

type FilterButtonProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  trailingLabel?: string;
};

function FilterButton({ active, onClick, children, trailingLabel }: FilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition",
        active
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/60 hover:text-primary",
      )}
    >
      <span>{children}</span>
      {trailingLabel ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{trailingLabel}</span>
      ) : null}
    </button>
  );
}

type FilterChipProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition",
        active
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/60 hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}

type SearchResultCardProps = {
  document: SearchDocument;
};

function SearchResultCard({ document }: SearchResultCardProps) {
  return (
    <a
      href={`/docs/${document.slug}`}
      className="group flex flex-col gap-3 rounded-2xl border bg-card/70 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
        <span>{document.category}</span>
        {document.subcategory ? <span>{document.subcategory}</span> : null}
      </div>
      <h2 className="text-lg font-semibold group-hover:text-primary">{document.title}</h2>
      <p className="text-sm text-muted-foreground">{document.summary ?? document.excerpt}</p>
      {document.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {document.tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary",
              )}
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </a>
  );
}

function matchesFilters(
  document: SearchDocument,
  categoryFilter: string | null,
  subcategoryFilter: string | null,
  tagFilters: string[],
) {
  if (categoryFilter && document.categorySlug !== categoryFilter) {
    return false;
  }

  if (subcategoryFilter) {
    if (!document.subcategorySlug) return false;
    if (document.subcategorySlug !== subcategoryFilter) return false;
  }

  if (tagFilters.length > 0) {
    const docTagSlugs = new Set(document.tagSlugs);
    for (const tag of tagFilters) {
      if (!docTagSlugs.has(tag)) {
        return false;
      }
    }
  }

  return true;
}

type FlexSearchMatch =
  | {
      result?: Array<{
        id?: unknown;
        doc?: SearchIndexRecord | null;
      }>;
    }
  | Array<{
      id?: unknown;
      doc?: SearchIndexRecord | null;
    }>;

function extractDocumentsFromMatches(matches: FlexSearchMatch[]): SearchDocument[] {
  const seen = new Map<string, SearchDocument>();

  for (const match of matches) {
    const entries = Array.isArray(match) ? match : (match.result ?? []);
    for (const entry of entries) {
      const doc = entry?.doc as SearchIndexRecord | null;
      if (!doc) continue;
      const docId = String(entry?.id ?? doc.id);
      if (seen.has(docId)) continue;
      seen.set(docId, {
        id: doc.id,
        slug: doc.slug,
        title: doc.title,
        summary: doc.summary,
        category: doc.category,
        categorySlug: doc.categorySlug,
        subcategory: doc.subcategory,
        subcategorySlug: doc.subcategorySlug,
        tags: doc.tags,
        tagSlugs: doc.tagSlugs,
        excerpt: doc.excerpt,
        content: doc.content,
      });
    }
  }

  return Array.from(seen.values());
}
