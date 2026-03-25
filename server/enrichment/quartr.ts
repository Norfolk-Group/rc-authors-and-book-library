/**
 * Quartr / SEC EDGAR Enrichment — Corporate Earnings & Filings
 *
 * Searches for author mentions in SEC EDGAR full-text search (free, public API)
 * and optionally Quartr API (enterprise, requires QUARTR_API_KEY).
 *
 * This module provides:
 * - SEC EDGAR EFTS (full-text search) for author mentions in 10-K, 10-Q, 8-K filings
 * - Quartr API integration (when key is available) for earnings call transcripts
 * - Combined "Enterprise Impact" score based on filing mentions
 */
import { AXIOS_TIMEOUT_MS } from "@shared/const";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FilingMention {
  source: "sec_edgar" | "quartr";
  filingType: string; // "10-K", "10-Q", "8-K", "earnings_call"
  companyName: string;
  ticker: string | null;
  filingDate: string;
  title: string;
  url: string;
  excerpt: string | null;
}

export interface EarningsCallMention {
  source: "quartr" | "sec_edgar";
  companyName: string;
  ticker: string | null;
  eventDate: string;
  eventType: string; // "earnings_call", "investor_day", "conference"
  title: string;
  url: string;
  mentionContext: string | null;
}

export interface CorporateAdvisoryRole {
  companyName: string;
  role: string; // "Board Member", "Advisor", "Consultant"
  startDate: string | null;
  endDate: string | null;
  source: string;
  url: string | null;
}

export interface EnterpriseImpactResult {
  filingMentions: FilingMention[];
  earningsCallMentions: EarningsCallMention[];
  advisoryRoles: CorporateAdvisoryRole[];
  totalMentions: number;
  uniqueCompanies: string[];
  impactScore: "high" | "medium" | "low" | "none";
  fetchedAt: string;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchJson(url: string, headers?: Record<string, string>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AXIOS_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "NCGLibrary/1.0 (mailto:admin@norfolkai.vip)",
        Accept: "application/json",
        ...headers,
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── SEC EDGAR Full-Text Search ────────────────────────────────────────────────

const EDGAR_EFTS_BASE = "https://efts.sec.gov/LATEST/search-index";
const EDGAR_SEARCH_BASE = "https://efts.sec.gov/LATEST/search-index";
const EDGAR_FILING_SEARCH = "https://efts.sec.gov/LATEST/search-index";

/**
 * Search SEC EDGAR full-text search for author name mentions in filings.
 * Uses the free EDGAR EFTS API (no key required, rate limit: 10 req/sec).
 */
export async function searchEdgarFilings(
  authorName: string,
  maxResults = 20,
): Promise<FilingMention[]> {
  try {
    // SEC EDGAR full-text search API
    const query = encodeURIComponent(`"${authorName}"`);
    const url = `https://efts.sec.gov/LATEST/search-index?q=${query}&dateRange=custom&startdt=2020-01-01&enddt=2026-12-31&forms=10-K,10-Q,8-K,DEF%2014A,S-1&from=0&size=${maxResults}`;

    const data = await fetchJson(url);

    if (!data?.hits?.hits?.length) return [];

    return data.hits.hits.map((hit: any) => {
      const source = hit._source || {};
      return {
        source: "sec_edgar" as const,
        filingType: source.form_type || source.file_type || "Unknown",
        companyName: source.entity_name || source.display_names?.[0] || "Unknown",
        ticker: source.tickers?.[0] || null,
        filingDate: source.file_date || source.period_of_report || "",
        title: source.display_names?.[0]
          ? `${source.display_names[0]} - ${source.form_type || "Filing"}`
          : `SEC Filing - ${source.form_type || "Unknown"}`,
        url: source.file_num
          ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&filenum=${source.file_num}&type=&dateb=&owner=include&count=40`
          : `https://www.sec.gov/cgi-bin/browse-edgar?company=&CIK=&type=${source.form_type || ""}&dateb=&owner=include&count=40&search_text=${query}&action=getcompany`,
        excerpt: hit.highlight?.content?.[0] || null,
      };
    });
  } catch (err: any) {
    // EDGAR EFTS may not be available — fall back to basic search
    return searchEdgarBasic(authorName, maxResults);
  }
}

/**
 * Fallback: Use SEC EDGAR company search API for basic filing lookups.
 */
async function searchEdgarBasic(
  authorName: string,
  maxResults = 10,
): Promise<FilingMention[]> {
  try {
    const query = encodeURIComponent(authorName);
    const url = `https://www.sec.gov/cgi-bin/browse-edgar?company=${query}&CIK=&type=DEF+14A&dateb=&owner=include&count=${maxResults}&search_text=&action=getcompany&output=atom`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AXIOS_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "NCGLibrary/1.0 (mailto:admin@norfolkai.vip)",
          Accept: "application/atom+xml",
        },
      });
      if (!res.ok) return [];
      const text = await res.text();

      // Parse Atom XML for filing entries
      const entries: FilingMention[] = [];
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match;
      while ((match = entryRegex.exec(text)) !== null && entries.length < maxResults) {
        const entry = match[1];
        const titleMatch = entry.match(/<title[^>]*>(.*?)<\/title>/);
        const linkMatch = entry.match(/<link[^>]*href="([^"]+)"/);
        const updatedMatch = entry.match(/<updated>(.*?)<\/updated>/);
        const summaryMatch = entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);

        if (titleMatch) {
          entries.push({
            source: "sec_edgar",
            filingType: "DEF 14A",
            companyName: titleMatch[1].replace(/ \(.*$/, ""),
            ticker: null,
            filingDate: updatedMatch?.[1]?.split("T")[0] || "",
            title: titleMatch[1],
            url: linkMatch?.[1] || "",
            excerpt: summaryMatch?.[1]?.replace(/<[^>]+>/g, "").slice(0, 200) || null,
          });
        }
      }
      return entries;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return [];
  }
}

// ── Quartr API (Enterprise) ───────────────────────────────────────────────────

/**
 * Search Quartr API for earnings call transcript mentions.
 * Requires QUARTR_API_KEY environment variable.
 */
export async function searchQuartrTranscripts(
  authorName: string,
  apiKey: string,
  maxResults = 10,
): Promise<EarningsCallMention[]> {
  try {
    const query = encodeURIComponent(authorName);
    const url = `https://api.quartr.com/public/v1/transcripts?search=${query}&limit=${maxResults}`;

    const data = await fetchJson(url, {
      Authorization: `Bearer ${apiKey}`,
    });

    if (!data?.data?.length) return [];

    return data.data.map((item: any) => ({
      source: "quartr" as const,
      companyName: item.company?.name || "Unknown",
      ticker: item.company?.ticker || null,
      eventDate: item.event?.date || item.createdAt || "",
      eventType: item.event?.type || "earnings_call",
      title: item.event?.title || `${item.company?.name} Earnings Call`,
      url: item.url || `https://quartr.com/companies/${item.company?.slug || ""}`,
      mentionContext: null,
    }));
  } catch {
    return [];
  }
}

// ── Combined Enrichment ───────────────────────────────────────────────────────

/**
 * Enrich an author with enterprise impact data from SEC EDGAR and optionally Quartr.
 */
export async function enrichEnterpriseImpact(
  authorName: string,
  bookTitles: string[] = [],
): Promise<EnterpriseImpactResult> {
  const quartrKey = process.env.QUARTR_API_KEY;

  // Run searches in parallel
  const [filingMentions, earningsCallMentions] = await Promise.all([
    searchEdgarFilings(authorName, 20),
    quartrKey
      ? searchQuartrTranscripts(authorName, quartrKey, 10)
      : Promise.resolve([] as EarningsCallMention[]),
  ]);

  // Deduplicate companies
  const companySet = new Set<string>();
  filingMentions.forEach((m) => companySet.add(m.companyName));
  earningsCallMentions.forEach((m) => companySet.add(m.companyName));
  const uniqueCompanies = Array.from(companySet).filter((c) => c !== "Unknown");

  const totalMentions = filingMentions.length + earningsCallMentions.length;

  // Calculate impact score
  let impactScore: "high" | "medium" | "low" | "none" = "none";
  if (totalMentions >= 10 || uniqueCompanies.length >= 5) impactScore = "high";
  else if (totalMentions >= 5 || uniqueCompanies.length >= 3) impactScore = "medium";
  else if (totalMentions >= 1) impactScore = "low";

  return {
    filingMentions,
    earningsCallMentions,
    advisoryRoles: [], // Populated by Apollo.io integration
    totalMentions,
    uniqueCompanies,
    impactScore,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Health check for Quartr / SEC EDGAR services.
 */
export async function checkQuartrHealth(): Promise<{
  secEdgar: { status: "ok" | "error"; latencyMs: number };
  quartr: { status: "ok" | "unconfigured" | "error"; latencyMs: number };
}> {
  const secStart = Date.now();
  let secStatus: "ok" | "error" = "error";
  try {
    const res = await fetch("https://efts.sec.gov/LATEST/search-index?q=test&size=1", {
      headers: { "User-Agent": "NCGLibrary/1.0 (mailto:admin@norfolkai.vip)" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) secStatus = "ok";
  } catch {}
  const secLatency = Date.now() - secStart;

  const quartrKey = process.env.QUARTR_API_KEY;
  const quartrStart = Date.now();
  let quartrStatus: "ok" | "unconfigured" | "error" = quartrKey ? "error" : "unconfigured";
  if (quartrKey) {
    try {
      const res = await fetch("https://api.quartr.com/public/v1/companies?limit=1", {
        headers: { Authorization: `Bearer ${quartrKey}` },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) quartrStatus = "ok";
    } catch {}
  }
  const quartrLatency = Date.now() - quartrStart;

  return {
    secEdgar: { status: secStatus, latencyMs: secLatency },
    quartr: { status: quartrStatus, latencyMs: quartrLatency },
  };
}
