import { NextRequest, NextResponse } from "next/server";

import { getSearchDataset } from "@/lib/search/cache";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const rebuild = request.nextUrl.searchParams.get("rebuild") === "true";
  const { payload, generatedAt, cached } = await getSearchDataset({
    force: rebuild,
  });

  return NextResponse.json(
    {
      data: payload,
      cached: rebuild ? false : cached,
      generatedAt,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=60",
      },
    },
  );
}
