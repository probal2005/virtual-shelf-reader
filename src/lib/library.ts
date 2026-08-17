import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Book = Tables<"books">;
export type Category = Tables<"categories">;
export type ReadingProgress = Tables<"reading_progress">;
export type Bookmark = Tables<"bookmarks">;

export type BookWithExtras = Book & {
  categories: Pick<Category, "id" | "name" | "slug"> | null;
  reading_progress: ReadingProgress[];
};

export const SPINE_COLORS = [
  "walnut",
  "forest",
  "burgundy",
  "navy",
  "cream",
  "ink",
] as const;

export type SpineColor = (typeof SPINE_COLORS)[number];

export const spineClass: Record<string, string> = {
  walnut: "bg-spine-walnut text-paper",
  forest: "bg-spine-forest text-paper",
  burgundy: "bg-spine-burgundy text-paper",
  navy: "bg-spine-navy text-paper",
  cream: "bg-spine-cream text-paper-foreground",
  ink: "bg-spine-ink text-paper",
};

export function pickSpineColor(seed: string): SpineColor {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return SPINE_COLORS[hash % SPINE_COLORS.length] as SpineColor;
}

export const booksQuery = () => ({
  queryKey: ["books"],
  queryFn: async (): Promise<BookWithExtras[]> => {
    const { data, error } = await supabase
      .from("books")
      .select("*, categories(id, name, slug), reading_progress(*)")
      .order("shelf_index", { ascending: true })
      .order("position", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as BookWithExtras[];
  },
});

export const bookQuery = (bookId: string) => ({
  queryKey: ["book", bookId],
  queryFn: async (): Promise<BookWithExtras | null> => {
    const { data, error } = await supabase
      .from("books")
      .select("*, categories(id, name, slug), reading_progress(*)")
      .eq("id", bookId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as BookWithExtras | null;
  },
});

export const categoriesQuery = () => ({
  queryKey: ["categories"],
  queryFn: async (): Promise<Category[]> => {
    const { data, error } = await supabase.from("categories").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  },
});

export async function signedUrl(key: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from("library")
    .createSignedUrl(key, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function saveProgress(
  userId: string,
  bookId: string,
  currentPage: number,
  totalPages: number,
) {
  const percentage = totalPages > 0 ? Math.min(100, (currentPage / totalPages) * 100) : 0;
  await supabase.from("reading_progress").upsert(
    {
      user_id: userId,
      book_id: bookId,
      current_page: currentPage,
      total_pages: totalPages,
      percentage: Number(percentage.toFixed(2)),
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,book_id" },
  );
}

export function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}
