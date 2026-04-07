/**
 * AdminDropboxFolderBrowser
 *
 * Live Dropbox folder browser with:
 * - Backup verification dashboard (file counts, sizes, last-modified per subfolder)
 * - Drill-down file list for each subfolder (Avatars, Book Covers, PDFs, Inbox)
 * - Refresh button to re-fetch live data
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen,
  Folder,
  Image,
  FilePdf,
  Users,
  Tray,
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  File,
} from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "—";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const FOLDER_ICONS: Record<string, React.ReactNode> = {
  avatars: <Users className="w-4 h-4 text-blue-400" weight="fill" />,
  bookCovers: <Image className="w-4 h-4 text-purple-400" weight="fill" />,
  pdfs: <FilePdf className="w-4 h-4 text-red-400" weight="fill" />,
  inbox: <Tray className="w-4 h-4 text-amber-400" weight="fill" />,
};

const EXT_ICONS: Record<string, React.ReactNode> = {
  jpg: <Image className="w-3 h-3 text-blue-400" />,
  jpeg: <Image className="w-3 h-3 text-blue-400" />,
  png: <Image className="w-3 h-3 text-blue-400" />,
  webp: <Image className="w-3 h-3 text-blue-400" />,
  pdf: <FilePdf className="w-3 h-3 text-red-400" />,
};

// ── Subfolder Row ─────────────────────────────────────────────────────────────
interface SubfolderRowProps {
  folderKey: string;
  label: string;
  path: string;
  count: number;
  totalSize: number;
  lastModified: string | null;
  exists: boolean;
}

function SubfolderRow({ folderKey, label, path, count, totalSize, lastModified, exists }: SubfolderRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const contentsQuery = trpc.dropbox.browseFolderContents.useQuery(
    { folderPath: path },
    { enabled: enabled && expanded, staleTime: 30_000 }
  );

  const handleExpand = () => {
    setExpanded((prev) => !prev);
    if (!enabled) setEnabled(true);
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
      >
        <span className="text-muted-foreground">
          {expanded ? <CaretDown className="w-3.5 h-3.5" /> : <CaretRight className="w-3.5 h-3.5" />}
        </span>
        <span>{FOLDER_ICONS[folderKey] ?? <Folder className="w-4 h-4 text-yellow-400" />}</span>
        <span className="flex-1 font-medium text-sm">{label}</span>
        <span className="text-xs text-muted-foreground font-mono">{path.split("/").slice(-1)[0]}/</span>
        <div className="flex items-center gap-2 ml-4">
          {!exists ? (
            <Badge variant="outline" className="text-xs text-muted-foreground">Not created yet</Badge>
          ) : (
            <>
              <Badge variant="secondary" className="text-xs tabular-nums">{count} files</Badge>
              <Badge variant="outline" className="text-xs tabular-nums">{formatBytes(totalSize)}</Badge>
              <span className="text-xs text-muted-foreground min-w-[70px] text-right">
                {formatRelativeTime(lastModified)}
              </span>
            </>
          )}
        </div>
      </button>

      {/* Expanded file list */}
      {expanded && (
        <div className="border-t border-border bg-muted/20">
          {contentsQuery.isLoading ? (
            <div className="flex items-center gap-2 px-6 py-4 text-sm text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading files…
            </div>
          ) : contentsQuery.data?.files.length === 0 ? (
            <div className="px-6 py-4 text-sm text-muted-foreground italic">
              No files found in this folder.
            </div>
          ) : (
            <div className="divide-y divide-border/50 max-h-64 overflow-y-auto">
              {contentsQuery.data?.files.map((file) => (
                <div key={file.path} className="flex items-center gap-2 px-6 py-1.5 hover:bg-muted/40 transition-colors">
                  <span>{EXT_ICONS[file.extension] ?? <File className="w-3 h-3 text-muted-foreground" />}</span>
                  <span className="flex-1 text-xs font-mono truncate text-foreground/80">{file.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatBytes(file.size)}</span>
                  <span className="text-xs text-muted-foreground min-w-[60px] text-right">
                    {formatRelativeTime(file.serverModified)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
interface AdminDropboxFolderBrowserProps {
  /** Increment this value to force a refresh of the folder stats (e.g. after a backup completes) */
  refreshTrigger?: number;
}

export function AdminDropboxFolderBrowser({ refreshTrigger }: AdminDropboxFolderBrowserProps = {}) {
  const statsQuery = trpc.dropbox.getBackupFolderStats.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Re-fetch whenever the parent signals a refresh (e.g. after backup completes)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      statsQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  const handleRefresh = () => {
    statsQuery.refetch();
  };

  const stats = statsQuery.data;

  const SUBFOLDER_ORDER: Array<{ key: keyof NonNullable<typeof stats>["subfolders"]; label: string }> = [
    { key: "avatars", label: "Avatars" },
    { key: "bookCovers", label: "Book Covers" },
    { key: "pdfs", label: "PDFs" },
    { key: "inbox", label: "Inbox" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-yellow-500" weight="fill" />
            Dropbox Folder Browser
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={statsQuery.isFetching}
            className="h-7 px-2 text-xs"
          >
            {statsQuery.isFetching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowsClockwise className="w-3.5 h-3.5" />
            )}
            <span className="ml-1">Refresh</span>
          </Button>
        </div>
        {stats && (
          <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
            {stats.backupRoot}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {statsQuery.isLoading ? (
          <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting to Dropbox…
          </div>
        ) : statsQuery.error ? (
          <div className="text-sm text-destructive py-4 text-center">
            Failed to load folder stats: {statsQuery.error.message}
          </div>
        ) : stats ? (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {SUBFOLDER_ORDER.map(({ key, label }) => {
                const sf = stats.subfolders[key];
                return (
                  <div key={key} className="bg-muted/40 rounded-lg p-2 text-center">
                    <div className="flex justify-center mb-1">{FOLDER_ICONS[key]}</div>
                    <div className="text-lg font-bold tabular-nums">{sf.count}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                );
              })}
            </div>

            {/* Subfolder rows with drill-down */}
            <div className="space-y-1.5">
              {SUBFOLDER_ORDER.map(({ key, label }) => {
                const sf = stats.subfolders[key];
                return (
                  <SubfolderRow
                    key={key}
                    folderKey={key}
                    label={label}
                    path={sf.path}
                    count={sf.count}
                    totalSize={sf.totalSize}
                    lastModified={sf.lastModified}
                    exists={sf.exists}
                  />
                );
              })}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
