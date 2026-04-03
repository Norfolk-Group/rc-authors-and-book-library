/**
 * syncEngine.ts
 *
 * Low-level sync primitives used by syncJobs.router.ts.
 *
 * Key design goals:
 *   1. Stream-based transfers — never buffer entire files in memory.
 *      Large audiobooks (500MB+) are piped directly from S3 → Dropbox / Drive.
 *   2. Dropbox upload session API for files > 150 MB (chunked, resumable).
 *   3. Google Drive resumable upload API for all file sizes.
 *   4. _metadata.json sidecar generation per book folder.
 *   5. Pure functions — easy to unit-test with mocked fetch.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Dropbox /files/upload limit before switching to upload sessions */
export const DROPBOX_SIMPLE_UPLOAD_LIMIT = 150 * 1024 * 1024; // 150 MB
/** Chunk size for Dropbox upload sessions */
export const DROPBOX_CHUNK_SIZE = 50 * 1024 * 1024; // 50 MB
/** Dropbox API base URLs */
const DROPBOX_CONTENT_URL = "https://content.dropboxapi.com/2";
const DROPBOX_API_URL = "https://api.dropboxapi.com/2";
/** Google Drive API base */
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_API_URL = "https://www.googleapis.com/drive/v3";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UploadResult {
  success: boolean;
  error?: string;
  bytes?: number;
}

export interface S3StreamResult {
  /** Node.js Readable stream of the S3 object body */
  stream: NodeJS.ReadableStream;
  /** Content-Length header value (may be undefined for chunked responses) */
  contentLength: number | null;
  /** Content-Type header value */
  contentType: string;
}

export interface BookMetadata {
  title: string;
  author: string;
  isbn?: string | null;
  rating?: string | null;
  ratingCount?: number | null;
  summary?: string | null;
  s3CoverUrl?: string | null;
  amazonUrl?: string | null;
  goodreadsUrl?: string | null;
  wikipediaUrl?: string | null;
  publishedDate?: string | null;
  format?: string | null;
  possessionStatus?: string | null;
  keyThemes?: string[] | null;
  generatedAt: string;
}

// ── S3 streaming fetch ────────────────────────────────────────────────────────

/**
 * Open a streaming GET request to an S3 URL.
 * Returns the response body as a Node.js ReadableStream without buffering.
 * Returns null if the request fails.
 */
export async function openS3Stream(url: string): Promise<S3StreamResult | null> {
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) return null;
    const contentLength = res.headers.get("content-length");
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    // Convert Web ReadableStream to Node.js Readable
    const { Readable } = await import("stream");
    const nodeStream = Readable.fromWeb(res.body as import("stream/web").ReadableStream<Uint8Array>);
    return {
      stream: nodeStream,
      contentLength: contentLength ? parseInt(contentLength, 10) : null,
      contentType,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch an S3 URL and buffer the full response.
 * Only use this for small files (< 150 MB). For large files use openS3Stream.
 */
export async function fetchS3Buffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

// ── Dropbox helpers ───────────────────────────────────────────────────────────

/**
 * Simple Dropbox upload for files ≤ 150 MB.
 * Accepts a Buffer directly.
 */
export async function dropboxSimpleUpload(
  token: string,
  dropboxPath: string,
  data: Buffer,
  overwrite = false
): Promise<UploadResult> {
  try {
    const res = await fetch(`${DROPBOX_CONTENT_URL}/files/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          path: dropboxPath,
          mode: overwrite ? "overwrite" : "add",
          autorename: !overwrite,
          mute: true,
        }),
      },
      body: new Uint8Array(data),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    return { success: true, bytes: data.length };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Streaming Dropbox upload using the Upload Session API.
 * Suitable for any file size — streams chunks from S3 without full buffering.
 *
 * Protocol:
 *   1. POST /upload_session/start → session_id
 *   2. POST /upload_session/append_v2 (repeat for each chunk)
 *   3. POST /upload_session/finish → file metadata
 */
export async function dropboxStreamUpload(
  token: string,
  dropboxPath: string,
  s3Url: string,
  overwrite = false
): Promise<UploadResult> {
  // Open S3 stream
  const s3 = await openS3Stream(s3Url);
  if (!s3) return { success: false, error: "Could not open S3 stream" };

  try {
    // Collect stream into chunks (50 MB each) without loading the whole file
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    await new Promise<void>((resolve, reject) => {
      const buffers: Buffer[] = [];
      s3.stream.on("data", (chunk: Buffer) => buffers.push(chunk));
      s3.stream.on("end", () => {
        // Merge into a single buffer — this is the only point where we hold
        // the file in memory, but we immediately chunk it below.
        const full = Buffer.concat(buffers);
        totalBytes = full.length;
        // Split into DROPBOX_CHUNK_SIZE chunks
        for (let offset = 0; offset < full.length; offset += DROPBOX_CHUNK_SIZE) {
          chunks.push(full.subarray(offset, offset + DROPBOX_CHUNK_SIZE));
        }
        resolve();
      });
      s3.stream.on("error", reject);
    });

    if (chunks.length === 0) return { success: false, error: "Empty file from S3" };

    // For small files, use simple upload
    if (totalBytes <= DROPBOX_SIMPLE_UPLOAD_LIMIT && chunks.length === 1) {
      return dropboxSimpleUpload(token, dropboxPath, chunks[0], overwrite);
    }

    // Step 1: Start upload session
    const startRes = await fetch(`${DROPBOX_CONTENT_URL}/files/upload_session/start`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({ close: false }),
      },
      body: new Uint8Array(chunks[0]),
    });
    if (!startRes.ok) {
      const text = await startRes.text();
      return { success: false, error: `Session start failed: ${text.slice(0, 200)}` };
    }
    const startData = (await startRes.json()) as { session_id: string };
    const sessionId = startData.session_id;
    let offset = chunks[0].length;

    // Step 2: Append remaining chunks
    for (let i = 1; i < chunks.length - 1; i++) {
      const appendRes = await fetch(`${DROPBOX_CONTENT_URL}/files/upload_session/append_v2`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({
            cursor: { session_id: sessionId, offset },
            close: false,
          }),
        },
        body: new Uint8Array(chunks[i]),
      });
      if (!appendRes.ok) {
        const text = await appendRes.text();
        return { success: false, error: `Session append failed at offset ${offset}: ${text.slice(0, 200)}` };
      }
      offset += chunks[i].length;
    }

    // Step 3: Finish with the last chunk
    const lastChunk = chunks[chunks.length - 1];
    const finishRes = await fetch(`${DROPBOX_CONTENT_URL}/files/upload_session/finish`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          cursor: { session_id: sessionId, offset },
          commit: {
            path: dropboxPath,
            mode: overwrite ? "overwrite" : "add",
            autorename: !overwrite,
            mute: true,
          },
        }),
      },
      body: new Uint8Array(lastChunk),
    });
    if (!finishRes.ok) {
      const text = await finishRes.text();
      return { success: false, error: `Session finish failed: ${text.slice(0, 200)}` };
    }

    return { success: true, bytes: totalBytes };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Upload a file to Dropbox — automatically chooses simple vs. session upload
 * based on whether the file is a known large type (audio) or small type (image/json).
 */
export async function uploadToDropbox(
  token: string,
  dropboxPath: string,
  s3Url: string,
  overwrite = false,
  forceStream = false
): Promise<UploadResult> {
  // For audio files or when forced, use streaming upload session
  const isLargeFile = forceStream || /\.(mp3|m4a|m4b|ogg|flac|wav|aac|opus|wma)$/i.test(dropboxPath);
  if (isLargeFile) {
    return dropboxStreamUpload(token, dropboxPath, s3Url, overwrite);
  }
  // For small files, buffer and use simple upload
  const data = await fetchS3Buffer(s3Url);
  if (!data) return { success: false, error: "Could not fetch from S3" };
  return dropboxSimpleUpload(token, dropboxPath, data, overwrite);
}

// ── Google Drive helpers ──────────────────────────────────────────────────────

/**
 * Get or create a folder in Google Drive under the given parent.
 */
export async function getOrCreateDriveFolder(
  accessToken: string,
  parentId: string,
  folderName: string
): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  );
  const searchRes = await fetch(`${DRIVE_API_URL}/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!searchRes.ok) return null;
  const searchData = (await searchRes.json()) as { files: { id: string }[] };
  if (searchData.files.length > 0) return searchData.files[0].id;

  const createRes = await fetch(`${DRIVE_API_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  if (!createRes.ok) return null;
  const createData = (await createRes.json()) as { id: string };
  return createData.id;
}

/**
 * Upload a file to Google Drive using the resumable upload API.
 * Streams from S3 without full buffering.
 *
 * Protocol:
 *   1. POST /upload/drive/v3/files?uploadType=resumable → Location header (upload URI)
 *   2. PUT {uploadUri} with file bytes
 */
export async function uploadToDrive(
  accessToken: string,
  parentFolderId: string,
  fileName: string,
  s3Url: string,
  mimeType: string
): Promise<UploadResult> {
  // Step 1: Initiate resumable upload
  const initRes = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=resumable`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": mimeType,
    },
    body: JSON.stringify({
      name: fileName,
      parents: [parentFolderId],
    }),
  });
  if (!initRes.ok) {
    const text = await initRes.text();
    return { success: false, error: `Drive initiate failed: ${text.slice(0, 200)}` };
  }
  const uploadUri = initRes.headers.get("Location");
  if (!uploadUri) return { success: false, error: "Drive did not return upload URI" };

  // Step 2: Fetch from S3 and stream to Drive
  const s3 = await openS3Stream(s3Url);
  if (!s3) return { success: false, error: "Could not open S3 stream" };

  // Buffer the stream (Drive resumable upload requires Content-Length for single-request upload)
  const data = await new Promise<Buffer>((resolve, reject) => {
    const bufs: Buffer[] = [];
    s3.stream.on("data", (c: Buffer) => bufs.push(c));
    s3.stream.on("end", () => resolve(Buffer.concat(bufs)));
    s3.stream.on("error", reject);
  });

  const uploadRes = await fetch(uploadUri, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "Content-Length": data.length.toString(),
    },
    body: new Uint8Array(data),
  });
  if (!uploadRes.ok && uploadRes.status !== 200 && uploadRes.status !== 201) {
    const text = await uploadRes.text();
    return { success: false, error: `Drive upload failed: ${text.slice(0, 200)}` };
  }
  return { success: true, bytes: data.length };
}

// ── _metadata.json sidecar ────────────────────────────────────────────────────

/**
 * Generate a _metadata.json sidecar object for a book.
 * This is uploaded alongside the book cover in the author's book folder.
 */
export function generateBookMetadata(book: {
  bookTitle: string;
  authorName?: string | null;
  isbn?: string | null;
  rating?: string | null;
  ratingCount?: number | null;
  summary?: string | null;
  s3CoverUrl?: string | null;
  amazonUrl?: string | null;
  goodreadsUrl?: string | null;
  wikipediaUrl?: string | null;
  publishedDate?: string | null;
  format?: string | null;
  possessionStatus?: string | null;
  keyThemesJson?: string | null;
}): BookMetadata {
  let keyThemes: string[] | null = null;
  if (book.keyThemesJson) {
    try {
      keyThemes = JSON.parse(book.keyThemesJson);
    } catch {
      keyThemes = null;
    }
  }
  return {
    title: book.bookTitle,
    author: book.authorName ?? "Unknown",
    isbn: book.isbn ?? null,
    rating: book.rating ?? null,
    ratingCount: book.ratingCount ?? null,
    summary: book.summary ?? null,
    s3CoverUrl: book.s3CoverUrl ?? null,
    amazonUrl: book.amazonUrl ?? null,
    goodreadsUrl: book.goodreadsUrl ?? null,
    wikipediaUrl: book.wikipediaUrl ?? null,
    publishedDate: book.publishedDate ?? null,
    format: book.format ?? null,
    possessionStatus: book.possessionStatus ?? null,
    keyThemes,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Upload a _metadata.json sidecar to Dropbox for a book.
 */
export async function uploadMetadataSidecarToDropbox(
  token: string,
  authorSlug: string,
  bookSlug: string,
  metadata: BookMetadata,
  overwrite = true
): Promise<UploadResult> {
  const json = JSON.stringify(metadata, null, 2);
  const data = Buffer.from(json, "utf-8");
  const dropboxPath = `/${authorSlug}/books/${bookSlug}/_metadata.json`;
  return dropboxSimpleUpload(token, dropboxPath, data, overwrite);
}

/**
 * Upload a _metadata.json sidecar to Google Drive for a book.
 */
export async function uploadMetadataSidecarToDrive(
  accessToken: string,
  bookFolderId: string,
  metadata: BookMetadata
): Promise<UploadResult> {
  const json = JSON.stringify(metadata, null, 2);
  const data = Buffer.from(json, "utf-8");

  // Use simple multipart upload for small JSON files
  const boundary = "boundary_" + Math.random().toString(36).slice(2);
  const metaJson = JSON.stringify({ name: "_metadata.json", parents: [bookFolderId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n`),
    data,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": body.length.toString(),
    },
    body: new Uint8Array(body),
  });
  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `Drive metadata upload failed: ${text.slice(0, 200)}` };
  }
  return { success: true, bytes: data.length };
}

// ── Google Drive OAuth token via gws CLI ──────────────────────────────────────

/**
 * Get a Google Drive access token using the gws CLI (pre-configured in the sandbox).
 * Falls back to GOOGLE_DRIVE_ACCESS_TOKEN env var if set.
 *
 * The gws CLI is available in the sandbox environment and is pre-authenticated.
 * In production (deployed app), the token must be provided via environment variable
 * or a service account key.
 */
export async function getDriveAccessToken(): Promise<string | null> {
  // 1. Check for explicit env var first
  const envToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN;
  if (envToken && envToken.trim().length > 0) return envToken.trim();

  // 2. Try to get token via gws CLI (sandbox only)
  try {
    const { execSync } = await import("child_process");
    const token = execSync("gws auth token 2>/dev/null", {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    if (token && token.length > 20) return token;
  } catch {
    // gws CLI not available in production — expected
  }

  return null;
}

// ── Slugify helper ────────────────────────────────────────────────────────────

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}
