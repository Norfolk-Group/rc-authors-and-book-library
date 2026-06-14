/**
 * Library Import REST Routes
 *
 * Browser-driven bulk import of local library files (PDF / DOC / DOCX / images)
 * to Cloudflare R2. The browser computes a SHA-256 per file, asks the server
 * which already exist, uploads the rest one at a time (multipart), then posts a
 * manifest. All R2 credentials live on the server — the browser never sees a
 * secret. Objects are keyed by content hash (`library-import/<sha256><ext>`) so
 * duplicates collapse automatically and interrupted imports resume cheaply.
 *
 *   POST /api/import/check     { files: [{ sha256, ext }] }      -> { existing: [sha256] }
 *   POST /api/import/upload    multipart: file + sha256 + relPath -> { key, url, skipped }
 *   POST /api/import/finalize  { files: [...] }                  -> { manifestKey, count }
 */

import { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { storagePut, storageGet, storageExists } from "./storage";

const KEY_PREFIX = "library-import";

const DOC_EXTS = [".pdf", ".doc", ".docx"];
const IMG_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff", ".bmp"];
const ALLOWED = new Set<string>(DOC_EXTS.concat(IMG_EXTS));

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".bmp": "image/bmp",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 250 * 1024 * 1024, files: 1 },
});

function extOf(name: string): string {
  return path.extname(name || "").toLowerCase();
}

function sanitizeHash(s: unknown): string | null {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s) ? s : null;
}

export function registerImportRoutes(app: Express): void {
  // Which of the given content hashes are already in R2 (so the browser can skip them)
  app.post("/api/import/check", async (req: Request, res: Response) => {
    const items = req.body?.files;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: "files[] required" });
      return;
    }
    const existing: string[] = [];
    for (const it of items as Array<{ sha256?: string; ext?: string }>) {
      const sha = sanitizeHash(it?.sha256);
      const ext = typeof it?.ext === "string" ? it.ext.toLowerCase() : "";
      if (!sha || !ALLOWED.has(ext)) continue;
      try {
        if (await storageExists(`${KEY_PREFIX}/${sha}${ext}`)) existing.push(sha);
      } catch {
        /* treat head errors as not-existing */
      }
    }
    res.json({ existing });
  });

  // Upload one file (keyed by its content hash)
  app.post("/api/import/upload", upload.single("file"), async (req: Request, res: Response) => {
    const file = req.file;
    const sha = sanitizeHash(req.body?.sha256);
    if (!file) {
      res.status(400).json({ error: "file required" });
      return;
    }
    if (!sha) {
      res.status(400).json({ error: "valid sha256 required" });
      return;
    }
    const ext = extOf(file.originalname);
    if (!ALLOWED.has(ext)) {
      res.json({ skipped: true, reason: "unsupported type", ext });
      return;
    }
    const key = `${KEY_PREFIX}/${sha}${ext}`;
    try {
      if (await storageExists(key)) {
        const { url } = await storageGet(key);
        res.json({ skipped: true, key, url });
        return;
      }
      const contentType = file.mimetype || CONTENT_TYPES[ext] || "application/octet-stream";
      const { url } = await storagePut(key, file.buffer, contentType);
      res.json({ skipped: false, key, url });
    } catch (err) {
      console.error(`[Import] upload failed for ${file.originalname}:`, err);
      res.status(500).json({ error: err instanceof Error ? err.message : "upload failed" });
    }
  });

  // Persist the manifest (file list) to R2 for the server-side match/index step
  app.post("/api/import/finalize", async (req: Request, res: Response) => {
    const files = req.body?.files;
    if (!Array.isArray(files)) {
      res.status(400).json({ error: "files[] required" });
      return;
    }
    const manifest = {
      generatedAt: new Date().toISOString(),
      prefix: KEY_PREFIX,
      count: files.length,
      files,
    };
    const key = `${KEY_PREFIX}/_manifest-${Date.now()}.json`;
    try {
      await storagePut(key, Buffer.from(JSON.stringify(manifest, null, 2)), "application/json");
      res.json({ manifestKey: key, count: files.length });
    } catch (err) {
      console.error("[Import] finalize failed:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "finalize failed" });
    }
  });
}
