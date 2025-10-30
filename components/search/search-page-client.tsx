"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  Search as SearchIcon,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Document as FlexSearchDocument } from "flexsearch";

import { Button } from "@/components/ui/button";
import type { TaxonomyCategory } from "@/lib/content/taxonomy";
import type { SearchDocument } from "@/lib/search/index";
import { cn } from "@/lib/utils";

type SearchIndexRecord = SearchDocument & {
  tagsText: string;
};

type SearchPageClientProps = {
  documents: SearchDocument[];
  taxonomy: TaxonomyCategory[];
};

export function SearchPageClient({
  documents,
  taxonomy,
}: SearchPageClientProps) {
  const router = useRouter();

  const [query, setQuery] = React.useState("");
  const [rawResults, setRawResults] = React.useState<SearchDocument[]>(documents);

  const [categoryFilter, setCategoryFilter] = React.useState<string | null>(null);
  const [subcategoryFilter, setSubcategoryFilter] = React.useState<string | null>(
    null
  );
  const [tagFilters, setTagFilters] = React.useState<string[]>([]);

  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [paletteQuery, setPaletteQuery] = React.useState("");

  const indexRef = React.useRef<FlexSearchDocument<SearchIndexRecord> | null>(
    null
  );
  const paletteInputRef = React.useRef<HTMLInputElement | null>(null);

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
    [taxonomy, categoryFilter]
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

  const clearFilters = React.useCallback(() => {
    setCategoryFilter(null);
    setSubcategoryFilter(null);
    setTagFilters([]);
  }, []);

  const filteredResults = React.useMemo(() => {
    const base = query.trim() ? rawResults : documents;
    const filtered = base.filter((document) =>
      matchesFilters(document, categoryFilter, subcategoryFilter, tagFilters)
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
          matchesFilters(document, categoryFilter, subcategoryFilter, tagFilters)
        )
        .slice(0, 10);
    }

    const matches = index.search(paletteQuery, {
      limit: 15,
      enrich: true,
      resolve: true,
    });

    return extractDocumentsFromMatches(matches)
      .filter((document) =>
        matchesFilters(document, categoryFilter, subcategoryFilter, tagFilters)
      )
      .slice(0, 15);
  }, [
    documents,
    paletteOpen,
    paletteQuery,
    categoryFilter,
    subcategoryFilter,
    tagFilters,
  ]);

  const summaryMessage = query
    ? filteredResults.length === 0
      ? `No matches for “${query}”. Try adjusting your keywords or filters.`
      : `${filteredResults.length} result${filteredResults.length === 1 ? "" : "s"} for “${query}”.`
    : categoryFilter || subcategoryFilter || tagFilters.length > 0
    ? `Showing ${filteredResults.length} article${filteredResults.length === 1 ? "" : "s"} with active filters.`
    : "Start typing or open the command palette (⌘K) to search the knowledge base.";

  const activeFilterLabels = React.useMemo(() => {
    const labels: Array<{ key: string; label: string; onClear: () => void }> =
      [];

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
          activeCategory.subcategories.find(
            (sub) => sub.slug === subcategoryFilter
          )?.name ?? "Subcategory",
        onClear: () => setSubcategoryFilter(null),
      });
    }

    if (tagFilters.length > 0) {
      for (const tag of tagFilters) {
        labels.push({
          key: `tag-${tag}`,
          label: `#${tagLookup.get(tag) ?? tag}`,
          onClear: () =>
            setTagFilters((current) => current.filter((item) => item !== tag)),
        });
      }
    }

    return labels;
  }, [
    categoryFilter,
    subcategoryFilter,
    tagFilters,
    taxonomy,
    activeCategory,
    tagLookup,
  ]);

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
              <FilterButton
                active={categoryFilter === null}
                onClick={() => clearFilters()}
              >
                All categories
              </FilterButton>
              {taxonomy.map((category) => (
                <FilterButton
                  key={category.slug}
                  active={categoryFilter === category.slug}
                  onClick={() => {
                    setCategoryFilter((prev) =>
                      prev === category.slug ? null : category.slug
                    );
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
                        prev === subcategory.slug ? null : subcategory.slug
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
                          : [...current, tag.slug]
                      )
                    }
                  >
                    #{tag.name}
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {tag.count}
                    </span>
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
            disabled={
              !categoryFilter &&
              !subcategoryFilter &&
              tagFilters.length === 0
            }
          >
            Clear filters
          </Button>
        </aside>

        <div className="order-1 flex flex-col gap-6 rounded-2xl border bg-card/80 p-8 shadow-sm lg:order-2">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => event.preventDefault()}
          >
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
                <kbd className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                  ⌘K
                </kbd>
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
                No articles match the current filters. Try broadening your
                selection.
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
        className="w-full max-w-2xl rounded-2xl border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center border-b px-5 py-4">
          <SearchIcon className="mr-3 h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Quick search…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[320px] overflow-y-auto px-1 py-2">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No matching documents. Keep typing or adjust your filters.
            </p>
          ) : (
            <ul className="space-y-1">
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(result)}
                    className="flex w-full flex-col items-start gap-1 rounded-lg px-4 py-3 text-left transition hover:bg-muted"
                  >
                    <span className="font-medium text-foreground">
                      {result.title}
                    </span>
                    <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      {result.category}
                      {result.subcategory ? ` / ${result.subcategory}` : ""}
                    </span>
                    <span className="line-clamp-2 text-sm text-muted-foreground">
                      {result.summary ?? result.excerpt}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

type FilterButtonProps = {
  active: boolean;
  onClick: () => void;
  trailingLabel?: string;
  children: React.ReactNode;
};

function FilterButton({
  active,
  onClick,
  trailingLabel,
  children,
}: FilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition hover:border-primary/60 hover:text-primary",
        active
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border text-foreground"
      )}
    >
      <span>{children}</span>
      {trailingLabel ? (
        <span className="ml-3 text-xs text-muted-foreground">
          {trailingLabel}
        </span>
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
          : "border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
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
      <h2 className="text-lg font-semibold group-hover:text-primary">
        {document.title}
      </h2>
      <p className="text-sm text-muted-foreground">
        {document.summary ?? document.excerpt}
      </p>
      {document.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {document.tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                "rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary"
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
  tagFilters: string[]
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
    const entries = Array.isArray(match) ? match : match.result ?? [];
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
