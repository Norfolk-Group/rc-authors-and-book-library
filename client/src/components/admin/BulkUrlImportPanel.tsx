/**
 * BulkUrlImportPanel — Admin panel for bulk-importing content items from URLs.
 * Supports:
 *   - YouTube videos/channels (YouTube Data API)
 *   - TED talks (TED public API)
 *   - Academic papers (DOI / OpenAlex — free, no key)
 *   - IMDB films/shows (OMDB API)
 *   - Substack posts/publications
 *   - Generic URLs (created as website stubs)
 *
 * Usage: paste one URL per line, click "Import All".
 * Multi-author: enter comma-separated author names in the author field.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Link,
  Youtube,
  Mic,
  Globe,
  Upload,
  Trash2,
  BookOpen,
  Film,
  Newspaper,
  FlaskConical,
  Users,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ────────────────────────────────────────────────────────────────────

type UrlStatus = "pending" | "processing" | "success" | "error";
type UrlType = "youtube" | "ted" | "paper" | "film" | "substack" | "podcast_query" | "generic";

interface UrlEntry {
  url: string;
  status: UrlStatus;
  message?: string;
  title?: string;
  type: UrlType;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function detectUrlType(url: string): UrlType {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/ted\.com\/talks\//.test(url)) return "ted";
  if (/doi\.org\/10\.|openalex\.org\/W/.test(url)) return "paper";
  if (/imdb\.com\/title\/tt/.test(url)) return "film";
  if (/\.substack\.com/.test(url)) return "substack";
  if (/spotify\.com\/episode|podcasts\.apple\.com|anchor\.fm/.test(url)) return "podcast_query";
  return "generic";
}

function getTypeIcon(type: UrlType) {
  switch (type) {
    case "youtube": return <Youtube className="w-3.5 h-3.5 text-red-500" />;
    case "ted": return <BookOpen className="w-3.5 h-3.5 text-red-600" />;
    case "paper": return <FlaskConical className="w-3.5 h-3.5 text-blue-500" />;
    case "film": return <Film className="w-3.5 h-3.5 text-yellow-500" />;
    case "substack": return <Newspaper className="w-3.5 h-3.5 text-orange-500" />;
    case "podcast_query": return <Mic className="w-3.5 h-3.5 text-purple-500" />;
    default: return <Globe className="w-3.5 h-3.5 text-blue-500" />;
  }
}

function getTypeBadgeColor(type: UrlType): string {
  switch (type) {
    case "youtube": return "bg-red-100 text-red-700 border-red-200";
    case "ted": return "bg-red-100 text-red-800 border-red-200";
    case "paper": return "bg-blue-100 text-blue-700 border-blue-200";
    case "film": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "substack": return "bg-orange-100 text-orange-700 border-orange-200";
    case "podcast_query": return "bg-purple-100 text-purple-700 border-purple-200";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function getTypeLabel(type: UrlType): string {
  switch (type) {
    case "youtube": return "YouTube";
    case "ted": return "TED";
    case "paper": return "Paper";
    case "film": return "Film/TV";
    case "substack": return "Substack";
    case "podcast_query": return "Podcast";
    default: return "Generic";
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export function BulkUrlImportPanel() {
  const [rawInput, setRawInput] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const [entries, setEntries] = useState<UrlEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const enrichYouTubeMutation = trpc.contentItems.enrichFromYouTube.useMutation();
  const enrichTedMutation = trpc.contentItems.enrichFromTed.useMutation();
  const enrichPaperMutation = trpc.contentItems.enrichFromPaper.useMutation();
  const enrichFilmMutation = trpc.contentItems.enrichFromFilm.useMutation();
  const enrichSubstackMutation = trpc.contentItems.enrichFromSubstack.useMutation();
  const createMutation = trpc.contentItems.create.useMutation();
  const utils = trpc.useUtils();

  // Parse author names from the comma-separated input
  function parseAuthorNames(): string[] {
    return authorInput
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // Parse the textarea into URL entries
  function parseUrls() {
    const lines = rawInput
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && (l.startsWith("http://") || l.startsWith("https://")));
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const l of lines) {
      if (!seen.has(l)) { seen.add(l); unique.push(l); }
    }
    setEntries(
      unique.map((url) => ({
        url,
        status: "pending",
        type: detectUrlType(url),
      }))
    );
  }

  function clearAll() {
    setRawInput("");
    setAuthorInput("");
    setEntries([]);
  }

  function updateEntry(url: string, patch: Partial<UrlEntry>) {
    setEntries((prev) => prev.map((e) => (e.url === url ? { ...e, ...patch } : e)));
  }

  async function importAll() {
    if (entries.length === 0) return;
    setIsRunning(true);
    const authorNames = parseAuthorNames();
    let successCount = 0;
    let errorCount = 0;

    for (const entry of entries) {
      if (entry.status === "success") continue; // skip already done
      updateEntry(entry.url, { status: "processing" });

      try {
        switch (entry.type) {
          case "youtube": {
            const result = await enrichYouTubeMutation.mutateAsync({
              url: entry.url,
              authorNames,
            });
            updateEntry(entry.url, {
              status: "success",
              title: result.title,
              message: `Created as ${result.contentType}`,
            });
            break;
          }
          case "ted": {
            const result = await enrichTedMutation.mutateAsync({
              url: entry.url,
              authorNames,
            });
            updateEntry(entry.url, {
              status: "success",
              title: result.title,
              message: result.speakerName
                ? `TED talk by ${result.speakerName}${result.viewCount ? ` · ${result.viewCount.toLocaleString()} views` : ""}`
                : "TED talk imported",
            });
            break;
          }
          case "paper": {
            const result = await enrichPaperMutation.mutateAsync({
              identifier: entry.url,
              authorNames,
            });
            updateEntry(entry.url, {
              status: "success",
              title: result.title,
              message: result.journalName
                ? `${result.journalName}${result.citedByCount ? ` · ${result.citedByCount} citations` : ""}`
                : "Academic paper imported",
            });
            break;
          }
          case "film": {
            const result = await enrichFilmMutation.mutateAsync({
              identifier: entry.url,
              authorNames,
            });
            updateEntry(entry.url, {
              status: "success",
              title: result.title,
              message: result.imdbRating
                ? `${result.filmType === "tv_show" ? "TV Show" : "Film"} · IMDB ${result.imdbRating}`
                : `${result.filmType === "tv_show" ? "TV Show" : "Film"} imported`,
            });
            break;
          }
          case "substack": {
            const result = await enrichSubstackMutation.mutateAsync({
              url: entry.url,
              authorNames,
            });
            updateEntry(entry.url, {
              status: "success",
              title: result.title,
              message: result.likeCount
                ? `Substack post · ${result.likeCount} likes`
                : "Substack post imported",
            });
            break;
          }
          default: {
            // Generic URL: create a minimal content item with the URL
            const domain = new URL(entry.url).hostname.replace("www.", "");
            await createMutation.mutateAsync({
              title: domain,
              contentType: "website",
              url: entry.url,
              authorNames,
            });
            updateEntry(entry.url, {
              status: "success",
              title: domain,
              message: "Created as website — enrich manually",
            });
          }
        }
        successCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        updateEntry(entry.url, { status: "error", message: msg });
        errorCount++;
      }
    }

    await utils.contentItems.list.invalidate();
    await utils.contentItems.getGroupCounts.invalidate();
    setIsRunning(false);

    if (errorCount > 0) {
      toast.error(`Import complete: ${successCount} imported, ${errorCount} failed`);
    } else {
      toast.success(`Import complete: ${successCount} items imported`);
    }
  }

  const pendingCount = entries.filter((e) => e.status === "pending").length;
  const successCount = entries.filter((e) => e.status === "success").length;
  const errorCount = entries.filter((e) => e.status === "error").length;

  // Count by type
  const typeCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="w-4 h-4 text-primary" />
          Bulk URL Import
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Paste one URL per line. Supported: YouTube, TED talks, academic papers (DOI/OpenAlex),
          IMDB films/shows, Substack posts. Other URLs are created as website stubs.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Author names input */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Author Names <span className="text-muted-foreground font-normal">(comma-separated, optional)</span>
          </Label>
          <Input
            placeholder="e.g. Brené Brown, Adam Grant"
            value={authorInput}
            onChange={(e) => setAuthorInput(e.target.value)}
            className="text-sm"
            disabled={isRunning}
          />
        </div>

        {/* URL input area */}
        <div className="space-y-2">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Link className="w-3.5 h-3.5" />
            URLs <span className="text-muted-foreground font-normal">(one per line)</span>
          </Label>
          <Textarea
            placeholder={`https://www.ted.com/talks/brene_brown_the_power_of_vulnerability\nhttps://www.youtube.com/watch?v=...\nhttps://doi.org/10.1038/nature12373\nhttps://www.imdb.com/title/tt0816692/\nhttps://authorname.substack.com/p/post-slug`}
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            rows={6}
            className="font-mono text-xs resize-none"
            disabled={isRunning}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={parseUrls}
              disabled={!rawInput.trim() || isRunning}
            >
              <Link className="w-3.5 h-3.5 mr-1.5" />
              Parse URLs
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={clearAll}
              disabled={isRunning}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Clear
            </Button>
          </div>
        </div>

        {/* Type breakdown badges */}
        {entries.length > 0 && Object.keys(typeCounts).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(typeCounts) as [UrlType, number][]).map(([type, count]) => (
              <span
                key={type}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${getTypeBadgeColor(type)}`}
              >
                {getTypeIcon(type)}
                {getTypeLabel(type)}: {count}
              </span>
            ))}
          </div>
        )}

        {/* URL list */}
        {entries.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {entries.map((entry) => (
                <div
                  key={entry.url}
                  className="flex items-start gap-2 p-2 rounded-md bg-muted/40 text-xs"
                >
                  {/* Status icon */}
                  <div className="mt-0.5 shrink-0">
                    {entry.status === "pending" && (
                      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/40" />
                    )}
                    {entry.status === "processing" && (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    )}
                    {entry.status === "success" && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {entry.status === "error" && (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>

                  {/* URL + type badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {getTypeIcon(entry.type)}
                      <span
                        className={`px-1.5 py-0 rounded text-[10px] border ${getTypeBadgeColor(entry.type)}`}
                      >
                        {getTypeLabel(entry.type)}
                      </span>
                      <span className="truncate text-muted-foreground font-mono">
                        {entry.url.length > 55 ? entry.url.slice(0, 55) + "…" : entry.url}
                      </span>
                    </div>
                    {entry.title && (
                      <div className="font-medium text-foreground truncate">{entry.title}</div>
                    )}
                    {entry.message && (
                      <div
                        className={
                          entry.status === "error"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        }
                      >
                        {entry.message}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary + action */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {pendingCount} pending
                </Badge>
                {successCount > 0 && (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                    {successCount} done
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {errorCount} failed
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                onClick={importAll}
                disabled={isRunning || pendingCount === 0}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Import All ({pendingCount})
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
