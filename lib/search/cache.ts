import { buildSearchDataset } from "@/lib/search/index";

type SearchDataset = Awaited<ReturnType<typeof buildSearchDataset>>;

type CacheEntry = {
  payload: SearchDataset;
  generatedAt: number;
};

type GetSearchDatasetOptions = {
  force?: boolean;
};

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

let cache: CacheEntry | null = null;
let inflight: Promise<CacheEntry> | null = null;

export async function getSearchDataset(options: GetSearchDatasetOptions = {}) {
  const force = options.force ?? false;
  const now = Date.now();

  if (!force && cache && now - cache.generatedAt < CACHE_TTL_MS) {
    return {
      payload: cache.payload,
      generatedAt: cache.generatedAt,
      cached: true,
    };
  }

  if (!force && inflight) {
    const entry = await inflight;
    return {
      payload: entry.payload,
      generatedAt: entry.generatedAt,
      cached: true,
    };
  }

  const rebuildPromise = rebuildSearchDataset();

  if (!force) {
    inflight = rebuildPromise;
  }

  try {
    const entry = await rebuildPromise;
    return {
      payload: entry.payload,
      generatedAt: entry.generatedAt,
      cached: false,
    };
  } finally {
    if (!force) {
      inflight = null;
    }
  }
}

export async function rebuildSearchDataset(): Promise<CacheEntry> {
  const payload = await buildSearchDataset();
  const entry = {
    payload,
    generatedAt: Date.now(),
  };
  cache = entry;
  return entry;
}

export function invalidateSearchDatasetCache() {
  cache = null;
}
