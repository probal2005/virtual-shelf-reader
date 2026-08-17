import type { BookWithExtras } from "@/lib/library";
import { BookSpine } from "./BookSpine";

const PER_SHELF = 9;

export function Bookshelf({ books }: { books: BookWithExtras[] }) {
  const shelves: BookWithExtras[][] = [];
  for (let i = 0; i < books.length; i += PER_SHELF) {
    shelves.push(books.slice(i, i + PER_SHELF));
  }
  if (shelves.length === 0) shelves.push([]);

  return (
    <div className="space-y-10">
      {shelves.map((shelf, index) => (
        <section key={index} className="relative">
          <div className="shelf-light flex min-h-[240px] items-end gap-2 overflow-x-auto rounded-t-md px-4 pb-1 sm:gap-3 sm:px-8">
            {shelf.map((book) => (
              <BookSpine key={book.id} book={book} />
            ))}
            {shelf.length === 0 && (
              <p className="pb-10 text-sm text-muted-foreground">
                This shelf is empty — add your first PDF.
              </p>
            )}
          </div>
          <div className="shelf-board h-4 w-full rounded-sm" />
        </section>
      ))}
    </div>
  );
}
