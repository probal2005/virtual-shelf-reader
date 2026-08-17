// Browser-only PDF pipeline: PDF.js -> canvas -> data URL -> PageFlip.
// Must only be imported from client components (dynamic import / ClientOnly).
import type { PDFDocumentProxy } from "pdfjs-dist";

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import("pdfjs-dist");
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore -- vite url import of the worker bundle
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      lib.GlobalWorkerOptions.workerSrc = worker.default as string;
      return lib;
    })();
  }
  return pdfjsPromise;
}

export async function loadPdf(url: string): Promise<PDFDocumentProxy> {
  const lib = await getPdfjs();
  return lib.getDocument({ url }).promise;
}

export type PageCache = Map<number, string>;

/** Render a single page to a data URL, memoised in the given cache. */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  cache: PageCache,
  targetHeight = 1200,
): Promise<string | null> {
  if (pageNumber < 1 || pageNumber > doc.numPages) return null;
  const cached = cache.get(pageNumber);
  if (cached) return cached;

  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(3, Math.max(1, targetHeight / base.height));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext("2d");
  if (!context) return null;

  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  cache.set(pageNumber, dataUrl);
  page.cleanup();
  return dataUrl;
}

/** Pre-render the pages around the current one so flips never show a loader. */
export async function preloadAround(
  doc: PDFDocumentProxy,
  current: number,
  cache: PageCache,
  radius = 3,
) {
  for (let i = current - radius; i <= current + radius; i++) {
    if (i >= 1 && i <= doc.numPages && !cache.has(i)) {
      // sequential on purpose: keeps the main thread responsive
      await renderPage(doc, i, cache);
    }
  }
}
