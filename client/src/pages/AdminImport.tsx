import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// File types we import (matches the server allow-list). Audio/video/epub skipped.
const DOC_EXTS = [".pdf", ".doc", ".docx"];
const IMG_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff", ".bmp"];
const ALLOWED = new Set([...DOC_EXTS, ...IMG_EXTS]);

const UPLOAD_CONCURRENCY = 4;

type Phase = "idle" | "hashing" | "checking" | "uploading" | "done" | "error";

type Entry = {
  file: File;
  sha256: string;
  ext: string;
  relPath: string;
  sizeBytes: number;
  key: string;
};

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function AdminImport() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [total, setTotal] = useState(0);
  const [hashed, setHashed] = useState(0);
  const [uploaded, setUploaded] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [manifestKey, setManifestKey] = useState<string | null>(null);
  const [totalBytes, setTotalBytes] = useState(0);
  const [fatal, setFatal] = useState<string | null>(null);

  // Enable folder selection on the hidden input (non-standard attributes).
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.setAttribute("webkitdirectory", "");
      inputRef.current.setAttribute("directory", "");
    }
  }, []);

  const run = useCallback(async (fileList: FileList) => {
    setFatal(null);
    setErrors([]);
    setManifestKey(null);
    setUploaded(0);
    setSkipped(0);
    setHashed(0);

    // 1. Filter to allowed types
    const picked = Array.from(fileList).filter((f) => ALLOWED.has(extOf(f.name)));
    if (picked.length === 0) {
      setFatal("No PDF, DOC, DOCX, or image files found in that folder.");
      setPhase("error");
      return;
    }
    setTotal(picked.length);
    setTotalBytes(picked.reduce((s, f) => s + f.size, 0));

    // 2. Hash each file (dedupe by content hash)
    setPhase("hashing");
    const byHash = new Map<string, Entry>();
    let done = 0;
    for (const file of picked) {
      try {
        const buf = await file.arrayBuffer();
        const sha = await sha256Hex(buf);
        const ext = extOf(file.name);
        if (!byHash.has(sha)) {
          byHash.set(sha, {
            file,
            sha256: sha,
            ext,
            relPath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
            sizeBytes: file.size,
            key: `library-import/${sha}${ext}`,
          });
        }
      } catch (e) {
        setErrors((prev) => [...prev, `hash failed: ${file.name} — ${(e as Error).message}`]);
      }
      done++;
      setHashed(done);
    }
    const entries = Array.from(byHash.values());

    // 3. Ask the server which already exist
    setPhase("checking");
    let existing = new Set<string>();
    try {
      const resp = await fetch("/api/import/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files: entries.map((e) => ({ sha256: e.sha256, ext: e.ext })) }),
      });
      const data = await resp.json();
      existing = new Set<string>(data.existing ?? []);
    } catch (e) {
      // Non-fatal: if the check fails, we just try to upload everything.
      setErrors((prev) => [...prev, `existence check failed: ${(e as Error).message}`]);
    }

    let skippedCount = existing.size;
    setSkipped(skippedCount);
    const toUpload = entries.filter((e) => !existing.has(e.sha256));

    // 4. Upload the rest with limited concurrency
    setPhase("uploading");
    let uploadedCount = 0;
    let consecutiveFails = 0;
    let aborted = false;

    const queue = [...toUpload];
    async function worker() {
      while (queue.length && !aborted) {
        const entry = queue.shift()!;
        const form = new FormData();
        form.append("file", entry.file, entry.file.name);
        form.append("sha256", entry.sha256);
        form.append("relPath", entry.relPath);
        try {
          const resp = await fetch("/api/import/upload", { method: "POST", body: form });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const data = await resp.json();
          if (data.skipped) {
            skippedCount++;
            setSkipped(skippedCount);
          } else {
            uploadedCount++;
            setUploaded(uploadedCount);
          }
          consecutiveFails = 0;
        } catch (e) {
          setErrors((prev) => [...prev, `${entry.file.name}: ${(e as Error).message}`]);
          consecutiveFails++;
          if (consecutiveFails >= 5) {
            aborted = true;
            setFatal("Too many uploads failed in a row — stopping. Check the connection and retry.");
          }
        }
      }
    }
    await Promise.all(Array.from({ length: UPLOAD_CONCURRENCY }, worker));

    if (aborted) {
      setPhase("error");
      return;
    }

    // 5. Finalize — write the manifest to R2
    try {
      const resp = await fetch("/api/import/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          files: entries.map((e) => ({
            sha256: e.sha256,
            key: e.key,
            ext: e.ext,
            originalFilename: e.file.name,
            relPath: e.relPath,
            sizeBytes: e.sizeBytes,
          })),
        }),
      });
      const data = await resp.json();
      setManifestKey(data.manifestKey ?? null);
    } catch (e) {
      setErrors((prev) => [...prev, `finalize failed: ${(e as Error).message}`]);
    }
    setPhase("done");
  }, []);

  const busy = phase === "hashing" || phase === "checking" || phase === "uploading";

  const pct =
    phase === "hashing"
      ? total ? Math.round((hashed / total) * 100) : 0
      : total ? Math.round(((uploaded + skipped) / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Import Library Files</CardTitle>
          <CardDescription>
            Select your <code>Authors_and_Books</code> folder. The browser hashes each file and
            uploads PDFs, DOCs, DOCX, and images straight to cloud storage — duplicates are
            collapsed automatically and audio/video/EPUB are skipped. Nothing is stored on this
            device and no credentials are needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length) run(e.target.files);
            }}
          />

          <Button disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Working…" : "Choose folder"}
          </Button>

          {total > 0 && (
            <div className="space-y-2">
              <Progress value={pct} />
              <div className="text-sm text-muted-foreground space-y-1">
                <div>
                  {phase === "hashing"
                    ? `Hashing ${hashed} / ${total} files…`
                    : phase === "checking"
                    ? "Checking which files are already uploaded…"
                    : `Uploaded ${uploaded} · already present ${skipped} · of ${total} unique-by-name (${fmtBytes(totalBytes)})`}
                </div>
              </div>
            </div>
          )}

          {fatal && <div className="text-sm text-destructive">{fatal}</div>}

          {phase === "done" && (
            <div className="rounded-md border border-border bg-muted/40 p-4 text-sm space-y-2">
              <div className="font-medium">Import complete.</div>
              <div>
                Uploaded <strong>{uploaded}</strong> new file{uploaded === 1 ? "" : "s"},{" "}
                <strong>{skipped}</strong> already present.
              </div>
              {manifestKey && (
                <div>
                  Tell the assistant this manifest key to match &amp; index:
                  <code className="block mt-1 break-all rounded bg-background px-2 py-1">
                    {manifestKey}
                  </code>
                </div>
              )}
            </div>
          )}

          {errors.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                {errors.length} warning{errors.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-2 space-y-1 text-destructive">
                {errors.slice(0, 50).map((e, i) => (
                  <li key={i} className="break-all">{e}</li>
                ))}
                {errors.length > 50 && <li>…and {errors.length - 50} more</li>}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
