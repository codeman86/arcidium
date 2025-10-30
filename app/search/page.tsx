import { SearchPageClient } from "@/components/search/search-page-client";
import { buildSearchDataset } from "@/lib/search/index";

export const metadata = {
  title: "Search • Arcidium",
  description:
    "Search across every Markdown article in the Arcidium knowledge base.",
};

export default async function SearchPage() {
  const { documents, taxonomy } = await buildSearchDataset();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 sm:px-12 lg:px-16">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Search Arcidium
        </h1>
        <p className="text-muted-foreground">
          Client-side search powered by FlexSearch. Start typing to instantly
          surface relevant articles, categories, and tags.
        </p>
      </div>
      <SearchPageClient documents={documents} taxonomy={taxonomy} />
    </div>
  );
}
