/**
 * Vitest tests for Quartr / SEC EDGAR Enrichment Module
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  FilingMention,
  EarningsCallMention,
  EnterpriseImpactResult,
} from "./enrichment/quartr";

// ── Mock fetch globally ──────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  delete process.env.QUARTR_API_KEY;
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

describe("Quartr/SEC EDGAR — Types", () => {
  it("FilingMention has required fields", () => {
    const mention: FilingMention = {
      source: "sec_edgar",
      filingType: "10-K",
      companyName: "Microsoft Corp",
      ticker: "MSFT",
      filingDate: "2024-06-30",
      title: "Microsoft Corp - 10-K",
      url: "https://www.sec.gov/...",
      excerpt: "Author mentioned in filing...",
    };
    expect(mention.source).toBe("sec_edgar");
    expect(mention.filingType).toBe("10-K");
    expect(mention.companyName).toBe("Microsoft Corp");
  });

  it("EarningsCallMention has required fields", () => {
    const mention: EarningsCallMention = {
      source: "quartr",
      companyName: "Apple Inc",
      ticker: "AAPL",
      eventDate: "2024-01-25",
      eventType: "earnings_call",
      title: "Apple Q1 2024 Earnings Call",
      url: "https://quartr.com/...",
      mentionContext: "The CEO referenced the book...",
    };
    expect(mention.source).toBe("quartr");
    expect(mention.eventType).toBe("earnings_call");
  });

  it("EnterpriseImpactResult has required fields", () => {
    const result: EnterpriseImpactResult = {
      filingMentions: [],
      earningsCallMentions: [],
      advisoryRoles: [],
      totalMentions: 0,
      uniqueCompanies: [],
      impactScore: "none",
      fetchedAt: new Date().toISOString(),
    };
    expect(result.impactScore).toBe("none");
    expect(result.totalMentions).toBe(0);
  });
});

// ── searchEdgarFilings Tests ─────────────────────────────────────────────────

describe("Quartr/SEC EDGAR — searchEdgarFilings", () => {
  it("returns filing mentions from EDGAR EFTS response", async () => {
    const { searchEdgarFilings } = await import("./enrichment/quartr");

    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        hits: {
          hits: [
            {
              _source: {
                form_type: "10-K",
                entity_name: "Microsoft Corp",
                tickers: ["MSFT"],
                file_date: "2024-06-30",
                display_names: ["Microsoft Corp"],
                file_num: "001-37845",
              },
              highlight: {
                content: ["...Adam Grant's research on organizational behavior..."],
              },
            },
          ],
        },
      })
    );

    const results = await searchEdgarFilings("Adam Grant", 10);
    expect(results.length).toBe(1);
    expect(results[0].source).toBe("sec_edgar");
    expect(results[0].filingType).toBe("10-K");
    expect(results[0].companyName).toBe("Microsoft Corp");
    expect(results[0].ticker).toBe("MSFT");
    expect(results[0].excerpt).toContain("Adam Grant");
  });

  it("returns empty array when no hits", async () => {
    const { searchEdgarFilings } = await import("./enrichment/quartr");

    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ hits: { hits: [] } })
    );

    const results = await searchEdgarFilings("Unknown Author", 10);
    expect(results).toEqual([]);
  });

  it("falls back to basic search on EFTS error", async () => {
    const { searchEdgarFilings } = await import("./enrichment/quartr");

    // First call (EFTS) fails
    mockFetch.mockRejectedValueOnce(new Error("EFTS unavailable"));
    // Second call (basic search) returns Atom XML
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => `<feed><entry><title>Test Company</title><link href="https://sec.gov/test"/><updated>2024-01-01T00:00:00Z</updated><summary>Test summary</summary></entry></feed>`,
    });

    const results = await searchEdgarFilings("Adam Grant", 10);
    expect(results.length).toBe(1);
    expect(results[0].source).toBe("sec_edgar");
    expect(results[0].filingType).toBe("DEF 14A");
  });
});

// ── enrichEnterpriseImpact Tests ─────────────────────────────────────────────

describe("Quartr/SEC EDGAR — enrichEnterpriseImpact", () => {
  it("returns combined result with impact score", async () => {
    const { enrichEnterpriseImpact } = await import("./enrichment/quartr");

    // Mock EDGAR response with multiple filings
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        hits: {
          hits: Array.from({ length: 5 }, (_, i) => ({
            _source: {
              form_type: "10-K",
              entity_name: `Company ${i}`,
              tickers: [`TICK${i}`],
              file_date: "2024-01-01",
              display_names: [`Company ${i}`],
            },
            highlight: { content: ["mention..."] },
          })),
        },
      })
    );

    const result = await enrichEnterpriseImpact("Adam Grant", ["Originals"]);
    expect(result.totalMentions).toBe(5);
    expect(result.uniqueCompanies.length).toBe(5);
    expect(result.impactScore).toBe("high"); // 5 unique companies >= 5 = high
    expect(result.fetchedAt).toBeTruthy();
  });

  it("returns 'none' impact score when no mentions found", async () => {
    const { enrichEnterpriseImpact } = await import("./enrichment/quartr");

    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ hits: { hits: [] } })
    );

    const result = await enrichEnterpriseImpact("Unknown Author", []);
    expect(result.totalMentions).toBe(0);
    expect(result.impactScore).toBe("none");
    expect(result.filingMentions).toEqual([]);
  });

  it("returns 'high' impact score for 10+ mentions", async () => {
    const { enrichEnterpriseImpact } = await import("./enrichment/quartr");

    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        hits: {
          hits: Array.from({ length: 12 }, (_, i) => ({
            _source: {
              form_type: "10-K",
              entity_name: `Company ${i}`,
              tickers: [`T${i}`],
              file_date: "2024-01-01",
              display_names: [`Company ${i}`],
            },
            highlight: { content: ["mention..."] },
          })),
        },
      })
    );

    const result = await enrichEnterpriseImpact("Adam Grant", []);
    expect(result.impactScore).toBe("high");
  });
});

// ── searchQuartrTranscripts Tests ────────────────────────────────────────────

describe("Quartr/SEC EDGAR — searchQuartrTranscripts", () => {
  it("returns earnings call mentions from Quartr API", async () => {
    const { searchQuartrTranscripts } = await import("./enrichment/quartr");

    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        data: [
          {
            company: { name: "Apple Inc", ticker: "AAPL", slug: "apple" },
            event: { date: "2024-01-25", type: "earnings_call", title: "Q1 2024" },
            url: "https://quartr.com/apple/q1-2024",
          },
        ],
      })
    );

    const results = await searchQuartrTranscripts("Adam Grant", "test-key", 10);
    expect(results.length).toBe(1);
    expect(results[0].source).toBe("quartr");
    expect(results[0].companyName).toBe("Apple Inc");
    expect(results[0].ticker).toBe("AAPL");
  });

  it("returns empty array when no data", async () => {
    const { searchQuartrTranscripts } = await import("./enrichment/quartr");

    mockFetch.mockResolvedValueOnce(mockJsonResponse({ data: [] }));

    const results = await searchQuartrTranscripts("Unknown", "test-key", 10);
    expect(results).toEqual([]);
  });

  it("returns empty array on API error", async () => {
    const { searchQuartrTranscripts } = await import("./enrichment/quartr");

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const results = await searchQuartrTranscripts("Adam Grant", "test-key", 10);
    expect(results).toEqual([]);
  });
});

// ── Health Check Tests ───────────────────────────────────────────────────────

describe("Quartr/SEC EDGAR — checkQuartrHealth", () => {
  it("returns ok for SEC EDGAR when reachable", async () => {
    const { checkQuartrHealth } = await import("./enrichment/quartr");

    mockFetch.mockResolvedValueOnce(mockJsonResponse({ hits: { total: 1 } }));

    const result = await checkQuartrHealth();
    expect(result.secEdgar.status).toBe("ok");
    expect(result.quartr.status).toBe("unconfigured");
  });

  it("returns error for SEC EDGAR when unreachable", async () => {
    const { checkQuartrHealth } = await import("./enrichment/quartr");

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await checkQuartrHealth();
    expect(result.secEdgar.status).toBe("error");
  });
});
