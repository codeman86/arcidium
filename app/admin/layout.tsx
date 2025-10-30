import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const metadata: Metadata = {
  title: "Admin • Arcidium",
  description:
    "Manage Arcidium documentation, metadata, and knowledge base structure.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-12">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Arcidium
            </span>
            <h1 className="text-lg font-semibold">Editor Console</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">Home</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/docs">Knowledge Base</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-12 sm:px-12 lg:px-16">
        {children}
      </main>
    </div>
  );
}
