/**
 * Library Import REST Routes
 *
 * Browser-driven bulk import of local library files (PDF / DOCX / images) to
 * Cloudflare R2. The browser computes a SHA-256 per file, asks the server which
 * already exist, uploads the rest one at a time (multipart), then posts a
 * manifest. All R2 credentials live on the server — the browser never sees a
 * secret. Objects are keyed by content hash (`library-import/<sha256><ext>`) so
 * duplicates collapse automatically and interrupted imports resume cheaply.
 *
 * All three endpoints require an authenticated admin session.
 *
 *   POST /api/import/check     { files: [{ sha256, ext }] }      -> { existing: [sha256] }
 *   POST /api/import/upload    multipart: file + sha256 + relPath -> { key, url, skipped }
 *   POST /api/import/finalize  { files: [...] }                  -> { manifestKey, count }
 */

import { createHash } from "node:crypto";
import { promises as fsp } from "node:fs";
import os from "node:os";
import { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import path from "path";
import type { User } from "../drizzle/schema";
import { logger } from "./lib/logger";
import { parallelBatch } from "./lib/parallelBatch";
import { storagePut, storageGet, storageExists } from "./storage";
import { sdk } from "./_core/sdk";
import { resolveCfAccessOwner } from "./lib/cfAccess";

const KEY_PREFIX = "library-import";

// Legacy ".doc" is intentionally excluded: the indexer (mammoth) only parses
// ".docx", so accepting ".doc" here would upload files that can never be indexed.
const DOC_EXTS = [".pdf", ".docx"];
const IMG_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff", ".bmp"];
const ALLOWED = new Set<string>(DOC_EXTS.concat(IMG_EXTS));

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
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

// Disk-backed upload buffer: keeps large files off the Node heap (memoryStorage
// would hold each concurrent 250 MB upload fully resident in memory).
const upload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir() }),
  limits: { fileSize: 250 * 1024 * 1024, files: 1 },
});

// Rate-limit every import endpoint (defense-in-depth + satisfies static analysis).
// The ceiling is generous so a legitimate bulk import of hundreds of files isn't
// blocked; the in-memory store is fine for the single-instance deploy.
const importLimiter = rateLimit({
  windowMs: 60_000,
  limit: 2000,
  standardHeaders: true,
  legacyHeaders: false,
});

function extOf(name: string): string {
  return path.extname(name || "").toLowerCase();
}

function sanitizeHash(s: unknown): string | null {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s) ? s : null;
}

// Reuse the same session resolution the tRPC context uses (Manus SDK + CF Access
// fallback), then require an admin role. These routes upload to R2 and write
// manifests, so they must never be open to anonymous callers.
async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  let user: User | null = null;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    user = null;
  }
  if (!user) {
    try {
      user = await resolveCfAccessOwner(req);
    } catch {
      user = null;
    }
  }
  if (!user) {
    res.status(401).json({ error: "authentication required" });
    return;
  }
  if (user.role !== "admin") {
    res.status(403).json({ error: "admin role required" });
    return;
  }
  next();
}

export function registerImportRoutes(app: Express): void {
  // Which of the given content hashes are already in R2 (so the browser can skip them)
  app.post("/api/import/check", importLimiter, requireAdmin, async (req: Request, res: Response) => {
    const items = req.body?.files;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: "files[] required" });
      return;
    }
    const candidates = (items as Array<{ sha256?: string; ext?: string }>).flatMap((it) => {
      const sha = sanitizeHash(it?.sha256);
      const ext = typeof it?.ext === "string" ? it.ext.toLowerCase() : "";
      return sha && ALLOWED.has(ext) ? [{ sha, ext }] : [];
    });
    const summary = await parallelBatch(candidates, 5, async ({ sha, ext }) => {
      try {
        return (await storageExists(`${KEY_PREFIX}/${sha}${ext}`)) ? sha : null;
      } catch {
        return null; // treat head errors as not-existing
      }
    });
    const existing = summary.results
      .map((r) => r.result ?? null)
      .filter((sha): sha is string => Boolean(sha));
    res.json({ existing });
  });

  // Upload one file (keyed by its content hash)
  app.post(
    "/api/import/upload",
    importLimiter,
    requireAdmin,
    upload.single("file"),
    async (req: Request, res: Response) => {
      const file = req.file;
      const sha = sanitizeHash(req.body?.sha256);
      try {
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
        // Re-derive the temp path from a sanitized basename + fixed root so the fs
        // read never uses raw request-derived path data.
        const tmpPath = path.join(os.tmpdir(), path.basename(file.path));
        const buf = await fsp.readFile(tmpPath);
        // Never trust the client's hash for the storage key — recompute and reject
        // mismatches so a buggy/malicious client can't poison dedupe.
        const actualSha = createHash("sha256").update(buf).digest("hex");
        if (actualSha !== sha) {
          res.status(400).json({ error: "sha256 mismatch" });
          return;
        }
        const key = `${KEY_PREFIX}/${sha}${ext}`;
        if (await storageExists(key)) {
          const { url } = await storageGet(key);
          res.json({ skipped: true, key, url });
          return;
        }
        // Server-validated content type, not the client-supplied mimetype.
        const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
        const { url } = await storagePut(key, buf, contentType);
        res.json({ skipped: false, key, url });
      } catch (err) {
        logger.error("[Import] upload failed", err);
        res.status(500).json({ error: err instanceof Error ? err.message : "upload failed" });
      } finally {
        if (file?.path) {
          await fsp.unlink(path.join(os.tmpdir(), path.basename(file.path))).catch(() => {});
        }
      }
    }
  );

  // Persist the manifest (file list) to R2 for the server-side match/index step
  app.post("/api/import/finalize", importLimiter, requireAdmin, async (req: Request, res: Response) => {
    const files = req.body?.files;
    if (!Array.isArray(files)) {
      res.status(400).json({ error: "files[] required" });
      return;
    }
    // Normalize + validate every entry to the { sha256, ext, key, ... } contract so
    // downstream match/index jobs never receive malformed hashes or stray keys.
    const validated = (files as Array<Record<string, unknown>>).flatMap((f) => {
      const sha = sanitizeHash(f?.sha256);
      const ext = typeof f?.ext === "string" ? f.ext.toLowerCase() : "";
      if (!sha || !ALLOWED.has(ext)) return [];
      return [
        {
          sha256: sha,
          ext,
          key: `${KEY_PREFIX}/${sha}${ext}`,
          originalFilename:
            typeof f?.originalFilename === "string" ? f.originalFilename.slice(0, 512) : "",
          relPath: typeof f?.relPath === "string" ? f.relPath.slice(0, 1024) : "",
          sizeBytes: typeof f?.sizeBytes === "number" && f.sizeBytes >= 0 ? f.sizeBytes : 0,
        },
      ];
    });
    if (validated.length === 0) {
      res.status(400).json({ error: "no valid manifest entries" });
      return;
    }
    const manifest = {
      generatedAt: new Date().toISOString(),
      prefix: KEY_PREFIX,
      count: validated.length,
      files: validated,
    };
    const key = `${KEY_PREFIX}/_manifest-${Date.now()}.json`;
    try {
      await storagePut(key, Buffer.from(JSON.stringify(manifest, null, 2)), "application/json");
      res.json({ manifestKey: key, count: validated.length });
    } catch (err) {
      logger.error("[Import] finalize failed", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "finalize failed" });
    }
  });
}
