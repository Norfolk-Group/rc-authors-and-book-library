/**
 * SubstackPostsPanel.tsx
 *
 * Displays recent Substack posts for an author on their AuthorDetail page.
 * Fetches via trpc.substack.getPostsByAuthor using the author's numeric DB id.
 *
 * Features:
 * - Shows publication name, description, and link to the Substack
 * - Lists up to 5 recent posts with title, date, excerpt, and external link
 * - Paywall indicator on locked posts
 * - Admin: inline Substack URL editor with live preview
 * - Graceful empty state when no Substack URL is set
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink,
  Pencil,
  Check,
  X,
  Lock,
  Rss,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  authorId: number;
  substackUrl?: string | null;
}

export function SubstackPostsPanel({ authorId, substackUrl }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();

  // ── Admin URL editor state ──────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(substackUrl ?? "");

  const updateUrlMutation = trpc.substack.updateSubstackUrl.useMutation({
    onSuccess: () => {
      toast.success("Substack URL updated");
      setEditing(false);
      utils.substack.getPostsByAuthor.invalidate({ authorId });
      utils.authorProfiles.get.invalidate();
    },
    onError: (e) => toast.error("Failed to update: " + e.message),
  });

  // ── Fetch posts ─────────────────────────────────────────────────────────────
  const { data: feed, isLoading, refetch, isRefetching } = trpc.substack.getPostsByAuthor.useQuery(
    { authorId, limit: 5 },
    {
      enabled: !!substackUrl,
      staleTime: 5 * 60_000, // 5 min
      retry: false,
    }
  );

  // ── Render: no Substack URL set ─────────────────────────────────────────────
  if (!substackUrl && !editing) {
    if (!isAdmin) return null;
    return (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Substack
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => { setEditing(true); setEditValue(""); }}
          >
            <Pencil className="w-3 h-3" />
            Add Substack URL
          </Button>
        </div>
        {editing && (
          <SubstackUrlEditor
            value={editValue}
            onChange={setEditValue}
            onSave={() => updateUrlMutation.mutate({ authorId, substackUrl: editValue })}
            onCancel={() => setEditing(false)}
            isSaving={updateUrlMutation.isPending}
          />
        )}
      </section>
    );
  }

  // ── Render: loading skeleton ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Substack
        </h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-4 w-4 mt-0.5 flex-shrink-0 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // ── Render: fetch failed or empty ────────────────────────────────────────────
  if (!feed) {
    return (
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Substack
          </h2>
          <div className="flex gap-1">
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => { setEditing(true); setEditValue(substackUrl ?? ""); }}
              >
                <Pencil className="w-3 h-3" />
                Edit
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`w-3 h-3 ${isRefetching ? "animate-spin" : ""}`} />
              Retry
            </Button>
          </div>
        </div>
        {editing && (
          <SubstackUrlEditor
            value={editValue}
            onChange={setEditValue}
            onSave={() => updateUrlMutation.mutate({ authorId, substackUrl: editValue })}
            onCancel={() => setEditing(false)}
            isSaving={updateUrlMutation.isPending}
          />
        )}
        <p className="text-sm text-muted-foreground">
          Could not load Substack feed. The publication may be private or the URL may be incorrect.
        </p>
      </section>
    );
  }

  // ── Render: posts ────────────────────────────────────────────────────────────
  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Substack
          </h2>
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1.5 border-orange-400/40 text-orange-500 bg-orange-500/5"
          >
            <Rss className="w-2.5 h-2.5 mr-0.5" />
            {feed.posts.length} posts
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => { setEditing(!editing); setEditValue(substackUrl ?? ""); }}
            >
              <Pencil className="w-3 h-3" />
              Edit
            </Button>
          )}
          <a
            href={feed.publicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open
          </a>
        </div>
      </div>

      {/* Admin URL editor */}
      {editing && (
        <div className="mb-4">
          <SubstackUrlEditor
            value={editValue}
            onChange={setEditValue}
            onSave={() => updateUrlMutation.mutate({ authorId, substackUrl: editValue })}
            onCancel={() => setEditing(false)}
            isSaving={updateUrlMutation.isPending}
          />
        </div>
      )}

      {/* Publication header card */}
      <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 mb-4">
        <div className="flex items-start gap-3">
          {feed.publicationImageUrl && (
            <img
              src={feed.publicationImageUrl}
              alt={feed.publicationName}
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <a
              href={feed.publicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sm hover:text-primary transition-colors line-clamp-1"
            >
              {feed.publicationName}
            </a>
            {feed.publicationDescription && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {feed.publicationDescription}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              {feed.subdomain}.substack.com
            </p>
          </div>
        </div>
      </div>

      {/* Posts list */}
      <div className="space-y-3">
        {feed.posts.map((post) => (
          <a
            key={post.id}
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-lg border border-border/40 bg-card/40 hover:bg-card/70 hover:border-border/70 p-3 transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  {post.isPaywalled && (
                    <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </span>
                </div>
                {post.excerpt && !post.isPaywalled && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">
                    {post.excerpt}
                  </p>
                )}
                {post.isPaywalled && (
                  <p className="text-xs text-amber-600/70 mb-1.5">
                    Subscriber-only post
                  </p>
                )}
                {post.publishedAt && (
                  <p className="text-[10px] text-muted-foreground/60">
                    {formatDate(post.publishedAt)}
                  </p>
                )}
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary/60 flex-shrink-0 mt-0.5 transition-colors" />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface EditorProps {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

function SubstackUrlEditor({ value, onChange, onSave, onCancel, isSaving }: EditorProps) {
  return (
    <div className="flex gap-2 items-center">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. adamgrant.substack.com or https://adamgrant.substack.com"
        className="h-8 text-sm flex-1"
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
      />
      <Button
        size="sm"
        className="h-8 px-2"
        onClick={onSave}
        disabled={isSaving || !value.trim()}
      >
        <Check className="w-3.5 h-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={onCancel}
        disabled={isSaving}
      >
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return dateStr;
  }
}
