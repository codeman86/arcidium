import Link from "next/link";
import {
  FileText,
  LayoutDashboard,
  Search,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const features = [
  {
    name: "Markdown-native content",
    description:
      "Write knowledge base articles in pure Markdown with rich front matter metadata.",
    icon: FileText,
  },
  {
    name: "Organized collections",
    description:
      "Categorize entries with flexible taxonomies across teams, homelabs, and projects.",
    icon: LayoutDashboard,
  },
  {
    name: "Lightning-fast search",
    description:
      "Surface answers instantly with full-text search, filters, and tag-driven discovery.",
    icon: Search,
  },
  {
    name: "Secure by default",
    description:
      "Self-host Arcidium, integrate with your identity provider, and own your data.",
    icon: ShieldCheck,
  },
  {
    name: "File-level portability",
    description:
      "Every article lives as a simple .md file, ready for Git versioning and automation.",
    icon: UploadCloud,
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-background/60">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-6 pb-24 pt-24 sm:px-12 lg:px-16">
        <section className="grid gap-12 rounded-3xl border bg-card/60 p-10 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-6">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              Arcidium
            </span>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              A knowledge base that treats Markdown as a first-class citizen.
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Draft, organize, and ship documentation that your team can trust.
              Arcidium keeps every article as a portable Markdown file while
              layering in search, taxonomies, and a polished editing experience.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg">
              <Link href="/docs/guides/getting-started">Start Building</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/docs">Browse Knowledge Base</Link>
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <Link href="/search">Search the Library</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-8">
          <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Why Arcidium?
          </h2>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.name}
                className="group flex flex-col gap-4 rounded-2xl border bg-card/80 p-6 shadow-sm transition hover:-translate-y-1 hover:border-primary/60 hover:shadow-lg"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <feature.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{feature.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
