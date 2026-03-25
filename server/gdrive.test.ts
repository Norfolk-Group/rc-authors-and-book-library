/**
 * Vitest tests for Google Drive Document Archive Enrichment Module
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  DriveDocument,
  DocumentArchive,
  ArchiveResult,
} from "./enrichment/gdrive";

// Mock execSync (used for gws CLI calls)
vi.mock("child_process", () => ({
  execSync: vi.fn().mockReturnValue("{}"),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Type Tests ───────────────────────────────────────────────────────────────

describe("Google Drive Document Archive — Types", () => {
  it("DriveDocument has required fields", () => {
    const doc: DriveDocument = {
      fileId: "doc-123",
      name: "Adam Grant - Interview Notes.pdf",
      mimeType: "application/pdf",
      webViewLink: "https://drive.google.com/file/d/doc-123/view",
      webContentLink: null,
      size: 1024000,
      createdTime: "2024-01-01T00:00:00Z",
      modifiedTime: "2024-01-15T10:30:00Z",
      parentFolderId: "folder-456",
    };
    expect(doc.fileId).toBe("doc-123");
    expect(doc.mimeType).toBe("application/pdf");
    expect(doc.size).toBe(1024000);
  });

  it("DocumentArchive has required fields", () => {
    const archive: DocumentArchive = {
      authorName: "Adam Grant",
      folderId: "folder-123",
      folderUrl: "https://drive.google.com/drive/folders/folder-123",
      documents: [],
      totalSize: 0,
      documentCount: 0,
      lastUpdated: new Date().toISOString(),
    };
    expect(archive.authorName).toBe("Adam Grant");
    expect(archive.documentCount).toBe(0);
    expect(archive.totalSize).toBe(0);
  });

  it("ArchiveResult has required fields", () => {
    const result: ArchiveResult = {
      success: true,
      document: null,
      error: undefined,
    };
    expect(result.success).toBe(true);
    expect(result.document).toBeNull();
  });

  it("DocumentArchive with documents", () => {
    const docs: DriveDocument[] = [
      {
        fileId: "doc-1",
        name: "Interview.pdf",
        mimeType: "application/pdf",
        webViewLink: "https://drive.google.com/file/d/doc-1/view",
        webContentLink: null,
        size: 500000,
        createdTime: "2024-01-01T00:00:00Z",
        modifiedTime: "2024-01-15T10:30:00Z",
        parentFolderId: "folder-1",
      },
      {
        fileId: "doc-2",
        name: "Presentation.pptx",
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        webViewLink: "https://drive.google.com/file/d/doc-2/view",
        webContentLink: null,
        size: 2000000,
        createdTime: "2024-02-01T00:00:00Z",
        modifiedTime: "2024-02-15T10:30:00Z",
        parentFolderId: "folder-1",
      },
    ];

    const archive: DocumentArchive = {
      authorName: "Adam Grant",
      folderId: "folder-1",
      folderUrl: "https://drive.google.com/drive/folders/folder-1",
      documents: docs,
      totalSize: 2500000,
      documentCount: 2,
      lastUpdated: new Date().toISOString(),
    };
    expect(archive.documentCount).toBe(2);
    expect(archive.totalSize).toBe(2500000);
    expect(archive.documents.length).toBe(2);
  });
});

// ── listDriveFolder Tests ────────────────────────────────────────────────────

describe("Google Drive Document Archive — listDriveFolder", () => {
  it("returns documents from a Drive folder", async () => {
    const { execSync } = await import("child_process");
    const mockExecSync = vi.mocked(execSync);

    // Mock gws CLI output
    mockExecSync.mockReturnValueOnce(
      Buffer.from(JSON.stringify([
        {
          id: "doc-1",
          name: "Notes.pdf",
          mimeType: "application/pdf",
          webViewLink: "https://drive.google.com/file/d/doc-1/view",
          size: 500000,
          createdTime: "2024-01-01T00:00:00Z",
          modifiedTime: "2024-01-15T10:30:00Z",
        },
      ]))
    );

    const { listDriveFolder } = await import("./enrichment/gdrive");
    const result = await listDriveFolder("folder-123");
    expect(result).toBeDefined();
  });

  it("handles errors gracefully", async () => {
    const { execSync } = await import("child_process");
    const mockExecSync = vi.mocked(execSync);

    mockExecSync.mockImplementationOnce(() => {
      throw new Error("Drive API error");
    });

    const { listDriveFolder } = await import("./enrichment/gdrive");
    const result = await listDriveFolder("bad-folder");
    expect(result).toEqual([]);
  });
});

// ── buildDocumentArchive Tests ───────────────────────────────────────────────

describe("Google Drive Document Archive — buildDocumentArchive", () => {
  it("returns archive result for an author folder", async () => {
    const { execSync } = await import("child_process");
    const mockExecSync = vi.mocked(execSync);

    // Mock file listing
    mockExecSync.mockReturnValueOnce(
      Buffer.from(JSON.stringify([
        {
          id: "doc-1",
          name: "Interview.pdf",
          mimeType: "application/pdf",
          webViewLink: "https://drive.google.com/file/d/doc-1/view",
          size: 500000,
          createdTime: "2024-01-01T00:00:00Z",
          modifiedTime: "2024-01-15T10:30:00Z",
        },
      ]))
    );

    const { buildDocumentArchive } = await import("./enrichment/gdrive");
    const result = await buildDocumentArchive("Adam Grant", "folder-123");
    expect(result.authorName).toBe("Adam Grant");
    expect(result.folderId).toBe("folder-123");
    expect(result.lastUpdated).toBeTruthy();
  });
});

// ── checkDriveHealth Tests ───────────────────────────────────────────────────

describe("Google Drive Document Archive — checkDriveHealth", () => {
  it("returns health check result", async () => {
    const { execSync } = await import("child_process");
    const mockExecSync = vi.mocked(execSync);

    mockExecSync.mockReturnValueOnce(
      Buffer.from("root")
    );

    const { checkDriveHealth } = await import("./enrichment/gdrive");
    const result = await checkDriveHealth();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("latencyMs");
  });

  it("returns error status when Drive is unavailable", async () => {
    const { execSync } = await import("child_process");
    const mockExecSync = vi.mocked(execSync);

    mockExecSync.mockImplementationOnce(() => {
      throw new Error("Drive not configured");
    });

    const { checkDriveHealth } = await import("./enrichment/gdrive");
    const result = await checkDriveHealth();
    expect(result.status).toBe("error");
  });
});
