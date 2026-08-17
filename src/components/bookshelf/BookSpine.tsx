import { Link } from "@tanstack/react-router";
import { pickSpineColor, spineClass, type BookWithExtras } from "@/lib/library";
import { cn } from "@/lib/utils";

function spineWidth(pageCount: number | null) {
  const pages = pageCount ?? 200;
  return Math.min(72, Math.max(34, Math.round(30 + pages / 14)));
}

function spineHeight(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 17 + seed.charCodeAt(i)) >>> 0;
  return 210 + (hash % 5) * 12;
}

export function BookSpine({ book }: { book: BookWithExtras }) {
  const color = book.spine_color && book.spine_color !== "walnut"
    ? book.spine_color
    : pickSpineColor(book.id);
  const progress = book.reading_progress?.[0]?.percentage ?? 0;

  return (
    <Link
      to="/books/$bookId"
      params={{ bookId: book.id }}
      aria-label={`Open ${book.title}`}
      className="group relative block shrink-0 origin-bottom transition-transform duration-300 ease-out hover:-translate-y-5 hover:scale-105 focus-visible:-translate-y-5 focus-visible:outline-none"
      style={{ width: spineWidth(book.page_count), height: spineHeight(book.id) }}
    >
      <div
        className={cn(
          "spine-emboss flex h-full w-full flex-col items-center justify-between rounded-[3px] px-1.5 py-3 transition-shadow duration-300 group-hover:shadow-glow",
          spineClass[color] ?? spineClass["walnut"],
        )}
      >
        <span className="h-[2px] w-2/3 rounded bg-brass/70" />
        <span
          className="font-display max-h-[75%] overflow-hidden text-[13px] font-semibold leading-tight tracking-wide"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
        >
          {book.title}
        </span>
        <span className="h-[2px] w-2/3 rounded bg-brass/70" />
      </div>

      {progress > 0 && (
        <span
          className="absolute inset-x-1 bottom-1 h-[3px] rounded-full bg-brass/80"
          style={{ width: `${Math.max(6, progress)}%` }}
        />
      )}

      <span className="pointer-events-none absolute -top-9 left-1/2 z-10 w-max max-w-[220px] -translate-x-1/2 truncate rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-book transition-opacity group-hover:opacity-100">
        {book.title}
        {book.author ? ` · ${book.author}` : ""}
      </span>
    </Link>
  );
}
