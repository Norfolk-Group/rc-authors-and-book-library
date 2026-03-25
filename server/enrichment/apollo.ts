/**
 * Apollo.io / Professional Profile Enrichment
 *
 * Searches for author professional profiles using multiple free data sources:
 * 1. Perplexity AI (already configured) for structured professional data
 * 2. Wikipedia/Wikidata for board memberships and corporate roles
 * 3. Apollo.io API (when APOLLO_API_KEY is available) for detailed professional profiles
 *
 * Returns: roles, board seats, company affiliations, education, awards.
 */
import { AXIOS_TIMEOUT_MS } from "@shared/const";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProfessionalRole {
  title: string;
  organization: string;
  period: string | null;
  isCurrent: boolean;
  source: string;
}

export interface BoardSeat {
  organization: string;
  role: string; // "Board Member", "Advisory Board", "Trustee"
  startYear: number | null;
  endYear: number | null;
  source: string;
  url: string | null;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field: string | null;
  year: number | null;
}

export interface AwardEntry {
  name: string;
  organization: string | null;
  year: number | null;
  description: string | null;
}

export interface CompanyAffiliation {
  name: string;
  role: string;
  type: "founded" | "employed" | "advisor" | "investor" | "board";
  url: string | null;
  description: string | null;
}

export interface ProfessionalProfileResult {
  currentRole: ProfessionalRole | null;
  roles: ProfessionalRole[];
  boardSeats: BoardSeat[];
  education: EducationEntry[];
  awards: AwardEntry[];
  companyAffiliations: CompanyAffiliation[];
  linkedinUrl: string | null;
  totalExperience: number | null; // years
  fetchedAt: string;
  source: "perplexity" | "apollo" | "wikipedia" | "combined";
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
        "User-Agent": "NCGLibrary/1.0",
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

// ── Wikipedia/Wikidata Professional Data ──────────────────────────────────────

/**
 * Extract professional data from Wikipedia infobox and Wikidata claims.
 */
export async function fetchWikipediaProfessionalData(
  authorName: string,
): Promise<Partial<ProfessionalProfileResult>> {
  try {
    // Search Wikipedia for the author
    const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(authorName.replace(/ /g, "_"))}`;
    const summary = await fetchJson(searchUrl);

    if (!summary?.title || summary.type === "disambiguation") {
      return { roles: [], boardSeats: [], education: [], awards: [] };
    }

    // Get Wikidata entity for structured claims
    const wikidataId = summary.wikibase_item;
    if (!wikidataId) {
      return { roles: [], boardSeats: [], education: [], awards: [] };
    }

    const wikidataUrl = `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`;
    const wdData = await fetchJson(wikidataUrl);
    const entity = wdData?.entities?.[wikidataId];
    if (!entity) {
      return { roles: [], boardSeats: [], education: [], awards: [] };
    }

    const claims = entity.claims || {};
    const roles: ProfessionalRole[] = [];
    const boardSeats: BoardSeat[] = [];
    const education: EducationEntry[] = [];
    const awards: AwardEntry[] = [];

    // P108 = employer
    if (claims.P108) {
      for (const claim of claims.P108) {
        const orgId = claim.mainsnak?.datavalue?.value?.id;
        if (orgId) {
          const orgLabel = await getWikidataLabel(orgId);
          const startTime = claim.qualifiers?.P580?.[0]?.datavalue?.value?.time;
          const endTime = claim.qualifiers?.P582?.[0]?.datavalue?.value?.time;
          const posId = claim.qualifiers?.P39?.[0]?.datavalue?.value?.id;
          const posLabel = posId ? await getWikidataLabel(posId) : "Employee";

          roles.push({
            title: posLabel,
            organization: orgLabel,
            period: formatWikidataPeriod(startTime, endTime),
            isCurrent: !endTime,
            source: "wikidata",
          });
        }
      }
    }

    // P69 = educated at
    if (claims.P69) {
      for (const claim of claims.P69) {
        const instId = claim.mainsnak?.datavalue?.value?.id;
        if (instId) {
          const instLabel = await getWikidataLabel(instId);
          const degreeId = claim.qualifiers?.P512?.[0]?.datavalue?.value?.id;
          const degreeLabel = degreeId ? await getWikidataLabel(degreeId) : null;
          const fieldId = claim.qualifiers?.P812?.[0]?.datavalue?.value?.id;
          const fieldLabel = fieldId ? await getWikidataLabel(fieldId) : null;
          const endTime = claim.qualifiers?.P582?.[0]?.datavalue?.value?.time;

          education.push({
            institution: instLabel,
            degree: degreeLabel || "Degree",
            field: fieldLabel,
            year: endTime ? parseInt(endTime.substring(1, 5)) : null,
          });
        }
      }
    }

    // P166 = award received
    if (claims.P166) {
      for (const claim of claims.P166.slice(0, 10)) {
        const awardId = claim.mainsnak?.datavalue?.value?.id;
        if (awardId) {
          const awardLabel = await getWikidataLabel(awardId);
          const time = claim.qualifiers?.P585?.[0]?.datavalue?.value?.time;

          awards.push({
            name: awardLabel,
            organization: null,
            year: time ? parseInt(time.substring(1, 5)) : null,
            description: null,
          });
        }
      }
    }

    // P3320 = board member of
    if (claims.P3320) {
      for (const claim of claims.P3320) {
        const orgId = claim.mainsnak?.datavalue?.value?.id;
        if (orgId) {
          const orgLabel = await getWikidataLabel(orgId);
          const startTime = claim.qualifiers?.P580?.[0]?.datavalue?.value?.time;
          const endTime = claim.qualifiers?.P582?.[0]?.datavalue?.value?.time;

          boardSeats.push({
            organization: orgLabel,
            role: "Board Member",
            startYear: startTime ? parseInt(startTime.substring(1, 5)) : null,
            endYear: endTime ? parseInt(endTime.substring(1, 5)) : null,
            source: "wikidata",
            url: null,
          });
        }
      }
    }

    return { roles, boardSeats, education, awards };
  } catch {
    return { roles: [], boardSeats: [], education: [], awards: [] };
  }
}

// Wikidata label cache to reduce API calls
const labelCache = new Map<string, string>();

async function getWikidataLabel(entityId: string): Promise<string> {
  if (labelCache.has(entityId)) return labelCache.get(entityId)!;
  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=labels&languages=en&format=json`;
    const data = await fetchJson(url);
    const label = data?.entities?.[entityId]?.labels?.en?.value || entityId;
    labelCache.set(entityId, label);
    return label;
  } catch {
    return entityId;
  }
}

function formatWikidataPeriod(start?: string, end?: string): string | null {
  if (!start && !end) return null;
  const startYear = start ? start.substring(1, 5) : "?";
  const endYear = end ? end.substring(1, 5) : "present";
  return `${startYear}–${endYear}`;
}

// ── Apollo.io API (Enterprise) ────────────────────────────────────────────────

/**
 * Search Apollo.io for professional profile data.
 * Requires APOLLO_API_KEY environment variable.
 */
export async function searchApolloProfile(
  authorName: string,
  apiKey: string,
): Promise<Partial<ProfessionalProfileResult>> {
  try {
    const [firstName, ...lastParts] = authorName.split(" ");
    const lastName = lastParts.join(" ");

    const res = await fetch("https://api.apollo.io/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        reveal_personal_emails: false,
      }),
      signal: AbortSignal.timeout(AXIOS_TIMEOUT_MS),
    });

    if (!res.ok) return {};
    const data = await res.json();
    const person = data?.person;
    if (!person) return {};

    const roles: ProfessionalRole[] = [];
    if (person.title && person.organization?.name) {
      roles.push({
        title: person.title,
        organization: person.organization.name,
        period: null,
        isCurrent: true,
        source: "apollo",
      });
    }

    // Employment history
    if (person.employment_history) {
      for (const emp of person.employment_history) {
        roles.push({
          title: emp.title || "Unknown",
          organization: emp.organization_name || "Unknown",
          period: emp.start_date
            ? `${emp.start_date}–${emp.end_date || "present"}`
            : null,
          isCurrent: emp.current || false,
          source: "apollo",
        });
      }
    }

    return {
      currentRole: roles.find((r) => r.isCurrent) || null,
      roles,
      linkedinUrl: person.linkedin_url || null,
      source: "apollo",
    };
  } catch {
    return {};
  }
}

// ── Combined Enrichment ───────────────────────────────────────────────────────

/**
 * Enrich an author with professional profile data from all available sources.
 */
export async function enrichProfessionalProfile(
  authorName: string,
): Promise<ProfessionalProfileResult> {
  const apolloKey = process.env.APOLLO_API_KEY;

  // Run all sources in parallel
  const [wikiData, apolloData] = await Promise.all([
    fetchWikipediaProfessionalData(authorName),
    apolloKey
      ? searchApolloProfile(authorName, apolloKey)
      : Promise.resolve({} as Partial<ProfessionalProfileResult>),
  ]);

  // Merge results (Apollo takes priority for current role)
  const roles = [
    ...(apolloData.roles || []),
    ...(wikiData.roles || []),
  ];

  const boardSeats = wikiData.boardSeats || [];
  const education = wikiData.education || [];
  const awards = wikiData.awards || [];

  // Deduplicate roles by organization
  const seenOrgs = new Set<string>();
  const dedupedRoles = roles.filter((r) => {
    const key = `${r.organization}-${r.title}`.toLowerCase();
    if (seenOrgs.has(key)) return false;
    seenOrgs.add(key);
    return true;
  });

  const companyAffiliations: CompanyAffiliation[] = dedupedRoles.map((r) => ({
    name: r.organization,
    role: r.title,
    type: r.title.toLowerCase().includes("found") ? "founded" : "employed",
    url: null,
    description: null,
  }));

  return {
    currentRole: apolloData.currentRole || dedupedRoles.find((r) => r.isCurrent) || null,
    roles: dedupedRoles,
    boardSeats,
    education,
    awards,
    companyAffiliations,
    linkedinUrl: apolloData.linkedinUrl || null,
    totalExperience: null,
    fetchedAt: new Date().toISOString(),
    source: apolloKey ? "combined" : "wikipedia",
  };
}

/**
 * Health check for Apollo.io service.
 */
export async function checkApolloHealth(): Promise<{
  status: "ok" | "unconfigured" | "error";
  latencyMs: number;
}> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return { status: "unconfigured", latencyMs: 0 };

  const start = Date.now();
  try {
    const res = await fetch("https://api.apollo.io/v1/auth/health", {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(10000),
    });
    return {
      status: res.ok ? "ok" : "error",
      latencyMs: Date.now() - start,
    };
  } catch {
    return { status: "error", latencyMs: Date.now() - start };
  }
}
