import { NextRequest, NextResponse } from "next/server";

import { buildSearchDataset } from "@/lib/search/index";

export const runtime = "nodejs";

let cache:
  | {
      key: string;
      payload: Awaited<ReturnType<typeof buildSearchDataset>>;
      generatedAt: number;
    }
  | null = null;

const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

export async function GET(request: NextRequest) {
  const rebuild = request.nextUrl.searchParams.get("rebuild") === "true";
  const now = Date.now();

  if (
    !rebuild &&
    cache &&
    now - cache.generatedAt < CACHE_TTL_MS &&
    cache.payload
  ) {
    return NextResponse.json(
      {
        data: cache.payload,
        cached: true,
        generatedAt: cache.generatedAt,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=60",
        },
      }
    );
  }

  const payload = await buildSearchDataset();
  cache = {
    key: "search-dataset",
    payload,
    generatedAt: now,
  };

  return NextResponse.json(
    {
      data: payload,
      cached: false,
      generatedAt: now,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=60",
      },
    }
  );
}
