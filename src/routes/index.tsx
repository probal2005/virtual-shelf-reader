import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, LogOut, Plus, Search } from "lucide-react";

import { Bookshelf } from "@/components/bookshelf/Bookshelf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { booksQuery } from "@/lib/library";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Library — Virtual Personal Library" },
      {
        name: "description",
        content:
          "Browse your personal wooden bookshelf: every uploaded PDF becomes a physical-style book you can open and flip through.",
      },
      { property: "og:title", content: "My Library — Virtual Personal Library" },
      {
        property: "og:description",
        content: "Browse your personal wooden bookshelf of PDF books.",
      },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const { data: books, isLoading } = useQuery({ ...booksQuery(), enabled: !!user });

  const filtered = useMemo(() => {
    const list = books ?? [];
    const q = term.trim().toLowerCase();
    if (!q) return list;
    return list.filter((b) =>
      [b.title, b.author, b.description, b.isbn, b.categories?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [books, term]);

  const stats = useMemo(() => {
    const list = books ?? [];
    const pages = list.reduce((sum, b) => sum + (b.reading_progress?.[0]?.current_page ?? 0), 0);
    const finished = list.filter((b) => (b.reading_progress?.[0]?.percentage ?? 0) >= 98).length;
    return { total: list.length, pages, finished };
  }, [books]);

  return (
    <main className="wood-panel min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-display text-lg font-semibold">My Library</span>
          <div className="relative ml-auto hidden w-64 sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search your library..."
              className="pl-9"
            />
          </div>
          <Button asChild size="sm">
            <Link to="/upload">
              <Plus className="mr-1 h-4 w-4" /> Add book
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <section className="mb-10 text-center">
          <h1 className="text-4xl font-semibold sm:text-5xl">Welcome back</h1>
          <p className="mt-2 text-muted-foreground">Your books. Your world.</p>
          <div className="mt-6 flex justify-center gap-8 text-sm">
            <Stat label="Books" value={stats.total} />
            <Stat label="Pages read" value={stats.pages} />
            <Stat label="Finished" value={stats.finished} />
          </div>
        </section>

        <div className="mb-6 sm:hidden">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search your library..."
          />
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : (
          <Bookshelf books={filtered} />
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-display text-2xl font-semibold text-primary">{value}</p>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}
