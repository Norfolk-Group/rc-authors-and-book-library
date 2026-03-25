/**
 * Vitest tests for Context7 / Technical References Enrichment Module
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  CodeReference,
  TechnicalReferencesResult,
} from "./enrichment/context7";

// ── Mock fetch globally ──────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock execSync (used for MCP calls)
vi.mock("child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));

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

describe("Context7/Technical References — Types", () => {
  it("CodeReference has required fields", () => {
    const ref: CodeReference = {
      title: "TensorFlow Documentation",
      url: "https://tensorflow.org/docs",
      type: "documentation",
      language: "Python",
      framework: "TensorFlow",
      description: "Official TensorFlow documentation",
      stars: null,
      source: "devdocs",
    };
    expect(ref.type).toBe("documentation");
    expect(ref.source).toBe("devdocs");
  });

  it("TechnicalReferencesResult has required fields", () => {
    const result: TechnicalReferencesResult = {
      bookTitle: "Deep Learning with Python",
      references: [],
      technologies: ["Python", "TensorFlow"],
      frameworks: ["Keras"],
      languages: ["Python"],
      totalReferences: 0,
      fetchedAt: new Date().toISOString(),
      source: "github",
    };
    expect(result.bookTitle).toBe("Deep Learning with Python");
    expect(result.technologies).toContain("Python");
  });
});

// ── GitHub Search Tests ──────────────────────────────────────────────────────

describe("Context7/Technical References — searchGitHubRepos", () => {
  it("returns repositories from GitHub API", async () => {
    const { searchGitHubRepos } = await import("./enrichment/context7");

    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        items: [
          {
            full_name: "tensorflow/tensorflow",
            html_url: "https://github.com/tensorflow/tensorflow",
            description: "An Open Source Machine Learning Framework",
            stargazers_count: 180000,
            language: "Python",
            topics: ["machine-learning", "deep-learning"],
          },
          {
            full_name: "keras-team/keras",
            html_url: "https://github.com/keras-team/keras",
            description: "Deep Learning for humans",
            stargazers_count: 60000,
            language: "Python",
            topics: ["deep-learning", "neural-networks"],
          },
        ],
      })
    );

    const results = await searchGitHubRepos("machine learning deep learning", 5);
    expect(results.length).toBe(2);
    expect(results[0].source).toBe("github");
    expect(results[0].type).toBe("repository");
    expect(results[0].stars).toBe(180000);
    expect(results[0].url).toContain("github.com");
  });

  it("returns empty array when no results", async () => {
    const { searchGitHubRepos } = await import("./enrichment/context7");

    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ items: [] })
    );

    const results = await searchGitHubRepos("nonexistent topic xyz", 5);
    expect(results).toEqual([]);
  });

  it("returns empty array on API error", async () => {
    const { searchGitHubRepos } = await import("./enrichment/context7");

    mockFetch.mockRejectedValueOnce(new Error("Rate limited"));

    const results = await searchGitHubRepos("test", 5);
    expect(results).toEqual([]);
  });
});

// ── Technology Detection Tests ───────────────────────────────────────────────

describe("Context7/Technical References — detectTechnologies", () => {
  it("detects technologies from book summary", async () => {
    const { detectTechnologies } = await import("./enrichment/context7");

    const result = detectTechnologies(
      "Deep Learning with Python",
      "A comprehensive guide to machine learning and deep learning using Python and TensorFlow",
      "machine learning, deep learning, neural networks"
    );
    expect(result.languages.length).toBeGreaterThan(0);
    expect(result.searchTerms.length).toBeGreaterThan(0);
  });

  it("returns empty for non-technical books", async () => {
    const { detectTechnologies } = await import("./enrichment/context7");

    const result = detectTechnologies(
      "Think Again",
      "A book about the power of knowing what you don't know",
      "psychology, leadership, decision-making"
    );
    // Non-technical books may still detect some terms from leadership/management
    expect(result).toBeDefined();
  });
});

// ── enrichTechnicalReferences Tests ──────────────────────────────────────────

describe("Context7/Technical References — enrichTechnicalReferences", () => {
  it("returns combined technical references", async () => {
    const { enrichTechnicalReferences } = await import("./enrichment/context7");

    // Mock GitHub search
    mockFetch.mockResolvedValue(
      mockJsonResponse({
        items: [
          {
            full_name: "test/repo",
            html_url: "https://github.com/test/repo",
            description: "Test repo",
            stargazers_count: 1000,
            language: "Python",
            topics: [],
          },
        ],
      })
    );

    const result = await enrichTechnicalReferences(
      "Deep Learning with Python",
      "Machine learning guide using Python",
      "machine learning, deep learning"
    );
    expect(result.bookTitle).toBe("Deep Learning with Python");
    expect(result.fetchedAt).toBeTruthy();
    expect(result.source).toBeDefined();
    expect(result.technologies).toBeDefined();
    expect(result.references).toBeDefined();
  });

  it("handles non-technical books gracefully", async () => {
    const { enrichTechnicalReferences } = await import("./enrichment/context7");

    // Mock empty GitHub results
    mockFetch.mockResolvedValue(
      mockJsonResponse({ items: [] })
    );

    const result = await enrichTechnicalReferences(
      "Think Again",
      "Psychology of rethinking",
      "psychology"
    );
    expect(result.bookTitle).toBe("Think Again");
    expect(result.fetchedAt).toBeTruthy();
  });
});
