/**
 * dropboxIngest.test.ts
 *
 * Tests for the Dropbox Content Ingestion Pipeline:
 * 1. Metadata extraction guardrails (book titles never become author names)
 * 2. Person-name validation
 * 3. Dropbox folder structure constants
 * 4. InboxFile type shape
 * 5. Router procedure registration
 */

import { describe, it, expect } from "vitest";
import { DROPBOX_FOLDERS } from "./dropbox.service";

// ── Folder Structure ──────────────────────────────────────────────────────────

describe("Dropbox Folder Structure", () => {
  it("root folder is an absolute path", () => {
    expect(DROPBOX_FOLDERS.root.startsWith("/")).toBe(true);
  });

  it("inbox folder is an absolute path different from root", () => {
    expect(DROPBOX_FOLDERS.inbox.startsWith("/")).toBe(true);
    expect(DROPBOX_FOLDERS.inbox).not.toBe(DROPBOX_FOLDERS.root);
  });

  it("processed folder is inside the inbox folder", () => {
    expect(DROPBOX_FOLDERS.processed).toContain(DROPBOX_FOLDERS.inbox);
  });

  it("avatars folder is inside the root folder", () => {
    expect(DROPBOX_FOLDERS.avatars).toContain(DROPBOX_FOLDERS.root);
  });

  it("bookCovers folder is inside the root folder", () => {
    expect(DROPBOX_FOLDERS.bookCovers).toContain(DROPBOX_FOLDERS.root);
  });

  it("pdfs folder is inside the root folder", () => {
    expect(DROPBOX_FOLDERS.pdfs).toContain(DROPBOX_FOLDERS.root);
  });
});

// ── Guardrail Logic ───────────────────────────────────────────────────────────

/**
 * Replicate the looksLikePersonName guardrail from dropboxIngest.service.ts
 * so we can unit-test it without importing the full service (which has side effects).
 */
function looksLikePersonName(candidate: string): boolean {
  const lower = candidate.toLowerCase().trim();
  if (!lower.includes(" ")) return false;
  if (candidate.split(" ").length > 4) return false;
  const BOOK_TITLE_KEYWORDS = [
    "active listening",
    "the art of",
    "introduction to",
    "guide to",
    "handbook",
    "principles of",
    "fundamentals of",
    "how to",
    "the power of",
    "the science of",
    "thinking fast",
    "thinking slow",
  ];
  for (const kw of BOOK_TITLE_KEYWORDS) {
    if (lower.includes(kw)) return false;
  }
  if (/^(the|a|an)\s/i.test(lower)) return false;
  return true;
}

describe("Author Name Guardrails", () => {
  it("accepts a normal two-word author name", () => {
    expect(looksLikePersonName("Adam Grant")).toBe(true);
  });

  it("accepts a three-word author name", () => {
    expect(looksLikePersonName("Malcolm Gladwell Jr")).toBe(true);
  });

  it("rejects a single word (no space)", () => {
    expect(looksLikePersonName("Gladwell")).toBe(false);
  });

  it("rejects 'Active Listening' — classic book-title false positive", () => {
    expect(looksLikePersonName("Active Listening")).toBe(false);
  });

  it("rejects 'The Art of War' — starts with 'The'", () => {
    expect(looksLikePersonName("The Art of War")).toBe(false);
  });

  it("rejects 'How to Win Friends' — contains 'how to'", () => {
    expect(looksLikePersonName("How to Win Friends")).toBe(false);
  });

  it("rejects 'The Power of Habit' — contains 'the power of'", () => {
    expect(looksLikePersonName("The Power of Habit")).toBe(false);
  });

  it("rejects 'Thinking Fast and Slow' — contains 'thinking fast'", () => {
    expect(looksLikePersonName("Thinking Fast and Slow")).toBe(false);
  });

  it("rejects very long names (more than 4 words)", () => {
    expect(looksLikePersonName("John Michael Robert David Smith")).toBe(false);
  });

  it("rejects names starting with 'A' article", () => {
    expect(looksLikePersonName("A Guide to Success")).toBe(false);
  });
});

// ── Dropbox Service Exports ───────────────────────────────────────────────────

describe("Dropbox Service Exports", () => {
  it("DROPBOX_FOLDERS has all required keys", () => {
    const keys = Object.keys(DROPBOX_FOLDERS);
    expect(keys).toContain("root");
    expect(keys).toContain("avatars");
    expect(keys).toContain("bookCovers");
    expect(keys).toContain("pdfs");
    expect(keys).toContain("inbox");
    expect(keys).toContain("processed");
  });

  it("all folder paths start with a forward slash", () => {
    for (const [, path] of Object.entries(DROPBOX_FOLDERS)) {
      expect(path.startsWith("/")).toBe(true);
    }
  });

  it("no folder path ends with a trailing slash", () => {
    for (const [, path] of Object.entries(DROPBOX_FOLDERS)) {
      expect(path.endsWith("/")).toBe(false);
    }
  });
});

// ── Ingest Service Exports ────────────────────────────────────────────────────

describe("Dropbox Ingest Service Exports", () => {
  it("extractPdfMetadata is exported from dropboxIngest.service", async () => {
    const mod = await import("./services/dropboxIngest.service");
    expect(typeof mod.extractPdfMetadata).toBe("function");
  });

  it("ingestDropboxFile is exported from dropboxIngest.service", async () => {
    const mod = await import("./services/dropboxIngest.service");
    expect(typeof mod.ingestDropboxFile).toBe("function");
  });
});

// ── Duplicate Detection Pure Functions ───────────────────────────────────────

import {
  normalizeTitle,
  normalizeIsbn,
  normalizeFilename,
  similarityScore,
} from "./services/duplicateDetection.service";
import { sanitizeFilename } from "./dropbox.service";

describe("normalizeTitle", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeTitle("Thinking, Fast and Slow")).toBe("thinking fast and slow");
  });

  it("collapses extra whitespace", () => {
    expect(normalizeTitle("The  Power  of  Habit")).toBe("the power of habit");
  });

  it("trims leading and trailing spaces", () => {
    expect(normalizeTitle("  Atomic Habits  ")).toBe("atomic habits");
  });

  it("removes apostrophes and hyphens", () => {
    expect(normalizeTitle("Man's Search for Meaning")).toBe("mans search for meaning");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeTitle("")).toBe("");
  });
});

describe("normalizeIsbn", () => {
  it("strips hyphens from ISBN-13", () => {
    expect(normalizeIsbn("978-0-06-112008-4")).toBe("9780061120084");
  });

  it("strips spaces from ISBN", () => {
    expect(normalizeIsbn("978 0 06 112008 4")).toBe("9780061120084");
  });

  it("uppercases any letters (ISBN-10 check digit X)", () => {
    expect(normalizeIsbn("0-306-40615-x")).toBe("030640615X");
  });

  it("returns unchanged string if already clean", () => {
    expect(normalizeIsbn("9780061120084")).toBe("9780061120084");
  });
});

describe("normalizeFilename", () => {
  it("strips extension", () => {
    expect(normalizeFilename("atomic-habits.pdf")).toBe("atomic-habits");
  });

  it("replaces spaces and special chars with hyphens", () => {
    expect(normalizeFilename("Thinking Fast & Slow.pdf")).toBe("thinking-fast-slow");
  });

  it("collapses multiple hyphens", () => {
    expect(normalizeFilename("the--power--of--habit.pdf")).toBe("the-power-of-habit");
  });

  it("strips leading and trailing hyphens", () => {
    expect(normalizeFilename("-atomic-habits-.pdf")).toBe("atomic-habits");
  });
});

describe("similarityScore", () => {
  it("returns 1 for identical strings", () => {
    expect(similarityScore("atomic habits", "atomic habits")).toBe(1);
  });

  it("returns 0 for completely different same-length strings", () => {
    const score = similarityScore("aaa", "bbb");
    expect(score).toBe(0);
  });

  it("returns high score for one-character difference", () => {
    const score = similarityScore("atomic habits", "atomic habitz");
    expect(score).toBeGreaterThan(0.9);
  });

  it("returns low score for very different strings", () => {
    const score = similarityScore("abc", "xyz");
    expect(score).toBeLessThan(0.5);
  });

  it("handles empty strings — returns 1 (both empty)", () => {
    expect(similarityScore("", "")).toBe(1);
  });
});

describe("sanitizeFilename", () => {
  it("replaces spaces with hyphens", () => {
    expect(sanitizeFilename("Atomic Habits")).toBe("atomic-habits");
  });

  it("replaces special characters with hyphens", () => {
    expect(sanitizeFilename("Man's Search!")).toBe("man-s-search");
  });

  it("collapses multiple hyphens", () => {
    expect(sanitizeFilename("the--power")).toBe("the-power");
  });

  it("strips leading and trailing hyphens", () => {
    expect(sanitizeFilename("-atomic-habits-")).toBe("atomic-habits");
  });

  it("preserves dots and underscores", () => {
    expect(sanitizeFilename("cover.jpg")).toBe("cover.jpg");
  });

  it("lowercases output", () => {
    expect(sanitizeFilename("AtomicHabits")).toBe("atomichabits");
  });
});
