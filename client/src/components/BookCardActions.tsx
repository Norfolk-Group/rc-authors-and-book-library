/**
 * BookCardActions
 *
 * A compact dropdown action menu for book cards/rows.
 * Provides granular per-book enrichment operations:
 *   - Update Book Cover (Google Books API + S3 mirror)
 *   - Update Summary (Perplexity web-grounded research)
 *
 * Usage: Rendered inside book rows or book detail panels.
 * All mutations use current AppSettings for LLM configuration.
 */

import { useState, useCallback } from "react";
import { MoreHorizontal, Image, FileText, Loader2, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import { toast } from "sonner";

type ActionStatus = "idle" | "loading" | "success" | "error";

interface BookCardActionsProps {
  bookTitle: string;
  authorName?: string;
  hasCover: boolean;
  hasSummary: boolean;
  /** Called after a successful cover update */
  onCoverUpdated?: () => void;
  /** Called after a successful summary update */
  onSummaryUpdated?: () => void;
}

export function BookCardActions({
  bookTitle,
  authorName,
  hasCover,
  hasSummary,
  onCoverUpdated,
  onSummaryUpdated,
}: BookCardActionsProps) {
  const { settings } = useAppSettings();
  const utils = trpc.useUtils();

  const [coverStatus, setCoverStatus] = useState<ActionStatus>("idle");
  const [summaryStatus, setSummaryStatus] = useState<ActionStatus>("idle");

  // ── Cover enrichment ─────────────────────────────────────────────────────────
  const enrichCoverMutation = trpc.bookProfiles.enrich.useMutation({
    onSuccess: (data) => {
      setCoverStatus("success");
      if (data.skipped) {
        toast.info(`Cover already up to date for "${bookTitle}"`);
      } else {
        toast.success(`Cover updated for "${bookTitle}"`);
        onCoverUpdated?.();
        void utils.bookProfiles.getMany.invalidate();
        void utils.bookProfiles.getAllEnrichedTitles.invalidate();
      }
      setTimeout(() => setCoverStatus("idle"), 3000);
    },
    onError: (err) => {
      setCoverStatus("error");
      toast.error(`Cover update failed`, { description: err.message });
      setTimeout(() => setCoverStatus("idle"), 3000);
    },
  });

  // ── Summary enrichment ───────────────────────────────────────────────────────
  const updateSummaryMutation = trpc.bookProfiles.updateBookSummary.useMutation({
    onSuccess: (data) => {
      setSummaryStatus("success");
      toast.success(`Summary updated for "${bookTitle}"`, {
        description: `Source: ${data.source}`,
      });
      onSummaryUpdated?.();
      void utils.bookProfiles.getMany.invalidate();
      setTimeout(() => setSummaryStatus("idle"), 3000);
    },
    onError: (err) => {
      setSummaryStatus("error");
      toast.error(`Summary update failed`, { description: err.message });
      setTimeout(() => setSummaryStatus("idle"), 3000);
    },
  });

  const handleUpdateCover = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (coverStatus === "loading") return;
      setCoverStatus("loading");
      enrichCoverMutation.mutate({
        bookTitle,
        authorName,
        model: settings.bookResearchModel,
        secondaryModel: settings.bookResearchSecondaryEnabled
          ? settings.bookResearchSecondaryModel
          : undefined,
      });
    },
    [bookTitle, authorName, coverStatus, enrichCoverMutation, settings]
  );

  const handleUpdateSummary = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (summaryStatus === "loading") return;
      setSummaryStatus("loading");
      updateSummaryMutation.mutate({
        bookTitle,
        authorName,
        researchVendor: settings.bookResearchVendor,
        researchModel: settings.bookResearchModel,
      });
    },
    [bookTitle, authorName, summaryStatus, updateSummaryMutation, settings]
  );

  const isAnyLoading = coverStatus === "loading" || summaryStatus === "loading";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 rounded-full opacity-0 group-hover/book:opacity-100 transition-opacity focus:opacity-100"
          onClick={(e) => e.stopPropagation()}
          title="Book actions"
          disabled={isAnyLoading}
        >
          {isAnyLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <MoreHorizontal className="w-3 h-3" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal py-1 line-clamp-1">
          {bookTitle}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Update Book Cover */}
        <DropdownMenuItem
          onClick={handleUpdateCover}
          disabled={coverStatus === "loading"}
          className="gap-2 cursor-pointer"
        >
          <ActionIcon status={coverStatus} icon={<Image className="w-3.5 h-3.5" />} />
          <span className="text-xs">
            {hasCover ? "Refresh Cover" : "Fetch Cover"}
          </span>
          {coverStatus === "loading" && (
            <span className="ml-auto text-[10px] text-muted-foreground">Fetching…</span>
          )}
        </DropdownMenuItem>

        {/* Update Summary */}
        <DropdownMenuItem
          onClick={handleUpdateSummary}
          disabled={summaryStatus === "loading"}
          className="gap-2 cursor-pointer"
        >
          <ActionIcon status={summaryStatus} icon={<FileText className="w-3.5 h-3.5" />} />
          <span className="text-xs">
            {hasSummary ? "Refresh Summary" : "Generate Summary"}
          </span>
          {summaryStatus === "loading" && (
            <span className="ml-auto text-[10px] text-muted-foreground">Researching…</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Renders the correct icon based on action status */
function ActionIcon({
  status,
  icon,
}: {
  status: ActionStatus;
  icon: React.ReactNode;
}) {
  if (status === "loading") return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />;
  if (status === "success") return <Check className="w-3.5 h-3.5 text-green-500" />;
  if (status === "error") return <X className="w-3.5 h-3.5 text-destructive" />;
  return <span className="text-muted-foreground">{icon}</span>;
}

export default BookCardActions;
