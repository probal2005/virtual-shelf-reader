import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { bookQuery, signedUrl } from "@/lib/library";

const BookReader = lazy(() =>
  import("@/components/reader/BookReader").then((m) => ({ default: m.BookReader })),
);

export const Route = createFileRoute("/reader/$bookId")({
  validateSearch: z.object({ page: z.number().optional() }),
  head: () => ({
    meta: [
      { title: "Reading — Virtual Personal Library" },
      {
        name: "description",
        content: "Read your PDF as a real book with realistic page-turning animation.",
      },
      { property: "og:title", content: "Reading — Virtual Personal Library" },
      {
        property: "og:description",
        content: "Read your PDF as a real book with realistic page-turning animation.",
      },
    ],
  }),
  component: ReaderPage,
});

function ReaderPage() {
  const { bookId } = Route.useParams();
  const { page } = Route.useSearch();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const { data: book } = useQuery({ ...bookQuery(bookId), enabled: !!user });

  useEffect(() => {
    let active = true;
    if (book?.pdf_key) {
      signedUrl(book.pdf_key, 60 * 60 * 4)
        .then((url) => active && setPdfUrl(url))
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [book?.pdf_key]);

  return (
    <main className="wood-panel flex min-h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur">
        <Button asChild variant="ghost" size="sm">
          <Link to="/books/$bookId" params={{ bookId }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Library
          </Link>
        </Button>
        <h1 className="truncate font-display text-lg font-semibold">{book?.title ?? "Reading"}</h1>
      </header>

      <div className="flex flex-1 items-center justify-center px-2 py-6">
        {mounted && user && pdfUrl && book ? (
          <Suspense
            fallback={<Loader2 className="h-6 w-6 animate-spin text-primary" />}
          >
            <BookReader
              bookId={book.id}
              userId={user.id}
              title={book.title}
              pdfUrl={pdfUrl}
              startPage={page ?? book.reading_progress?.[0]?.current_page ?? 1}
            />
          </Suspense>
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        )}
      </div>
    </main>
  );
}
