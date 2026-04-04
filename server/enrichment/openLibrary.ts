/**
 * Open Library API helper — free, no API key required
 * Docs: https://openlibrary.org/developers/api
 *
 * Provides:
 *  - searchBooks(query, limit?)       → book search with ISBN, cover_i, author_name
 *  - getBookByISBN(isbn)              → full book record by ISBN
 *  - searchAuthors(name, limit?)      → author search with work_count and OL key
 *  - getAuthorWorks(olAuthorKey, limit?) → list of works for a given author OL key
 *  - getCoverUrl(coverId, size?)      → construct cover image URL (S, M, L)
 */

const BASE = "https://openlibrary.org";
const TIMEOUT_MS = 12_000;

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OLBookDoc {
  key: string;
  title: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  first_publish_year?: number;
  subject?: string[];
  publisher?: string[];
  language?: string[];
  number_of_pages_median?: number;
}

export interface OLBookSearchResult {
  numFound: number;
  docs: OLBookDoc[];
}

export interface OLAuthorDoc {
  key: string;
  name: string;
  work_count: number;
  birth_date?: string;
  death_date?: string;
  top_subjects?: string[];
  top_work?: string;
}

export interface OLAuthorSearchResult {
  numFound: number;
  docs: OLAuthorDoc[];
}

export interface OLWork {
  key: string;
  title: string;
  covers?: number[];
  subjects?: string[];
  first_publish_date?: string;
}

export interface OLEdition {
  title: string;
  isbn_13?: string[];
  isbn_10?: string[];
  covers?: number[];
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  languages?: { key: string }[];
  subjects?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a cover image URL from Open Library cover_i integer.
 * Size: "S" (small ~50px), "M" (medium ~180px), "L" (large ~400px)
 */
export function getCoverUrl(coverId: number, size: "S" | "M" | "L" = "M"): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

/**
 * Search books by query string. Returns up to `limit` results.
 * Fields: key, title, author_name, isbn, cover_i, first_publish_year
 */
export async function searchBooks(
  query: string,
  limit = 10
): Promise<OLBookDoc[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    fields: "key,title,author_name,isbn,cover_i,first_publish_year,subject,publisher,number_of_pages_median",
  });
  const data = await fetchJSON<OLBookSearchResult>(
    `${BASE}/search.json?${params}`
  );
  return data?.docs ?? [];
}

/**
 * Look up a book by ISBN (10 or 13 digit). Returns the edition record or null.
 */
export async function getBookByISBN(isbn: string): Promise<OLEdition | null> {
  const clean = isbn.replace(/[-\s]/g, "");
  const data = await fetchJSON<Record<string, { details: OLEdition }>>(
    `${BASE}/api/books?bibkeys=ISBN:${clean}&jscmd=details&format=json`
  );
  if (!data) return null;
  const entry = data[`ISBN:${clean}`];
  return entry?.details ?? null;
}

/**
 * Search authors by name. Returns up to `limit` results.
 */
export async function searchAuthors(
  name: string,
  limit = 5
): Promise<OLAuthorDoc[]> {
  const params = new URLSearchParams({ q: name, limit: String(limit) });
  const data = await fetchJSON<OLAuthorSearchResult>(
    `${BASE}/search/authors.json?${params}`
  );
  return data?.docs ?? [];
}

/**
 * Get works for an Open Library author key (e.g. "OL3272258A").
 * Returns up to `limit` works.
 */
export async function getAuthorWorks(
  olAuthorKey: string,
  limit = 20
): Promise<OLWork[]> {
  const key = olAuthorKey.startsWith("/authors/")
    ? olAuthorKey
    : `/authors/${olAuthorKey}`;
  const data = await fetchJSON<{ entries: OLWork[] }>(
    `${BASE}${key}/works.json?limit=${limit}`
  );
  return data?.entries ?? [];
}

/**
 * Convenience: find the best Open Library author key for a given name.
 * Returns the key with the most works (most likely the canonical author).
 */
export async function findAuthorKey(name: string): Promise<string | null> {
  const authors = await searchAuthors(name, 5);
  if (!authors.length) return null;
  // Pick the one with the most works
  const best = authors.reduce((a, b) => (a.work_count >= b.work_count ? a : b));
  return best.key;
}

/**
 * Enrich a book record with Open Library data by ISBN or title+author.
 * Returns cover URL (M size), ISBN-13, publisher, page count, and OL key.
 */
export async function enrichBookFromOpenLibrary(opts: {
  isbn?: string;
  title?: string;
  authorName?: string;
}): Promise<{
  olKey?: string;
  isbn13?: string;
  coverUrl?: string;
  publisher?: string;
  pageCount?: number;
  publishYear?: number;
} | null> {
  // Try ISBN lookup first (most precise)
  if (opts.isbn) {
    const edition = await getBookByISBN(opts.isbn);
    if (edition) {
      const isbn13 = edition.isbn_13?.[0] ?? edition.isbn_10?.[0];
      const coverUrl = edition.covers?.[0]
        ? getCoverUrl(edition.covers[0], "M")
        : undefined;
      return {
        isbn13,
        coverUrl,
        publisher: edition.publishers?.[0],
        pageCount: edition.number_of_pages,
      };
    }
  }

  // Fall back to search by title + author
  const query = [opts.title, opts.authorName].filter(Boolean).join(" ");
  if (!query) return null;
  const docs = await searchBooks(query, 3);
  const doc = docs[0];
  if (!doc) return null;

  return {
    olKey: doc.key,
    isbn13: doc.isbn?.[0],
    coverUrl: doc.cover_i ? getCoverUrl(doc.cover_i, "M") : undefined,
    publishYear: doc.first_publish_year,
  };
}
