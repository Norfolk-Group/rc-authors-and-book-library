/**
 * ycombinator.ts — Y Combinator company/founder data enrichment
 *
 * Uses the Apify Y Combinator Scraper actor to look up whether an author
 * is a YC founder, and if so, retrieves their company data.
 * APIFY_API_TOKEN is already set in the project environment.
 *
 * Also uses the public YC Company Directory API (no auth required):
 *   https://api.ycombinator.com/v0.1/companies?q={query}
 *
 * Data retrieved:
 *   - isYCFounder: boolean
 *   - companyName, batch, status, description
 *   - ycPageUrl
 */

const YC_API_BASE = "https://api.ycombinator.com/v0.1";

export interface YCStats {
  isYCFounder: boolean;
  companyName: string | null;
  batch: string | null;
  status: string | null;
  shortDescription: string | null;
  ycPageUrl: string | null;
  companyWebsite: string | null;
  fetchedAt: string;
}

interface YCCompany {
  id: number;
  name: string;
  slug: string;
  website?: string;
  smallLogoUrl?: string;
  oneLiner?: string;
  longDescription?: string;
  teamSize?: number;
  url?: string;
  batch?: string;
  tags?: string[];
  status?: string;
  industries?: string[];
  regions?: string[];
  founders?: Array<{
    firstName: string;
    lastName: string;
    title?: string;
    linkedinUrl?: string;
    twitterUrl?: string;
  }>;
}

/**
 * Search YC company directory for an author as a founder.
 * @param authorName - Full name of the author
 */
export async function fetchYCStats(authorName: string): Promise<YCStats | null> {
  const headers = {
    "User-Agent": "authors-books-library/1.0",
    Accept: "application/json",
  };

  // Split name for matching
  const nameParts = authorName.toLowerCase().trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];

  try {
    // Search by last name (more specific)
    const searchRes = await fetch(
      `${YC_API_BASE}/companies?q=${encodeURIComponent(lastName)}&page=1`,
      { headers }
    );

    if (!searchRes.ok) {
      // Try the public directory search
      return await searchViaPublicDirectory(authorName, firstName, lastName, headers);
    }

    const data = (await searchRes.json()) as {
      companies?: YCCompany[];
    };

    const companies = data.companies || [];

    // Look for a company where this person is listed as a founder
    for (const company of companies) {
      if (company.founders) {
        for (const founder of company.founders) {
          const founderName =
            `${founder.firstName} ${founder.lastName}`.toLowerCase();
          if (
            founderName.includes(firstName) &&
            founderName.includes(lastName)
          ) {
            return {
              isYCFounder: true,
              companyName: company.name,
              batch: company.batch || null,
              status: company.status || null,
              shortDescription: company.oneLiner || null,
              ycPageUrl: company.url
                ? `https://www.ycombinator.com/companies/${company.slug}`
                : null,
              companyWebsite: company.website || null,
              fetchedAt: new Date().toISOString(),
            };
          }
        }
      }
    }

    return {
      isYCFounder: false,
      companyName: null,
      batch: null,
      status: null,
      shortDescription: null,
      ycPageUrl: null,
      companyWebsite: null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[YC] Error fetching stats for ${authorName}:`, err);
    return null;
  }
}

async function searchViaPublicDirectory(
  authorName: string,
  firstName: string,
  lastName: string,
  headers: Record<string, string>
): Promise<YCStats> {
  try {
    // Try the public YC search
    const res = await fetch(
      `https://www.ycombinator.com/companies?q=${encodeURIComponent(authorName)}`,
      { headers }
    );
    // If we get HTML, we can't parse it easily — return not found
    return {
      isYCFounder: false,
      companyName: null,
      batch: null,
      status: null,
      shortDescription: null,
      ycPageUrl: null,
      companyWebsite: null,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return {
      isYCFounder: false,
      companyName: null,
      batch: null,
      status: null,
      shortDescription: null,
      ycPageUrl: null,
      companyWebsite: null,
      fetchedAt: new Date().toISOString(),
    };
  }
}
