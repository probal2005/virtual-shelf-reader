import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { ChevronLeft, ChevronRight, Bookmark as BookmarkIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { saveProgress } from "@/lib/library";
import type { PageCache } from "@/lib/pdf-client";
import type { PDFDocumentProxy } from "pdfjs-dist";

type Props = {
  bookId: string;
  userId: string;
  title: string;
  pdfUrl: string;
  startPage: number;
};

const Page = forwardRef<HTMLDivElement, { src?: string; number: number }>(
  ({ src, number }, ref) => (
    <div ref={ref} className="paper-surface h-full w-full overflow-hidden shadow-book">
      {src ? (
        <img
          src={src}
          alt={`Page ${number}`}
          className="h-full w-full object-contain"
          draggable={false}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-paper-foreground/50" />
        </div>
      )}
      <span className="sr-only">Page {number}</span>
    </div>
  ),
);
Page.displayName = "Page";

export function BookReader({ bookId, userId, title, pdfUrl, startPage }: Props) {
  const isMobile = useIsMobile();
  const flipRef = useRef<any>(null);
  const cacheRef = useRef<PageCache>(new Map());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pages, setPages] = useState<Record<number, string>>({});
  const [current, setCurrent] = useState(startPage);
  const [ready, setReady] = useState(false);

  const size = useMemo(() => {
    if (typeof window === "undefined") return { width: 420, height: 594 };
    const height = Math.min(760, window.innerHeight - 190);
    return { width: Math.round(height * 0.707), height };
  }, [isMobile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { loadPdf } = await import("@/lib/pdf-client");
      const loaded = await loadPdf(pdfUrl);
      if (cancelled) return;
      setDoc(loaded);
      setNumPages(loaded.numPages);
      setReady(true);
    })().catch(() => toast.error("Could not open this PDF"));
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  const ensurePages = useCallback(
    async (center: number) => {
      if (!doc) return;
      const { renderPage } = await import("@/lib/pdf-client");
      for (let i = center - 3; i <= center + 4; i++) {
        if (i < 1 || i > doc.numPages || cacheRef.current.has(i)) continue;
        const src = await renderPage(doc, i, cacheRef.current);
        if (src) setPages((prev) => ({ ...prev, [i]: src }));
      }
    },
    [doc],
  );

  useEffect(() => {
    void ensurePages(current);
  }, [ensurePages, current]);

  // Debounced progress saving — never on every animation frame.
  useEffect(() => {
    if (!numPages) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveProgress(userId, bookId, current, numPages);
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [current, numPages, bookId, userId]);

  const flipNext = useCallback(() => flipRef.current?.pageFlip()?.flipNext(), []);
  const flipPrev = useCallback(() => flipRef.current?.pageFlip()?.flipPrev(), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        flipNext();
      }
      if (e.key === "ArrowLeft") flipPrev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipNext, flipPrev]);

  useEffect(() => {
    if (ready && startPage > 1) {
      const timer = setTimeout(() => flipRef.current?.pageFlip()?.turnToPage(startPage - 1), 400);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [ready, startPage]);

  async function addBookmark() {
    const { error } = await supabase.from("bookmarks").insert({
      user_id: userId,
      book_id: bookId,
      page_number: current,
      title: `${title} — page ${current}`,
    });
    if (error) toast.error(error.message);
    else toast.success(`Bookmarked page ${current}`);
  }

  if (!ready) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="Previous page" onClick={flipPrev}>
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <HTMLFlipBook
          ref={flipRef}
          width={size.width}
          height={size.height}
          size="fixed"
          minWidth={280}
          maxWidth={900}
          minHeight={360}
          maxHeight={1200}
          drawShadow
          flippingTime={700}
          usePortrait={isMobile}
          showCover={false}
          maxShadowOpacity={0.5}
          mobileScrollSupport
          useMouseEvents
          swipeDistance={30}
          startPage={0}
          clickEventForward={false}
          disableFlipByClick={false}
          autoSize={false}
          showPageCorners
          style={{}}
          className="shadow-shelf"
          onFlip={(e: { data: number }) => setCurrent(e.data + 1)}
        >
          {Array.from({ length: numPages }, (_, index) => (
            <Page key={index} number={index + 1} src={pages[index + 1]} />
          ))}
        </HTMLFlipBook>

        <Button variant="ghost" size="icon" aria-label="Next page" onClick={flipNext}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex items-center gap-6 rounded-full border border-border bg-card/90 px-5 py-2 text-sm shadow-book">
        <Button variant="ghost" size="icon" aria-label="Bookmark page" onClick={addBookmark}>
          <BookmarkIcon className="h-4 w-4" />
        </Button>
        <span className="tabular-nums text-muted-foreground">
          {current} / {numPages}
        </span>
      </div>
    </div>
  );
}
