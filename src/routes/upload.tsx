import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, formatBytes, pickSpineColor } from "@/lib/library";

const MAX_SIZE = 100 * 1024 * 1024;

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Add a book — Virtual Personal Library" },
      {
        name: "description",
        content: "Upload a PDF, set its title, author and category, and place it on your shelf.",
      },
      { property: "og:title", content: "Add a book — Virtual Personal Library" },
      {
        property: "og:description",
        content: "Upload a PDF and place it on your virtual bookshelf.",
      },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [pageCount, setPageCount] = useState(0);
  const [step, setStep] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  const { data: categories } = useQuery(categoriesQuery());

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  async function acceptFile(next: File) {
    if (next.type !== "application/pdf" && !next.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are supported");
      return;
    }
    if (next.size > MAX_SIZE) {
      toast.error(`File is too large (max ${formatBytes(MAX_SIZE)})`);
      return;
    }
    setFile(next);
    if (!title) setTitle(next.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "));

    try {
      const { loadPdf } = await import("@/lib/pdf-client");
      const url = URL.createObjectURL(next);
      const doc = await loadPdf(url);
      setPageCount(doc.numPages);
      const meta = await doc.getMetadata();
      const info = meta.info as { Title?: string; Author?: string } | undefined;
      if (info?.Title) setTitle(info.Title);
      if (info?.Author) setAuthor(info.Author);
      URL.revokeObjectURL(url);
    } catch {
      /* metadata is best-effort */
    }
  }

  async function renderCover(source: File): Promise<Blob | null> {
    try {
      const { loadPdf } = await import("@/lib/pdf-client");
      const url = URL.createObjectURL(source);
      const doc = await loadPdf(url);
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 900 / page.getViewport({ scale: 1 }).height });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) return null;
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      URL.revokeObjectURL(url);
      return await new Promise((resolve) =>
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8),
      );
    } catch {
      return null;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !user) return;

    const bookId = crypto.randomUUID();
    const pdfKey = `${user.id}/books/${bookId}/original.pdf`;
    const coverKey = `${user.id}/covers/${bookId}.jpg`;

    try {
      setStep("Uploading PDF…");
      setProgress(20);
      const upload = await supabase.storage
        .from("library")
        .upload(pdfKey, file, { contentType: "application/pdf", upsert: true });
      if (upload.error) throw upload.error;

      setStep("Generating cover…");
      setProgress(60);
      const cover = await renderCover(file);
      let storedCover: string | null = null;
      if (cover) {
        const coverUpload = await supabase.storage
          .from("library")
          .upload(coverKey, cover, { contentType: "image/jpeg", upsert: true });
        if (!coverUpload.error) storedCover = coverKey;
      }

      setStep("Saving to your shelf…");
      setProgress(85);
      const { error } = await supabase.from("books").insert({
        id: bookId,
        user_id: user.id,
        title: title.trim() || "Untitled",
        author: author.trim() || null,
        description: description.trim() || null,
        category_id: categoryId || null,
        pdf_key: pdfKey,
        cover_key: storedCover,
        file_size: file.size,
        page_count: pageCount,
        spine_color: pickSpineColor(bookId),
      });
      if (error) throw error;

      setProgress(100);
      await queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Book added to your shelf");
      navigate({ to: "/books/$bookId", params: { bookId } });
    } catch (error) {
      setStep(null);
      setProgress(0);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  }

  return (
    <main className="wood-panel min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Button asChild variant="ghost" size="sm" className="mb-6">
          <Link to="/">
            <ArrowLeft className="mr-1 h-4 w-4" /> Library
          </Link>
        </Button>

        <div className="rounded-xl border border-border bg-card/95 p-8 shadow-shelf">
          <h1 className="text-3xl font-semibold">Add a new book</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The PDF is stored privately; only you can open it.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) void acceptFile(dropped);
              }}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <FileUp className="mb-3 h-7 w-7 text-primary" />
              {file ? (
                <>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                    {pageCount ? ` · ${pageCount} pages` : ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Drop your PDF here</p>
                  <p className="text-xs text-muted-foreground">or click to choose a file</p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const chosen = e.target.files?.[0];
                  if (chosen) void acceptFile(chosen);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="author">Author</Label>
                <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categories ?? []).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {step && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">{step}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={!file || !!step}>
              {step && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add book
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
