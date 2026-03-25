/**
 * Vitest tests for Notion Bidirectional Sync — Reading Notes
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  NotionSyncConfig,
  NotionBookPage,
  NotionSyncResult,
  ReadingNote,
} from "./enrichment/notion";

// Mock execSync (used for MCP calls)
vi.mock("child_process", () => ({
  execSync: vi.fn().mockReturnValue(JSON.stringify({ content: [{ text: "{}" }] })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Type Tests ───────────────────────────────────────────────────────────────

describe("Notion Sync — Types", () => {
  it("NotionSyncConfig has required fields", () => {
    const config: NotionSyncConfig = {
      databaseId: "abc123",
      lastSyncAt: "2024-01-01T00:00:00Z",
      syncDirection: "bidirectional",
      autoSync: false,
    };
    expect(config.syncDirection).toBe("bidirectional");
    expect(config.autoSync).toBe(false);
  });

  it("NotionBookPage has required fields", () => {
    const page: NotionBookPage = {
      pageId: "page-123",
      bookTitle: "Think Again",
      authorName: "Adam Grant",
      category: "Psychology",
      rating: 4.5,
      status: "completed",
      notes: "Great book about rethinking assumptions",
      highlights: ["Quote 1", "Quote 2"],
      lastEditedAt: "2024-01-15T10:30:00Z",
      url: "https://notion.so/page-123",
    };
    expect(page.status).toBe("completed");
    expect(page.highlights.length).toBe(2);
  });

  it("NotionSyncResult has required fields", () => {
    const result: NotionSyncResult = {
      pushed: 5,
      pulled: 3,
      errors: [],
      syncedAt: new Date().toISOString(),
    };
    expect(result.pushed).toBe(5);
    expect(result.pulled).toBe(3);
    expect(result.errors).toEqual([]);
  });

  it("ReadingNote has required fields", () => {
    const note: ReadingNote = {
      bookTitle: "Originals",
      pageId: "page-456",
      notes: "Key insights about non-conformity",
      highlights: ["Champions of new ideas are not always the first movers"],
      status: "completed",
      rating: 4,
      startDate: "2024-01-01",
      finishDate: "2024-01-15",
      lastEditedAt: "2024-01-15T10:30:00Z",
      notionUrl: "https://notion.so/page-456",
    };
    expect(note.status).toBe("completed");
    expect(note.rating).toBe(4);
    expect(note.highlights.length).toBe(1);
  });

  it("ReadingNote status can be to_read", () => {
    const note: ReadingNote = {
      bookTitle: "Hidden Potential",
      pageId: "page-789",
      notes: null,
      highlights: [],
      status: "to_read",
      rating: null,
      startDate: null,
      finishDate: null,
      lastEditedAt: "2024-01-01T00:00:00Z",
      notionUrl: "https://notion.so/page-789",
    };
    expect(note.status).toBe("to_read");
    expect(note.notes).toBeNull();
  });

  it("ReadingNote status can be reading", () => {
    const note: ReadingNote = {
      bookTitle: "Give and Take",
      pageId: "page-101",
      notes: "Currently reading chapter 3",
      highlights: ["Givers, takers, and matchers"],
      status: "reading",
      rating: null,
      startDate: "2024-02-01",
      finishDate: null,
      lastEditedAt: "2024-02-10T14:00:00Z",
      notionUrl: "https://notion.so/page-101",
    };
    expect(note.status).toBe("reading");
    expect(note.finishDate).toBeNull();
  });

  it("ReadingNote status can be abandoned", () => {
    const note: ReadingNote = {
      bookTitle: "Some Book",
      pageId: "page-202",
      notes: "Didn't finish",
      highlights: [],
      status: "abandoned",
      rating: 2,
      startDate: "2024-01-01",
      finishDate: null,
      lastEditedAt: "2024-01-05T08:00:00Z",
      notionUrl: "https://notion.so/page-202",
    };
    expect(note.status).toBe("abandoned");
  });
});

// ── checkNotionHealth Tests ──────────────────────────────────────────────────

describe("Notion Sync — checkNotionHealth", () => {
  it("returns health check result", async () => {
    const { execSync } = await import("child_process");
    const mockExecSync = vi.mocked(execSync);

    // Mock successful MCP tool list
    mockExecSync.mockReturnValueOnce(
      Buffer.from("notion_create_page\nnotion_update_page\n")
    );

    const { checkNotionHealth } = await import("./enrichment/notion");
    const result = await checkNotionHealth();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("latencyMs");
  });

  it("returns error status when MCP is unavailable", async () => {
    const { execSync } = await import("child_process");
    const mockExecSync = vi.mocked(execSync);

    mockExecSync.mockImplementationOnce(() => {
      throw new Error("MCP server not available");
    });

    const { checkNotionHealth } = await import("./enrichment/notion");
    const result = await checkNotionHealth();
    expect(result.status).toBe("error");
  });
});

// ── createNotionDatabase Tests ───────────────────────────────────────────────

describe("Notion Sync — createNotionDatabase", () => {
  it("creates a database and returns its ID", async () => {
    const { execSync } = await import("child_process");
    const mockExecSync = vi.mocked(execSync);

    // callNotionMCP parses the JSON directly from execSync output
    mockExecSync.mockReturnValueOnce(
      Buffer.from(JSON.stringify({
        id: "db-123",
        url: "https://notion.so/db-123",
      }))
    );

    const { createNotionDatabase } = await import("./enrichment/notion");
    const result = await createNotionDatabase("parent-page-id");
    expect(result).toBe("db-123");
  });
});
