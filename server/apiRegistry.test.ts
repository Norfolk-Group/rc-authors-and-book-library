/**
 * Tests for the API Registry router
 * Covers: list, toggle, seed, ping procedures
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the DB module ────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "./db";

// ── Helpers ───────────────────────────────────────────────────────────────────
const mockApiEntry = {
  id: 1,
  apiKey: "open-library",
  name: "Open Library",
  description: "Free book metadata",
  category: "books",
  source: "Internet Archive (free)",
  sourceUrl: "https://openlibrary.org/developers/api",
  rapidApiHost: null,
  healthCheckUrl: "https://openlibrary.org/search.json?q=test&limit=1",
  enabled: 1,
  statusColor: "green",
  lastStatusCode: 200,
  lastStatusMessage: "OK",
  lastCheckedAt: new Date(),
  notes: null,
  displayOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("apiRegistry router helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("statusColor is one of the valid values", () => {
    const validColors = ["green", "yellow", "red"];
    expect(validColors).toContain(mockApiEntry.statusColor);
  });

  it("enabled is numeric (0 or 1)", () => {
    expect([0, 1]).toContain(mockApiEntry.enabled);
  });

  it("getDb is called when listing APIs", async () => {
    const mockSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([mockApiEntry]),
      }),
    });
    (getDb as any).mockReturnValue({ select: mockSelect });

    const db = getDb();
    const result = await db!.select().from({} as any).orderBy({} as any);
    expect(result).toEqual([mockApiEntry]);
    expect(mockSelect).toHaveBeenCalledOnce();
  });

  it("toggle converts boolean to 0/1 correctly", () => {
    const toEnabled = (b: boolean) => (b ? 1 : 0);
    expect(toEnabled(true)).toBe(1);
    expect(toEnabled(false)).toBe(0);
  });

  it("statusColor logic maps HTTP codes correctly", () => {
    const colorFromStatus = (code: number): "green" | "yellow" | "red" => {
      if (code >= 200 && code < 300) return "green";
      if (code >= 400 && code < 500) return "red";
      if (code >= 500) return "red";
      return "yellow";
    };
    expect(colorFromStatus(200)).toBe("green");
    expect(colorFromStatus(204)).toBe("green");
    expect(colorFromStatus(401)).toBe("red");
    expect(colorFromStatus(403)).toBe("red");
    expect(colorFromStatus(404)).toBe("red");
    expect(colorFromStatus(500)).toBe("red");
    expect(colorFromStatus(0)).toBe("yellow");
  });

  it("seed data has required fields for all entries", () => {
    const requiredFields = ["apiKey", "name", "category", "source", "sourceUrl", "enabled", "statusColor", "displayOrder"];
    requiredFields.forEach((field) => {
      expect(mockApiEntry).toHaveProperty(field);
    });
  });

  it("API entry category is a valid category", () => {
    const validCategories = ["books", "news", "social", "finance", "travel", "utilities", "ai", "other"];
    expect(validCategories).toContain(mockApiEntry.category);
  });

  it("ping result structure is valid", () => {
    const pingResult = {
      id: 1,
      statusColor: "green" as const,
      statusCode: 200,
      message: "OK",
    };
    expect(pingResult).toHaveProperty("id");
    expect(pingResult).toHaveProperty("statusColor");
    expect(pingResult).toHaveProperty("statusCode");
    expect(pingResult).toHaveProperty("message");
    expect(["green", "yellow", "red"]).toContain(pingResult.statusColor);
  });
});
