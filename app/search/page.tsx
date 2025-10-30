import {
  SearchPageClient,
  type SearchDatasetResponse,
} from "@/components/search/search-page-client";
import { getSearchDataset } from "@/lib/search/cache";

export const metadata = {
  title: "Search • Arcidium",
  description: "Search across every Markdown article in the Arcidium knowledge base.",
};

export default async function SearchPage() {
  const { payload, generatedAt, cached } = await getSearchDataset();
  // Senior Dev Note: prime the client with a stamped dataset so SWR can diff timestamps and skip redundant rebuilds on first paint.
  const initialPayload: SearchDatasetResponse = {
    data: payload,
    cached,
    generatedAt,
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 sm:px-12 lg:px-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Search Arcidium</h1>
        <p className="text-muted-foreground">
          Client-side search powered by FlexSearch. Start typing to instantly surface relevant
          articles, categories, and tags.
        </p>
      </div>
      <SearchPageClient initialData={initialPayload} />
    </div>
  );
}
