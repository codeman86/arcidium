import { NextRequest, NextResponse } from "next/server";

import { getArticleBySlug } from "@/lib/content/articles";

type RouteParams = {
  slug: string[];
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  const { slug: slugSegments } = await context.params;
  const slug = slugSegments.join("/");
  const article = await getArticleBySlug(slug);

  if (!article) {
    return NextResponse.json(
      { error: "Article not found" },
      {
        status: 404,
      }
    );
  }

  const filename = `${article.slugSegments.at(-1) ?? "article"}.md`;

  return new NextResponse(article.content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
