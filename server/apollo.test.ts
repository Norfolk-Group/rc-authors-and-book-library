/**
 * Vitest tests for Apollo / Professional Profile Enrichment Module
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ProfessionalRole,
  BoardSeat,
  EducationEntry,
  AwardEntry,
  CompanyAffiliation,
  ProfessionalProfileResult,
} from "./enrichment/apollo";

// ── Mock fetch globally ──────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// ── Helper ───────────────────────────────────────────────────────────────────
function mockJsonResponse(data: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

// ── Type Tests ───────────────────────────────────────────────────────────────

describe("Apollo/Professional Profile — Types", () => {
  it("ProfessionalRole has required fields", () => {
    const role: ProfessionalRole = {
      title: "Professor of Management",
      organization: "Wharton School",
      period: "2013-present",
      isCurrent: true,
      source: "wikipedia",
    };
    expect(role.title).toBe("Professor of Management");
    expect(role.isCurrent).toBe(true);
  });

  it("BoardSeat has required fields", () => {
    const seat: BoardSeat = {
      organization: "Aspen Institute",
      role: "Board Member",
      startYear: 2020,
      endYear: null,
      source: "wikidata",
      url: null,
    };
    expect(seat.organization).toBe("Aspen Institute");
    expect(seat.role).toBe("Board Member");
  });

  it("EducationEntry has required fields", () => {
    const edu: EducationEntry = {
      institution: "Harvard University",
      degree: "PhD",
      field: "Organizational Psychology",
      year: 2006,
    };
    expect(edu.institution).toBe("Harvard University");
    expect(edu.degree).toBe("PhD");
  });

  it("AwardEntry has required fields", () => {
    const award: AwardEntry = {
      name: "Thinkers50 Top Management Thinker",
      organization: "Thinkers50",
      year: 2021,
      description: null,
    };
    expect(award.name).toContain("Thinkers50");
  });

  it("CompanyAffiliation has required fields", () => {
    const affiliation: CompanyAffiliation = {
      name: "Google",
      role: "Advisor",
      type: "advisor",
      url: null,
      description: "Organizational culture advisor",
    };
    expect(affiliation.type).toBe("advisor");
  });

  it("ProfessionalProfileResult has required fields", () => {
    const result: ProfessionalProfileResult = {
      currentRole: null,
      roles: [],
      boardSeats: [],
      education: [],
      awards: [],
      companyAffiliations: [],
      linkedinUrl: null,
      totalExperience: null,
      fetchedAt: new Date().toISOString(),
      source: "wikipedia",
    };
    expect(result.source).toBe("wikipedia");
    expect(result.roles).toEqual([]);
  });
});

// ── fetchWikipediaProfessionalData Tests ─────────────────────────────────────

describe("Apollo/Professional Profile — fetchWikipediaProfessionalData", () => {
  it("returns professional data from Wikipedia/Wikidata", async () => {
    const { fetchWikipediaProfessionalData } = await import("./enrichment/apollo");

    // Mock Wikipedia summary
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        title: "Adam Grant",
        type: "standard",
        wikibase_item: "Q15071083",
      })
    );

    // Mock Wikidata entity
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        entities: {
          Q15071083: {
            claims: {
              P108: [
                {
                  mainsnak: {
                    datavalue: {
                      value: { id: "Q1032717" },
                    },
                  },
                },
              ],
              P69: [
                {
                  mainsnak: {
                    datavalue: {
                      value: { id: "Q13371" },
                    },
                  },
                  qualifiers: {
                    P512: [{ datavalue: { value: { id: "Q849697" } } }],
                  },
                },
              ],
            },
          },
        },
      })
    );

    // Mock Wikidata label lookups
    mockFetch.mockResolvedValue(
      mockJsonResponse({
        entities: {
          Q1032717: { labels: { en: { value: "Wharton School" } } },
          Q13371: { labels: { en: { value: "Harvard University" } } },
          Q849697: { labels: { en: { value: "PhD" } } },
        },
      })
    );

    const result = await fetchWikipediaProfessionalData("Adam Grant");
    expect(result).toBeDefined();
    expect(result.roles).toBeDefined();
    expect(result.education).toBeDefined();
  });

  it("returns empty arrays when Wikipedia page not found", async () => {
    const { fetchWikipediaProfessionalData } = await import("./enrichment/apollo");

    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ type: "disambiguation" })
    );

    const result = await fetchWikipediaProfessionalData("Unknown Person");
    expect(result.roles).toEqual([]);
    expect(result.boardSeats).toEqual([]);
    expect(result.education).toEqual([]);
  });

  it("returns empty arrays on network error", async () => {
    const { fetchWikipediaProfessionalData } = await import("./enrichment/apollo");

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchWikipediaProfessionalData("Adam Grant");
    expect(result.roles).toEqual([]);
  });
});

// ── enrichProfessionalProfile Tests ──────────────────────────────────────────

describe("Apollo/Professional Profile — enrichProfessionalProfile", () => {
  it("returns combined professional profile", async () => {
    const { enrichProfessionalProfile } = await import("./enrichment/apollo");

    // Mock Wikipedia summary
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        title: "Adam Grant",
        type: "standard",
        wikibase_item: "Q15071083",
      })
    );

    // Mock Wikidata entity (minimal)
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        entities: {
          Q15071083: {
            claims: {},
          },
        },
      })
    );

    const result = await enrichProfessionalProfile("Adam Grant");
    expect(result.fetchedAt).toBeTruthy();
    expect(result.source).toBeDefined();
    expect(result.roles).toBeDefined();
    expect(result.boardSeats).toBeDefined();
    expect(result.education).toBeDefined();
    expect(result.awards).toBeDefined();
  });

  it("handles errors gracefully", async () => {
    const { enrichProfessionalProfile } = await import("./enrichment/apollo");

    mockFetch.mockRejectedValue(new Error("All APIs down"));

    const result = await enrichProfessionalProfile("Unknown Author");
    expect(result.fetchedAt).toBeTruthy();
    expect(result.roles).toBeDefined();
  });
});
