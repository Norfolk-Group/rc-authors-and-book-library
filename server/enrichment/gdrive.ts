/**
 * Google Drive Document Archive — Author Document Management
 *
 * Manages document storage and indexing in Google Drive for each author.
 * Uses the gws CLI (pre-configured in sandbox) for Drive operations.
 *
 * Features:
 * - Create per-author document folders in Drive
 * - Upload and index documents (transcripts, papers, chapter samples)
 * - List and search archived documents
 * - Generate document metadata for the app database
 */
import { execSync } from "child_process";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DriveDocument {
  fileId: string;
  name: string;
  mimeType: string;
  size: number | null;
  webViewLink: string;
  webContentLink: string | null;
  createdTime: string;
  modifiedTime: string;
  parentFolderId: string;
}

export interface DocumentArchive {
  authorName: string;
  folderId: string;
  folderUrl: string;
  documents: DriveDocument[];
  totalSize: number;
  documentCount: number;
  lastUpdated: string;
}

export interface ArchiveResult {
  success: boolean;
  document: DriveDocument | null;
  error?: string;
}

// ── GWS CLI Helper ────────────────────────────────────────────────────────────

/**
 * Execute a gws CLI command and return the output.
 */
function runGws(args: string): string {
  try {
    return execSync(`gws ${args}`, {
      timeout: 30000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (err: any) {
    throw new Error(`GWS error: ${err.stderr?.toString() || err.message}`);
  }
}

/**
 * Execute a gws CLI command and parse JSON output.
 */
function runGwsJson(args: string): any {
  const output = runGws(args);
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

// ── Drive Operations ──────────────────────────────────────────────────────────

/**
 * List files in a Google Drive folder.
 */
export async function listDriveFolder(
  folderId: string,
): Promise<DriveDocument[]> {
  try {
    const result = runGwsJson(`drive list --parent "${folderId}" --json`);
    if (!result?.files) return [];

    return result.files.map((f: any) => ({
      fileId: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: f.size ? parseInt(f.size) : null,
      webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
      webContentLink: f.webContentLink || null,
      createdTime: f.createdTime || "",
      modifiedTime: f.modifiedTime || "",
      parentFolderId: folderId,
    }));
  } catch {
    return [];
  }
}

/**
 * Create a folder in Google Drive.
 */
export async function createDriveFolder(
  name: string,
  parentFolderId?: string,
): Promise<string | null> {
  try {
    const parentArg = parentFolderId ? `--parent "${parentFolderId}"` : "";
    const result = runGwsJson(`drive mkdir "${name}" ${parentArg} --json`);
    return result?.id || null;
  } catch {
    return null;
  }
}

/**
 * Upload a file to Google Drive.
 */
export async function uploadToDrive(
  localPath: string,
  parentFolderId: string,
  fileName?: string,
): Promise<ArchiveResult> {
  try {
    const nameArg = fileName ? `--name "${fileName}"` : "";
    const result = runGwsJson(
      `drive upload "${localPath}" --parent "${parentFolderId}" ${nameArg} --json`,
    );

    if (!result?.id) {
      return { success: false, document: null, error: "Upload returned no file ID" };
    }

    return {
      success: true,
      document: {
        fileId: result.id,
        name: result.name || fileName || "Unknown",
        mimeType: result.mimeType || "application/octet-stream",
        size: result.size ? parseInt(result.size) : null,
        webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
        webContentLink: result.webContentLink || null,
        createdTime: result.createdTime || new Date().toISOString(),
        modifiedTime: result.modifiedTime || new Date().toISOString(),
        parentFolderId,
      },
    };
  } catch (err: any) {
    return { success: false, document: null, error: err.message };
  }
}

/**
 * Get or create a document archive folder for an author.
 * Uses the existing Drive folder structure: 02 — Knowledge Library / 01 — Authors / {AuthorName}
 */
export async function getOrCreateAuthorDocFolder(
  authorName: string,
  authorDriveFolderId: string | null,
): Promise<{ folderId: string; folderUrl: string } | null> {
  if (!authorDriveFolderId) return null;

  try {
    // Check if a "Documents" subfolder already exists
    const files = await listDriveFolder(authorDriveFolderId);
    const docsFolder = files.find(
      (f) =>
        f.mimeType === "application/vnd.google-apps.folder" &&
        f.name.toLowerCase().includes("document"),
    );

    if (docsFolder) {
      return {
        folderId: docsFolder.fileId,
        folderUrl: docsFolder.webViewLink,
      };
    }

    // Create a new Documents subfolder
    const newFolderId = await createDriveFolder("Documents", authorDriveFolderId);
    if (!newFolderId) return null;

    return {
      folderId: newFolderId,
      folderUrl: `https://drive.google.com/drive/folders/${newFolderId}`,
    };
  } catch {
    return null;
  }
}

/**
 * Build a document archive index for an author from their Drive folder.
 */
export async function buildDocumentArchive(
  authorName: string,
  driveFolderId: string,
): Promise<DocumentArchive> {
  const allDocs: DriveDocument[] = [];

  // List all files recursively (up to 2 levels deep)
  const topFiles = await listDriveFolder(driveFolderId);

  for (const file of topFiles) {
    if (file.mimeType === "application/vnd.google-apps.folder") {
      // List subfolder contents
      const subFiles = await listDriveFolder(file.fileId);
      allDocs.push(...subFiles.filter((f) => f.mimeType !== "application/vnd.google-apps.folder"));
    } else {
      allDocs.push(file);
    }
  }

  const totalSize = allDocs.reduce((sum, d) => sum + (d.size || 0), 0);
  const lastModified = allDocs.reduce(
    (latest, d) => (d.modifiedTime > latest ? d.modifiedTime : latest),
    "",
  );

  return {
    authorName,
    folderId: driveFolderId,
    folderUrl: `https://drive.google.com/drive/folders/${driveFolderId}`,
    documents: allDocs,
    totalSize,
    documentCount: allDocs.length,
    lastUpdated: lastModified || new Date().toISOString(),
  };
}

/**
 * Health check for Google Drive integration.
 */
export async function checkDriveHealth(): Promise<{
  status: "ok" | "error";
  latencyMs: number;
  message: string;
}> {
  const start = Date.now();
  try {
    const result = execSync("gws drive about 2>&1", {
      timeout: 15000,
      encoding: "utf-8",
    });
    const latency = Date.now() - start;

    if (result.includes("error") || result.includes("Error")) {
      return { status: "error", latencyMs: latency, message: "Google Drive CLI not responding" };
    }

    return { status: "ok", latencyMs: latency, message: "Google Drive connected" };
  } catch (err: any) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      message: err.message || "Google Drive unavailable",
    };
  }
}
