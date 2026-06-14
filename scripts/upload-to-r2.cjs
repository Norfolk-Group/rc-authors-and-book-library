#!/usr/bin/env node
/**
 * upload-to-r2.cjs  —  uploads local library files to Cloudflare R2
 *
 * Walks D:\Authors_and_Books, keeps PDF / DOC / DOCX / image files (skips
 * audio, video, EPUB), de-duplicates by SHA-256, and uploads each UNIQUE file
 * to R2 under `library-import/<sha256><ext>`. Writes a manifest mapping each
 * uploaded object back to its original filename(s) so the server-side step can
 * match files to books, identify cryptic scans, parse, and vector-index.
 *
 * It does NOT touch the database. The only decision it makes is "upload this
 * file or not" — all book-matching happens server-side later.
 *
 * Safe to re-run: it checks R2 first (HeadObject) and skips objects that already
 * exist, so an interrupted run resumes cleanly.
 *
 * ── Setup (Windows PowerShell, once) ─────────────────────────────────────────
 *   npm install @aws-sdk/client-s3        (installs next to the mysql2 you added)
 *
 * ── Run ──────────────────────────────────────────────────────────────────────
 *   # 1. Set the 5 R2 vars (copy values from Railway -> Variables):
 *   $env:R2_ACCOUNT_ID       = '...'
 *   $env:R2_ACCESS_KEY_ID    = '...'
 *   $env:R2_SECRET_ACCESS_KEY= '...'
 *   $env:R2_BUCKET           = '...'
 *   $env:R2_PUBLIC_URL       = 'https://...'      # r2.dev URL or custom domain
 *
 *   # 2. DRY RUN first (uploads nothing, just shows the plan):
 *   node scripts/upload-to-r2.cjs
 *
 *   # 3. When the plan looks right, actually upload:
 *   node scripts/upload-to-r2.cjs --commit
 *
 *   # custom folder:
 *   node scripts/upload-to-r2.cjs "D:\some\folder" --commit
 *
 * Secrets are read from the environment only — never printed, never committed.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");

const DEFAULT_ROOT = "D:\\Authors_and_Books";
const KEY_PREFIX = "library-import";

const DOC_EXTS = new Set([".pdf", ".doc", ".docx"]);
const IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff", ".bmp"]);

const CONTENT_TYPES = {
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

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.warn(`  (skipped unreadable dir: ${dir} — ${e.message})`);
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.isFile()) out.push(full);
  }
}

function getR2() {
  const need = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"];
  const missing = need.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`\nERROR: missing R2 env vars: ${missing.join(", ")}\nSet them in PowerShell (see header of this script), then re-run.\n`);
    process.exit(1);
  }
  // Catch the common mistake of pasting the example placeholders ('...') instead
  // of the real values — otherwise the endpoint becomes "....r2.cloudflarestorage.com".
  const placeholder = need.filter((k) => /\.\.\.|^<.*>$/.test(process.env[k]));
  if (placeholder.length) {
    console.error(`\nERROR: these R2 vars still hold placeholder text, not real values: ${placeholder.join(", ")}\nOpen Railway → Variables, click each value to reveal it, and paste the ACTUAL value (not the '...' from the example).\n`);
    process.exit(1);
  }
  if (!/^https?:\/\//.test(process.env.R2_PUBLIC_URL)) {
    console.error(`\nERROR: R2_PUBLIC_URL must start with https:// (got "${process.env.R2_PUBLIC_URL}").\n`);
    process.exit(1);
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return {
    client,
    bucket: process.env.R2_BUCKET,
    publicBase: process.env.R2_PUBLIC_URL.replace(/\/+$/, ""),
  };
}

async function objectExists(r2, key) {
  try {
    await r2.client.send(new HeadObjectCommand({ Bucket: r2.bucket, Key: key }));
    return true;
  } catch (e) {
    if (e.$metadata && e.$metadata.httpStatusCode === 404) return false;
    if (e.name === "NotFound" || e.name === "NoSuchKey") return false;
    throw e;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const root = args.find((a) => !a.startsWith("--")) || process.env.SCAN_DIR || DEFAULT_ROOT;

  console.log(`\n===== UPLOAD LOCAL FILES TO R2 ${commit ? "(COMMIT)" : "(DRY RUN)"} =====`);
  console.log(`Root: ${root}\n`);

  if (!fs.existsSync(root)) {
    console.error(`ERROR: folder not found: ${root}`);
    process.exit(1);
  }

  // Collect + filter
  const all = [];
  walk(root, all);
  const keep = all.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return DOC_EXTS.has(ext) || IMG_EXTS.has(ext);
  });

  // De-dup by SHA-256
  const byHash = new Map(); // sha256 -> { ext, size, files: [relPaths] }
  let totalBytes = 0;
  for (const f of keep) {
    const ext = path.extname(f).toLowerCase();
    const buf = fs.readFileSync(f);
    const sha = crypto.createHash("sha256").update(buf).digest("hex");
    const rel = path.relative(root, f);
    if (!byHash.has(sha)) {
      byHash.set(sha, { ext, size: buf.length, files: [rel], _buf: buf });
      totalBytes += buf.length;
    } else {
      byHash.get(sha).files.push(rel);
    }
  }

  console.log(`Files kept (pdf/doc/docx/image) .. ${keep.length}`);
  console.log(`Unique files (by hash) ........... ${byHash.size}  (${fmtBytes(totalBytes)})`);
  console.log(`Duplicate files collapsed ........ ${keep.length - byHash.size}\n`);

  const manifest = [];
  for (const [sha, info] of byHash) {
    const key = `${KEY_PREFIX}/${sha}${info.ext}`;
    manifest.push({
      sha256: sha,
      key,
      contentType: CONTENT_TYPES[info.ext] || "application/octet-stream",
      ext: info.ext,
      sizeBytes: info.size,
      originalFilename: path.basename(info.files[0]),
      sourcePaths: info.files, // all local paths that share this hash
    });
  }

  if (!commit) {
    console.log(`DRY RUN — would upload ${manifest.length} objects (${fmtBytes(totalBytes)}) to bucket "${process.env.R2_BUCKET || "<R2_BUCKET>"}" under "${KEY_PREFIX}/".`);
    console.log(`Sample:`);
    manifest.slice(0, 8).forEach((m) => console.log(`  ${m.key}   ←  ${m.originalFilename} (${fmtBytes(m.sizeBytes)})`));
    if (manifest.length > 8) console.log(`  ...and ${manifest.length - 8} more`);
    console.log(`\nRe-run with --commit to upload.\n`);
    // Save the planned manifest locally for review
    fs.writeFileSync("r2-upload-manifest.json", JSON.stringify({ root, prefix: KEY_PREFIX, files: manifest }, null, 2));
    console.log(`Planned manifest written to r2-upload-manifest.json\n`);
    return;
  }

  // COMMIT: upload each unique object (skip if already present)
  const r2 = getR2();
  let uploaded = 0;
  let skipped = 0;
  let i = 0;
  let consecutiveFails = 0;
  for (const [sha, info] of byHash) {
    i++;
    const entry = manifest.find((m) => m.sha256 === sha);
    const key = entry.key;
    try {
      if (await objectExists(r2, key)) {
        skipped++;
      } else {
        await r2.client.send(
          new PutObjectCommand({
            Bucket: r2.bucket,
            Key: key,
            Body: info._buf,
            ContentType: entry.contentType,
          })
        );
        uploaded++;
      }
      entry.url = `${r2.publicBase}/${key}`;
      consecutiveFails = 0;
    } catch (e) {
      console.error(`  ✗ failed ${key} (${entry.originalFilename}): ${e.message}`);
      entry.error = e.message;
      consecutiveFails++;
      if (consecutiveFails >= 3) {
        console.error(`\nAborting after ${consecutiveFails} uploads failed in a row (${e.message}).\nMost likely the R2 credentials or endpoint are wrong — re-check the 5 R2_* values (especially R2_ACCOUNT_ID) and re-run.\n`);
        process.exit(1);
      }
    }
    if (i % 25 === 0 || i === byHash.size) {
      console.log(`  [${i}/${byHash.size}] uploaded=${uploaded} skipped=${skipped}`);
    }
  }

  // Write + upload the manifest
  const manifestDoc = {
    generatedAt: new Date().toISOString(),
    root,
    prefix: KEY_PREFIX,
    counts: { unique: byHash.size, uploaded, skipped },
    files: manifest.map(({ _buf, ...m }) => m),
  };
  const manifestJson = JSON.stringify(manifestDoc, null, 2);
  fs.writeFileSync("r2-upload-manifest.json", manifestJson);

  const manifestKey = `${KEY_PREFIX}/_manifest-${Date.now()}.json`;
  try {
    await r2.client.send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: manifestKey,
        Body: Buffer.from(manifestJson),
        ContentType: "application/json",
      })
    );
    console.log(`\nManifest uploaded: ${r2.publicBase}/${manifestKey}`);
  } catch (e) {
    console.warn(`\nManifest upload failed (${e.message}) — local copy saved as r2-upload-manifest.json`);
  }

  console.log(`\n===== DONE: uploaded ${uploaded}, skipped ${skipped} (already present), ${byHash.size} unique total =====`);
  console.log(`Local manifest: r2-upload-manifest.json`);
  console.log(`Tell the assistant the manifest key (${manifestKey}) to run the server-side match + index step.\n`);
}

main().catch((err) => {
  console.error("Upload failed:", err.message);
  process.exit(1);
});
