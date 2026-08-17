import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { bookQuery, formatBytes, signedUrl } from "@/lib/library";

export const Route = createFileRoute("/books/$bookId")({
  head: () => ({
    meta: [
      { title: "Book details — Virtual Personal Library" },
      {
        name: "description",
        content: "See the cover, metadata and reading progress for a book on your shelf.",
      },
      { property: "og:title", content: "Book details — Virtual Personal Library" },
      {
        property: "og:description",
        content: "Cover, metadata and reading progress for a book on your shelf.",
      },
    ],
  }),
  component: BookDetailsPage,
});

function BookDetailsPage() {
  const { bookId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cover, setCover] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const { data: book, isLoading } = useQuery({ ...bookQuery(bookId), enabled: !!user });

  useEffect(() => {
    let active = true;
    if (book?.cover_key) {
      signedUrl(book.cover_key)
        .then((url) => active && setCover(url))
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [book?.cover_key]);

  async function remove() {
    if (!book) return;
    await supabase.storage.from("library").remove(
      [book.pdf_key, book.cover_key].filter(Boolean) as string[],
    );
    const { error } = await supabase.from("books").delete().eq("id", book.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["books"] });
    toast.success("Book removed");
    navigate({ to: "/" });
  }

  const progress = book?.reading_progress?.[0];
  const percentage = Number(progress?.percentage ?? 0);

  return (
    <main className="wood-panel min-h-screen px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/">
            <ArrowLeft className="mr-1 h-4 w-4" /> Library
          </Link>
        </Button>

        {isLoading || !book ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <div className="grid gap-8 rounded-xl border border-border bg-card/95 p-8 shadow-shelf sm:grid-cols-[240px_1fr]">
            <div className="paper-surface aspect-[3/4] overflow-hidden rounded-md shadow-book">
              {cover ? (
                <img
                  src={cover}
                  alt={`Cover of ${book.title}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-4 text-center font-display text-xl">
                  {book.title}
                </div>
              )}
            </div>

            <div>
              {book.categories && <Badge variant="secondary">{book.categories.name}</Badge>}
              <h1 className="mt-3 text-4xl font-semibold">{book.title}</h1>
              {book.author && <p className="text-muted-foreground">{book.author}</p>}
              {book.description && <p className="mt-4 text-sm">{book.description}</p>}

              <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <Meta label="Pages" value={String(book.page_count ?? 0)} />
                <Meta label="Size" value={formatBytes(book.file_size)} />
                <Meta label="Language" value={book.language ?? "—"} />
                <Meta
                  label="Added"
                  value={new Date(book.created_at).toLocaleDateString()}
                />
              </dl>

              <div className="mt-6">
                <Progress value={percentage} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {percentage.toFixed(1)}% · page {progress?.current_page ?? 0} of{" "}
                  {book.page_count ?? 0}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link
                    to="/reader/$bookId"
                    params={{ bookId: book.id }}
                    search={{ page: progress?.current_page ?? 1 }}
                  >
                    <BookOpen className="mr-1 h-4 w-4" />
                    {percentage > 0 ? "Continue reading" : "Open book"}
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/reader/$bookId" params={{ bookId: book.id }} search={{ page: 1 }}>
                    Start from beginning
                  </Link>
                </Button>
                <Button variant="ghost" onClick={remove}>
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
