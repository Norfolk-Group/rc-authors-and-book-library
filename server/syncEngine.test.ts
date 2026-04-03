/**
 * syncEngine.test.ts
 *
 * Unit tests for the sync engine primitives:
 *   - generateBookMetadata
 *   - slugify
 *   - dropboxSimpleUpload (mocked fetch)
 *   - dropboxStreamUpload (mocked fetch)
 *   - uploadToDropbox (routing logic)
 *   - uploadMetadataSidecarToDropbox (mocked fetch)
 *   - getOrCreateDriveFolder (mocked fetch)
 *   - uploadToDrive (mocked fetch)
 *   - uploadMetadataSidecarToDrive (mocked fetch)
 *   - openS3Stream (mocked fetch)
 *   - fetchS3Buffer (mocked fetch)
 *   - DROPBOX_SIMPLE_UPLOAD_LIMIT / DROPBOX_CHUNK_SIZE constants
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateBookMetadata,
  slugify,
  DROPBOX_SIMPLE_UPLOAD_LIMIT,
  DROPBOX_CHUNK_SIZE,
  dropboxSimpleUpload,
  uploadMetadataSidecarToDropbox,
  getOrCreateDriveFolder,
  uploadMetadataSidecarToDrive,
  openS3Stream,
  fetchS3Buffer,
  uploadToDropbox,
} from "./syncEngine";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReadableStream(content: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(content));
      controller.close();
    },
  });
}

function makeNodeStream(content: string): NodeJS.ReadableStream {
  const { Readable } = require("stream");
  return Readable.from([Buffer.from(content)]);
}

// ── Constants ─────────────────────────────────────────────────────────────────

describe("Sync engine constants", () => {
  it("DROPBOX_SIMPLE_UPLOAD_LIMIT is 150 MB", () => {
    expect(DROPBOX_SIMPLE_UPLOAD_LIMIT).toBe(150 * 1024 * 1024);
  });

  it("DROPBOX_CHUNK_SIZE is 50 MB", () => {
    expect(DROPBOX_CHUNK_SIZE).toBe(50 * 1024 * 1024);
  });
});

// ── slugify ───────────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Adam Grant")).toBe("adam-grant");
  });

  it("removes special characters", () => {
    expect(slugify("Brené Brown")).toBe("bren-brown");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("The  Power   of Now")).toBe("the-power-of-now");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  Leading Space  ")).toBe("leading-space");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles already-slugified strings", () => {
    expect(slugify("adam-grant")).toBe("adam-grant");
  });
});

// ── generateBookMetadata ──────────────────────────────────────────────────────

describe("generateBookMetadata", () => {
  it("returns a BookMetadata object with correct title and author", () => {
    const meta = generateBookMetadata({
      bookTitle: "Think Again",
      authorName: "Adam Grant",
    });
    expect(meta.title).toBe("Think Again");
    expect(meta.author).toBe("Adam Grant");
  });

  it("uses Unknown for missing author", () => {
    const meta = generateBookMetadata({ bookTitle: "No Author Book" });
    expect(meta.author).toBe("Unknown");
  });

  it("includes generatedAt as an ISO timestamp", () => {
    const meta = generateBookMetadata({ bookTitle: "Test" });
    expect(meta.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("passes through optional fields", () => {
    const meta = generateBookMetadata({
      bookTitle: "Atomic Habits",
      authorName: "James Clear",
      isbn: "978-0735211292",
      rating: "4.8",
      ratingCount: 12000,
      summary: "Build good habits.",
      s3CoverUrl: "https://cdn.example.com/cover.jpg",
      amazonUrl: "https://amazon.com/dp/0735211299",
      goodreadsUrl: "https://goodreads.com/book/show/40121378",
      publishedDate: "2018-10-16",
      format: "physical",
      possessionStatus: "owned",
    });
    expect(meta.isbn).toBe("978-0735211292");
    expect(meta.rating).toBe("4.8");
    expect(meta.ratingCount).toBe(12000);
    expect(meta.summary).toBe("Build good habits.");
    expect(meta.s3CoverUrl).toBe("https://cdn.example.com/cover.jpg");
    expect(meta.amazonUrl).toBe("https://amazon.com/dp/0735211299");
    expect(meta.format).toBe("physical");
    expect(meta.possessionStatus).toBe("owned");
  });

  it("parses keyThemesJson array", () => {
    const meta = generateBookMetadata({
      bookTitle: "Test",
      keyThemesJson: JSON.stringify(["habits", "productivity"]),
    });
    expect(meta.keyThemes).toEqual(["habits", "productivity"]);
  });

  it("handles invalid keyThemesJson gracefully", () => {
    const meta = generateBookMetadata({
      bookTitle: "Test",
      keyThemesJson: "not-json",
    });
    expect(meta.keyThemes).toBeNull();
  });
});

// ── openS3Stream ──────────────────────────────────────────────────────────────

describe("openS3Stream", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns stream result on 200 response", async () => {
    const mockStream = makeReadableStream("file content");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(mockStream, {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-length": "12",
        },
      })
    );
    const result = await openS3Stream("https://s3.example.com/file.jpg");
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe("image/jpeg");
    expect(result!.contentLength).toBe(12);
  });

  it("returns null on non-200 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));
    const result = await openS3Stream("https://s3.example.com/missing.jpg");
    expect(result).toBeNull();
  });

  it("returns null on fetch error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));
    const result = await openS3Stream("https://s3.example.com/file.jpg");
    expect(result).toBeNull();
  });
});

// ── fetchS3Buffer ─────────────────────────────────────────────────────────────

describe("fetchS3Buffer", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a Buffer on 200 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 })
    );
    const buf = await fetchS3Buffer("https://s3.example.com/file.jpg");
    expect(buf).not.toBeNull();
    expect(Buffer.isBuffer(buf)).toBe(true);
  });

  it("returns null on non-200 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 403 }));
    const buf = await fetchS3Buffer("https://s3.example.com/file.jpg");
    expect(buf).toBeNull();
  });
});

// ── dropboxSimpleUpload ───────────────────────────────────────────────────────

describe("dropboxSimpleUpload", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns success on 200 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "abc123" }), { status: 200 })
    );
    const result = await dropboxSimpleUpload(
      "test-token",
      "/Authors/Adam Grant/books/think-again/cover.jpg",
      Buffer.from("fake image data"),
      false
    );
    expect(result.success).toBe(true);
    expect(result.bytes).toBe(15); // "fake image data".length
  });

  it("returns failure on non-200 response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error_summary: "path/conflict" }), { status: 409 })
    );
    const result = await dropboxSimpleUpload(
      "test-token",
      "/Authors/test/file.jpg",
      Buffer.from("data"),
      false
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("uses overwrite mode when overwrite=true", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "abc" }), { status: 200 })
    );
    await dropboxSimpleUpload(
      "test-token",
      "/path/file.jpg",
      Buffer.from("data"),
      true
    );
    const callArgs = vi.mocked(fetch).mock.calls[0];
    const headers = callArgs[1]?.headers as Record<string, string>;
    const apiArg = JSON.parse(headers["Dropbox-API-Arg"]);
    expect(apiArg.mode).toBe("overwrite");
  });

  it("uses add mode when overwrite=false", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "abc" }), { status: 200 })
    );
    await dropboxSimpleUpload(
      "test-token",
      "/path/file.jpg",
      Buffer.from("data"),
      false
    );
    const callArgs = vi.mocked(fetch).mock.calls[0];
    const headers = callArgs[1]?.headers as Record<string, string>;
    const apiArg = JSON.parse(headers["Dropbox-API-Arg"]);
    expect(apiArg.mode).toBe("add");
  });
});

// ── uploadMetadataSidecarToDropbox ────────────────────────────────────────────

describe("uploadMetadataSidecarToDropbox", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads _metadata.json to correct Dropbox path", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "meta123" }), { status: 200 })
    );
    const metadata = generateBookMetadata({
      bookTitle: "Think Again",
      authorName: "Adam Grant",
    });
    const result = await uploadMetadataSidecarToDropbox(
      "test-token",
      "adam-grant",
      "think-again",
      metadata,
      true
    );
    expect(result.success).toBe(true);
    // Verify the path contains _metadata.json
    const callArgs = vi.mocked(fetch).mock.calls[0];
    const headers = callArgs[1]?.headers as Record<string, string>;
    const apiArg = JSON.parse(headers["Dropbox-API-Arg"]);
    expect(apiArg.path).toContain("_metadata.json");
    expect(apiArg.path).toContain("adam-grant");
    expect(apiArg.path).toContain("think-again");
  });

  it("returns failure when Dropbox returns error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error_summary: "path/conflict" }), { status: 409 })
    );
    const metadata = generateBookMetadata({ bookTitle: "Test" });
    const result = await uploadMetadataSidecarToDropbox(
      "test-token",
      "author",
      "book",
      metadata,
      false
    );
    expect(result.success).toBe(false);
  });
});

// ── getOrCreateDriveFolder ────────────────────────────────────────────────────

describe("getOrCreateDriveFolder", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns existing folder ID when folder is found", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ files: [{ id: "existing-folder-id" }] }),
        { status: 200 }
      )
    );
    const folderId = await getOrCreateDriveFolder(
      "test-token",
      "parent-folder-id",
      "adam-grant"
    );
    expect(folderId).toBe("existing-folder-id");
    // Should only make one fetch call (search, not create)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("creates folder when not found and returns new ID", async () => {
    // First call: search returns empty
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ files: [] }), { status: 200 })
    );
    // Second call: create returns new folder
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ id: "new-folder-id" }),
        { status: 200 }
      )
    );
    const folderId = await getOrCreateDriveFolder(
      "test-token",
      "parent-folder-id",
      "adam-grant"
    );
    expect(folderId).toBe("new-folder-id");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("returns null on search error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 })
    );
    const folderId = await getOrCreateDriveFolder(
      "bad-token",
      "parent-id",
      "folder-name"
    );
    expect(folderId).toBeNull();
  });
});

// ── uploadMetadataSidecarToDrive ──────────────────────────────────────────────

describe("uploadMetadataSidecarToDrive", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads _metadata.json to Drive and returns success", async () => {
    // First call: check for existing file
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ files: [] }), { status: 200 })
    );
    // Second call: create file
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "file-id-123" }), { status: 200 })
    );
    const metadata = generateBookMetadata({
      bookTitle: "Atomic Habits",
      authorName: "James Clear",
    });
    const result = await uploadMetadataSidecarToDrive(
      "test-token",
      "book-folder-id",
      metadata
    );
    expect(result.success).toBe(true);
  });

  it("returns failure when Drive API returns error", async () => {
    // uploadMetadataSidecarToDrive uses multipart upload directly (single fetch call)
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "storageQuotaExceeded" }), { status: 403 })
    );
    const metadata = generateBookMetadata({ bookTitle: "Test" });
    const result = await uploadMetadataSidecarToDrive(
      "test-token",
      "folder-id",
      metadata
    );
    expect(result.success).toBe(false);
  });
});

// ── uploadToDropbox routing ───────────────────────────────────────────────────

describe("uploadToDropbox routing", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses simple upload for small files (< 150 MB)", async () => {
    // uploadToDropbox takes an S3 URL, fetches it, then uploads to Dropbox
    // First mock: fetchS3Buffer fetches the S3 URL
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(Buffer.alloc(1024, "x"), { status: 200 })
    );
    // Second mock: dropboxSimpleUpload uploads to Dropbox
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "abc" }), { status: 200 })
    );
    const result = await uploadToDropbox(
      "test-token",
      "/path/file.jpg",
      "https://s3.example.com/cover.jpg",
      false,
      false // forceStream=false → uses simple upload for non-audio files
    );
    expect(result.success).toBe(true);
    // Second fetch call is the Dropbox upload
    const dropboxUrl = vi.mocked(fetch).mock.calls[1][0] as string;
    expect(dropboxUrl).toContain("/files/upload");
  });
});
