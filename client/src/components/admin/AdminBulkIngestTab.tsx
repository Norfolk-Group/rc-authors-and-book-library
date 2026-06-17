/**
 * AdminBulkIngestTab — Bulk recursive Dropbox folder ingestion.
 *
 * Workflow:
 *   1. Copy your D:\ folder tree into Dropbox (using the Dropbox desktop app).
 *   2. Point this tool at the Dropbox folder path.
 *   3. Click Start — the server recursively scans all subfolders, ingests every
 *      PDF, creates book/author records, uploads to S3, and indexes text into Neon.
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  FolderOpen,
  Play,
  CheckCircle,
  XCircle,
  Warning,
  Database,
  FilePdf,
} from "@phosphor-icons/react";

const DEFAULT_FOLDER = "/Apps NAI/RC Library App Data/Books Content Entry Folder";

export function AdminBulkIngestTab() {
  const [folderPath, setFolderPath] = useState(DEFAULT_FOLDER);
  const [moveToProcessed, setMoveToProcessed] = useState(false);
  const [fetchBookCover, setFetchBookCover] = useState(true);
  const [indexToNeon, setIndexToNeon] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ingestFolderMutation = trpc.dropbox.ingestFolder.useMutation({
    onSuccess: (data) => {
      setJobId(data.jobId);
      toast.info("Bulk ingest started — scanning Dropbox folder…");
    },
    onError: (err) => toast.error(`Failed to start ingest: ${err.message}`),
  });

  const jobQuery = trpc.dropbox.getIngestJob.useQuery(
    { jobId: jobId ?? "" },
    {
      enabled: !!jobId,
      refetchInterval: jobId ? 2000 : false,
    }
  );

  const job = jobQuery.data;
  const isDone = job?.status === "completed" || job?.status === "failed";

  // Stop polling once done
  useEffect(() => {
    if (isDone && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      if (job?.status === "completed") {
        toast.success(
          `Ingest complete — ${job.succeeded} files ingested, ${job.neonVectors} Neon vectors created`
        );
      } else {
        toast.error("Ingest job failed — check errors below");
      }
    }
  }, [isDone, job]);

  function handleStart() {
    if (!folderPath.trim()) {
      toast.error("Enter a Dropbox folder path");
      return;
    }
    setJobId(null);
    ingestFolderMutation.mutate({
      folderPath: folderPath.trim(),
      moveToProcessed,
      fetchBookCover,
      indexToNeon,
    });
  }

  const pct =
    job && job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-primary/10">
          <FolderOpen className="h-6 w-6 text-primary" weight="duotone" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Folder Ingest</h1>
          <p className="text-muted-foreground text-sm">
            Recursively scan a Dropbox folder tree — ingest every PDF to S3, create book/author
            records, and index full text into Neon pgvector.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-1">
        <p className="font-medium">Before you start</p>
        <p className="text-muted-foreground">
          Copy your local folder tree (e.g. from <code className="bg-muted px-1 rounded">D:\</code>) into
          your Dropbox folder using the Dropbox desktop app. Once Dropbox syncs it to the cloud,
          enter the Dropbox path below and click Start.
        </p>
      </div>

      {/* Config */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="folderPath">Dropbox folder path</Label>
          <Input
            id="folderPath"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            placeholder="/Apps NAI/RC Library App Data/..."
            className="font-mono text-xs"
            disabled={ingestFolderMutation.isPending || (!!job && !isDone)}
          />
          <p className="text-[11px] text-muted-foreground">
            All subfolders are scanned automatically — no need to list them individually.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="flex items-center gap-2">
            <Switch
              id="indexToNeon"
              checked={indexToNeon}
              onCheckedChange={setIndexToNeon}
              disabled={ingestFolderMutation.isPending || (!!job && !isDone)}
            />
            <Label htmlFor="indexToNeon" className="text-sm cursor-pointer">
              Index text into Neon
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="fetchBookCover"
              checked={fetchBookCover}
              onCheckedChange={setFetchBookCover}
              disabled={ingestFolderMutation.isPending || (!!job && !isDone)}
            />
            <Label htmlFor="fetchBookCover" className="text-sm cursor-pointer">
              Fetch book covers
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="moveToProcessed"
              checked={moveToProcessed}
              onCheckedChange={setMoveToProcessed}
              disabled={ingestFolderMutation.isPending || (!!job && !isDone)}
            />
            <Label htmlFor="moveToProcessed" className="text-sm cursor-pointer">
              Move to Processed after
            </Label>
          </div>
        </div>

        <Button
          onClick={handleStart}
          disabled={ingestFolderMutation.isPending || (!!job && !isDone)}
          className="gap-2"
        >
          <Play className="w-4 h-4" />
          {ingestFolderMutation.isPending ? "Starting…" : "Start Bulk Ingest"}
        </Button>
      </div>

      {/* Progress */}
      {job && (
        <div className="rounded-lg border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {job.status === "completed" && <CheckCircle className="w-5 h-5 text-green-500" />}
              {job.status === "failed" && <XCircle className="w-5 h-5 text-destructive" />}
              {(job.status === "running" || job.status === "scanning") && (
                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              )}
              <span className="font-medium capitalize">{job.status}</span>
            </div>
            <span className="text-sm text-muted-foreground">{job.folderPath}</span>
          </div>

          {job.total > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{job.processed} of {job.total} files</span>
                <span>{pct}%</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
                <FilePdf className="w-3 h-3" /> Total PDFs
              </div>
              <div className="text-xl font-bold">{job.total}</div>
            </div>
            <div className="rounded-lg bg-green-500/10 px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
                <CheckCircle className="w-3 h-3 text-green-500" /> Ingested
              </div>
              <div className="text-xl font-bold text-green-600">{job.succeeded}</div>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
                <Warning className="w-3 h-3" /> Skipped
              </div>
              <div className="text-xl font-bold">{job.skipped}</div>
            </div>
            <div className="rounded-lg bg-primary/10 px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
                <Database className="w-3 h-3 text-primary" /> Neon vectors
              </div>
              <div className="text-xl font-bold text-primary">{job.neonVectors}</div>
            </div>
          </div>

          {/* Errors */}
          {job.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-destructive flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                {job.failed} errors
              </p>
              <div className="max-h-36 overflow-y-auto rounded border bg-destructive/5 p-2 space-y-1">
                {job.errors.slice(0, 50).map((e, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground font-mono">
                    {e}
                  </p>
                ))}
                {job.errors.length > 50 && (
                  <p className="text-[11px] text-muted-foreground">
                    …and {job.errors.length - 50} more
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Timing */}
          {job.completedAt && (
            <p className="text-xs text-muted-foreground">
              Completed at {new Date(job.completedAt).toLocaleTimeString()}
            </p>
          )}

          {isDone && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setJobId(null); }}
            >
              Start another ingest
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
