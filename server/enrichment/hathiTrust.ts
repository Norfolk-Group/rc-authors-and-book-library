/**
 * HathiTrust Data API helper — free, no API key required
 * Docs: https://www.hathitrust.org/data
 *       https://catalog.hathitrust.org/api/volumes
 *
 * Provides:
 *  - getVolumesByISBN(isbn)           → HathiTrust records + items for a book by ISBN
 *  - getVolumesByOCLC(oclcId)         → lookup by OCLC number
 *  - getVolumesByLCCN(lccn)           → lookup by Library of Congress Control Number
 *  - checkDigitalAvailability(isbn)   → simplified: is a free digital copy available?
 *  - getReadUrl(htid)                 → construct HathiTrust reader URL for a volume
 */

const BASE = "https://catalog.hathitrust.org/api/volumes";
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

export type HathiRightsString =
  | "Full view"
  | "Limited (search only)"
  | "Search only"
  | string;

export interface HathiItem {
  htid: string;
  ingest: string;
  rightsCode: string;
  usRightsString: HathiRightsString;
  enumcron?: string;
  fromRecord?: string;
}

export interface HathiRecord {
  recordURL: string;
  titles: string[];
  isbns: string[];
  issns: string[];
  oclcs: string[];
  lccns: string[];
  publishDates: string[];
}

export interface HathiVolumeResponse {
  records: Record<string, HathiRecord>;
  items: HathiItem[];
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Look up HathiTrust volumes by ISBN (10 or 13 digit).
 */
export async function getVolumesByISBN(
  isbn: string
): Promise<HathiVolumeResponse | null> {
  const clean = isbn.replace(/[-\s]/g, "");
  return fetchJSON<HathiVolumeResponse>(
    `${BASE}/brief/isbn/${clean}.json`
  );
}

/**
 * Look up HathiTrust volumes by OCLC number.
 */
export async function getVolumesByOCLC(
  oclcId: string
): Promise<HathiVolumeResponse | null> {
  return fetchJSON<HathiVolumeResponse>(
    `${BASE}/brief/oclc/${oclcId}.json`
  );
}

/**
 * Look up HathiTrust volumes by Library of Congress Control Number.
 */
export async function getVolumesByLCCN(
  lccn: string
): Promise<HathiVolumeResponse | null> {
  return fetchJSON<HathiVolumeResponse>(
    `${BASE}/brief/lccn/${lccn}.json`
  );
}

/**
 * Check if a free full-text digital copy is available on HathiTrust for a given ISBN.
 * Returns the htid of the first full-view item, or null if none available.
 */
export async function checkDigitalAvailability(isbn: string): Promise<{
  available: boolean;
  htid?: string;
  readUrl?: string;
  rightsString?: string;
} | null> {
  const data = await getVolumesByISBN(isbn);
  if (!data) return null;

  const fullViewItem = data.items.find(
    (item) =>
      item.usRightsString === "Full view" ||
      item.rightsCode === "pd" ||
      item.rightsCode === "pdus"
  );

  if (fullViewItem) {
    return {
      available: true,
      htid: fullViewItem.htid,
      readUrl: getReadUrl(fullViewItem.htid),
      rightsString: fullViewItem.usRightsString,
    };
  }

  // Check for search-only (partial access)
  const searchOnlyItem = data.items.find(
    (item) =>
      item.usRightsString?.toLowerCase().includes("search") ||
      item.rightsCode === "ic"
  );

  return {
    available: false,
    htid: searchOnlyItem?.htid,
    rightsString: searchOnlyItem?.usRightsString ?? "Not available",
  };
}

/**
 * Construct the HathiTrust reader URL for a given htid.
 */
export function getReadUrl(htid: string): string {
  return `https://babel.hathitrust.org/cgi/pt?id=${encodeURIComponent(htid)}`;
}

/**
 * Convenience: get a summary of HathiTrust availability for a book.
 * Returns the total number of digitized copies and whether any are freely readable.
 */
export async function getAvailabilitySummary(isbn: string): Promise<{
  totalCopies: number;
  fullViewCopies: number;
  searchOnlyCopies: number;
  bestReadUrl?: string;
  recordUrl?: string;
} | null> {
  const data = await getVolumesByISBN(isbn);
  if (!data) return null;

  const fullView = data.items.filter(
    (i) => i.usRightsString === "Full view" || i.rightsCode === "pd" || i.rightsCode === "pdus"
  );
  const searchOnly = data.items.filter(
    (i) => i.usRightsString?.toLowerCase().includes("search") || i.rightsCode === "ic"
  );

  const firstRecord = Object.values(data.records)[0];

  return {
    totalCopies: data.items.length,
    fullViewCopies: fullView.length,
    searchOnlyCopies: searchOnly.length,
    bestReadUrl: fullView[0] ? getReadUrl(fullView[0].htid) : undefined,
    recordUrl: firstRecord?.recordURL,
  };
}
