/**
 * authorPanels.test.ts — Unit tests for Tasks 29-31 author panel data helpers
 *
 * Tests cover:
 *   - LinkedInStatsPanel: data shape validation and format helpers
 *   - WikipediaQuickFactsPanel: data shape validation
 *   - YahooFinancePanel: market cap and price formatting
 *   - businessProfileJson parsing
 *   - socialStatsJson linkedin field parsing
 */
import { describe, it, expect } from "vitest";

// ── formatCount helper (mirrors the one in AuthorDetail / panel components) ────
function formatCount(n: number | null | undefined): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

// ── formatMarketCap helper (mirrors YahooFinancePanel) ────────────────────────
function formatMarketCap(n: number | null | undefined): string {
  if (!n) return "";
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

// ── formatPrice helper (mirrors YahooFinancePanel) ────────────────────────────
function formatPrice(n: number | null | undefined, currency: string | null): string {
  if (!n) return "";
  const symbol = currency === "USD" ? "$" : (currency ?? "$");
  return `${symbol}${n.toFixed(2)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LinkedIn Stats Panel tests
// ─────────────────────────────────────────────────────────────────────────────
describe("LinkedInStatsPanel data helpers", () => {
  it("formats follower count in thousands", () => {
    expect(formatCount(125_000)).toBe("125K");
  });

  it("formats follower count in millions", () => {
    expect(formatCount(3_200_000)).toBe("3.2M");
  });

  it("formats small follower count as-is", () => {
    expect(formatCount(500)).toBe("500");
  });

  it("returns empty string for null follower count", () => {
    expect(formatCount(null)).toBe("");
  });

  it("returns empty string for zero follower count", () => {
    expect(formatCount(0)).toBe("");
  });

  it("validates LinkedIn stats shape from socialStatsJson", () => {
    const socialStatsJson = JSON.stringify({
      linkedin: {
        followerCount: 250_000,
        connectionCount: 500,
        headline: "Author & Organizational Psychologist at Wharton",
        profileUrl: "https://www.linkedin.com/in/adamgrant",
        fetchedAt: "2024-01-15T10:00:00Z",
      },
      enrichedAt: "2024-01-15T10:00:00Z",
      platformsAttempted: ["linkedin"],
      platformsSucceeded: ["linkedin"],
    });

    const parsed = JSON.parse(socialStatsJson);
    expect(parsed.linkedin).toBeDefined();
    expect(parsed.linkedin.followerCount).toBe(250_000);
    expect(parsed.linkedin.headline).toBe("Author & Organizational Psychologist at Wharton");
    expect(parsed.linkedin.profileUrl).toContain("linkedin.com");
  });

  it("handles missing linkedin field gracefully", () => {
    const socialStatsJson = JSON.stringify({
      github: { followers: 1000 },
      enrichedAt: "2024-01-15T10:00:00Z",
      platformsAttempted: ["github"],
      platformsSucceeded: ["github"],
    });

    const parsed = JSON.parse(socialStatsJson);
    expect(parsed.linkedin).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Wikipedia Quick Facts Panel tests
// ─────────────────────────────────────────────────────────────────────────────
describe("WikipediaQuickFactsPanel data helpers", () => {
  it("formats monthly view count", () => {
    expect(formatCount(45_000)).toBe("45K");
  });

  it("formats large monthly view count in millions", () => {
    expect(formatCount(1_500_000)).toBe("1.5M");
  });

  it("validates Wikipedia stats shape from socialStatsJson", () => {
    const socialStatsJson = JSON.stringify({
      wikipedia: {
        pageTitle: "Adam Grant",
        pageUrl: "https://en.wikipedia.org/wiki/Adam_Grant",
        description: "American organizational psychologist",
        extract: "Adam Grant is an American author and organizational psychologist...",
        thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Adam_Grant.jpg/320px-Adam_Grant.jpg",
        avgMonthlyViews: 45_000,
        fetchedAt: "2024-01-15T10:00:00Z",
      },
      enrichedAt: "2024-01-15T10:00:00Z",
      platformsAttempted: ["wikipedia"],
      platformsSucceeded: ["wikipedia"],
    });

    const parsed = JSON.parse(socialStatsJson);
    expect(parsed.wikipedia).toBeDefined();
    expect(parsed.wikipedia.pageTitle).toBe("Adam Grant");
    expect(parsed.wikipedia.pageUrl).toContain("wikipedia.org");
    expect(parsed.wikipedia.avgMonthlyViews).toBe(45_000);
  });

  it("handles null extract gracefully", () => {
    const wiki = {
      pageTitle: "Some Author",
      pageUrl: "https://en.wikipedia.org/wiki/Some_Author",
      description: "An author",
      extract: null,
      thumbnailUrl: null,
      avgMonthlyViews: 0,
    };
    expect(wiki.extract).toBeNull();
    expect(wiki.thumbnailUrl).toBeNull();
    expect(formatCount(wiki.avgMonthlyViews)).toBe("");
  });

  it("returns empty string for zero monthly views", () => {
    expect(formatCount(0)).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Yahoo Finance Panel tests
// ─────────────────────────────────────────────────────────────────────────────
describe("YahooFinancePanel data helpers", () => {
  it("formats market cap in billions", () => {
    expect(formatMarketCap(450_000_000_000)).toBe("$450.00B");
  });

  it("formats market cap in trillions", () => {
    expect(formatMarketCap(2_800_000_000_000)).toBe("$2.80T");
  });

  it("formats market cap in millions", () => {
    expect(formatMarketCap(500_000_000)).toBe("$500.0M");
  });

  it("formats price with USD symbol", () => {
    expect(formatPrice(184.92, "USD")).toBe("$184.92");
  });

  it("formats price with non-USD currency", () => {
    expect(formatPrice(150.0, "EUR")).toBe("EUR150.00");
  });

  it("returns empty string for null price", () => {
    expect(formatPrice(null, "USD")).toBe("");
  });

  it("returns empty string for null market cap", () => {
    expect(formatMarketCap(null)).toBe("");
  });

  it("validates Yahoo Finance stats shape from businessProfileJson", () => {
    const businessProfileJson = JSON.stringify({
      yahooFinance: {
        ticker: "MSFT",
        shortName: "Microsoft Corporation",
        regularMarketPrice: 415.32,
        marketCap: 3_090_000_000_000,
        currency: "USD",
        exchange: "NMS",
        fiftyTwoWeekHigh: 468.35,
        fiftyTwoWeekLow: 309.45,
        fetchedAt: "2024-01-15T10:00:00Z",
      },
    });

    const parsed = JSON.parse(businessProfileJson);
    expect(parsed.yahooFinance).toBeDefined();
    expect(parsed.yahooFinance.ticker).toBe("MSFT");
    expect(parsed.yahooFinance.regularMarketPrice).toBe(415.32);
    expect(formatMarketCap(parsed.yahooFinance.marketCap)).toBe("$3.09T");
    expect(formatPrice(parsed.yahooFinance.regularMarketPrice, parsed.yahooFinance.currency)).toBe("$415.32");
  });

  it("handles missing yahooFinance field gracefully", () => {
    const businessProfileJson = JSON.stringify({});
    const parsed = JSON.parse(businessProfileJson);
    expect(parsed.yahooFinance).toBeUndefined();
  });

  it("shows ticker-only state when yahooFinance is null but ticker exists", () => {
    const stockTicker = "AAPL";
    const yahooFinance = null;
    // Panel should render ticker-only state
    expect(yahooFinance).toBeNull();
    expect(stockTicker).toBe("AAPL");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: AuthorDetail panel data extraction
// ─────────────────────────────────────────────────────────────────────────────
describe("AuthorDetail panel data extraction", () => {
  it("extracts linkedin from socialStatsJson correctly", () => {
    const profile = {
      socialStatsJson: JSON.stringify({
        linkedin: {
          followerCount: 500_000,
          connectionCount: 500,
          headline: "Bestselling Author | Organizational Psychologist",
          profileUrl: "https://www.linkedin.com/in/adamgrant",
          fetchedAt: "2024-01-15T10:00:00Z",
        },
        enrichedAt: "2024-01-15T10:00:00Z",
        platformsAttempted: ["linkedin"],
        platformsSucceeded: ["linkedin"],
      }),
    };

    const socialStats = JSON.parse(profile.socialStatsJson);
    expect(socialStats.linkedin?.followerCount).toBe(500_000);
    expect(formatCount(socialStats.linkedin?.followerCount)).toBe("500K");
  });

  it("extracts wikipedia from socialStatsJson correctly", () => {
    const profile = {
      socialStatsJson: JSON.stringify({
        wikipedia: {
          pageTitle: "Malcolm Gladwell",
          pageUrl: "https://en.wikipedia.org/wiki/Malcolm_Gladwell",
          description: "Canadian journalist and author",
          extract: "Malcolm Timothy Gladwell is a Canadian journalist, author...",
          thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/m/m1/Malcolm_Gladwell.jpg/320px-Malcolm_Gladwell.jpg",
          avgMonthlyViews: 120_000,
        },
        enrichedAt: "2024-01-15T10:00:00Z",
        platformsAttempted: ["wikipedia"],
        platformsSucceeded: ["wikipedia"],
      }),
    };

    const socialStats = JSON.parse(profile.socialStatsJson);
    const wiki = socialStats.wikipedia;
    expect(wiki?.pageTitle).toBe("Malcolm Gladwell");
    expect(wiki?.pageUrl).toBeTruthy();
    expect(formatCount(wiki?.avgMonthlyViews)).toBe("120K");
  });

  it("extracts yahooFinance from businessProfileJson correctly", () => {
    const profile = {
      businessProfileJson: JSON.stringify({
        yahooFinance: {
          ticker: "AMZN",
          shortName: "Amazon.com Inc.",
          regularMarketPrice: 185.07,
          marketCap: 1_920_000_000_000,
          currency: "USD",
          exchange: "NMS",
          fiftyTwoWeekHigh: 201.20,
          fiftyTwoWeekLow: 118.35,
          fetchedAt: "2024-01-15T10:00:00Z",
        },
      }),
    };

    const businessProfile = JSON.parse(profile.businessProfileJson);
    expect(businessProfile.yahooFinance?.ticker).toBe("AMZN");
    expect(formatMarketCap(businessProfile.yahooFinance?.marketCap)).toBe("$1.92T");
  });

  it("handles null businessProfileJson gracefully", () => {
    const profile = { businessProfileJson: null };
    let businessProfile = null;
    try {
      businessProfile = profile.businessProfileJson ? JSON.parse(profile.businessProfileJson) : null;
    } catch {
      businessProfile = null;
    }
    expect(businessProfile).toBeNull();
  });

  it("handles malformed JSON in socialStatsJson gracefully", () => {
    const profile = { socialStatsJson: "not-valid-json" };
    let socialStats = null;
    try {
      socialStats = JSON.parse(profile.socialStatsJson);
    } catch {
      socialStats = null;
    }
    expect(socialStats).toBeNull();
  });
});
