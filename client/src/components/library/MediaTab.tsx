/**
 * MediaTab.tsx
 * Media tab content for the Home page.
 * Shows content_items (non-book) with sub-filter chips and a card grid.
 * Sub-filters: All | Written | Audio & Video | Courses | Film & TV | Other
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  FileText,
  Headphones,
  GraduationCap,
  Film,
  MoreHorizontal,
  LayoutGrid,
  ExternalLink,
  Star,
  Calendar,
  Globe,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ── Sub-filter config ─────────────────────────────────────────────────────────
const MEDIA_GROUPS = [
  { key: "all",         label: "All Media",     icon: LayoutGrid },
  { key: "written",     label: "Written",        icon: FileText },
  { key: "audio_video", label: "Audio & Video",  icon: Headphones },
  { key: "courses",     label: "Courses",        icon: GraduationCap },
  { key: "film_tv",     label: "Film & TV",      icon: Film },
  { key: "other",       label: "Other",          icon: MoreHorizontal },
] as const;

type MediaGroup = typeof MEDIA_GROUPS[number]["key"];
type SortOption = "newest" | "oldest" | "title-asc" | "title-desc" | "rating-desc";

// ── Content type display labels ───────────────────────────────────────────────
const CONTENT_TYPE_LABELS: Record<string, string> = {
  paper:           "Research Paper",
  article:         "Article",
  substack:        "Substack",
  newsletter:      "Newsletter",
  blog_post:       "Blog Post",
  social_post:     "Social Post",
  website:         "Website",
  speech:          "Speech",
  interview:       "Interview",
  podcast:         "Podcast",
  podcast_episode: "Podcast Episode",
  youtube_video:   "YouTube Video",
  youtube_channel: "YouTube Channel",
  ted_talk:        "TED Talk",
  radio:           "Radio",
  masterclass:     "Masterclass",
  online_course:   "Online Course",
  tool:            "Tool",
  tv_show:         "TV Show",
  tv_episode:      "TV Episode",
  film:            "Film",
  photography:     "Photography",
  other:           "Other",
};

const CONTENT_TYPE_COLORS: Record<string, string> = {
  paper:           "#0284c7",
  article:         "#0891b2",
  substack:        "#f97316",
  newsletter:      "#d97706",
  blog_post:       "#7c3aed",
  social_post:     "#db2777",
  website:         "#059669",
  speech:          "#6366f1",
  interview:       "#8b5cf6",
  podcast:         "#ec4899",
  podcast_episode: "#f43f5e",
  youtube_video:   "#ef4444",
  youtube_channel: "#dc2626",
  ted_talk:        "#e11d48",
  radio:           "#64748b",
  masterclass:     "#f59e0b",
  online_course:   "#10b981",
  tool:            "#3b82f6",
  tv_show:         "#8b5cf6",
  tv_episode:      "#7c3aed",
  film:            "#6d28d9",
  photography:     "#0891b2",
  other:           "#6b7280",
};

// ── MediaItemCard ─────────────────────────────────────────────────────────────
interface MediaItemCardProps {
  item: {
    id: number;
    contentType: string;
    title: string;
    subtitle?: string | null;
    description?: string | null;
    url?: string | null;
    coverImageUrl?: string | null;
    s3CoverUrl?: string | null;
    publishedDate?: string | null;
    rating?: string | null;
    ratingCount?: number | null;
    language?: string | null;
    authors: string[];
  };
}

function MediaItemCard({ item }: MediaItemCardProps) {
  const coverUrl = item.s3CoverUrl || item.coverImageUrl || null;
  const typeLabel = CONTENT_TYPE_LABELS[item.contentType] ?? item.contentType;
  const typeColor = CONTENT_TYPE_COLORS[item.contentType] ?? "#6b7280";
  const rating = item.rating ? parseFloat(String(item.rating)) : null;

  return (
    <div className="group flex flex-col rounded-xl border border-border/50 bg-card hover:border-border hover:shadow-md transition-all overflow-hidden">
      {/* Cover / placeholder */}
      <div className="relative w-full aspect-[16/9] bg-muted/30 overflow-hidden flex-shrink-0">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: typeColor + "18" }}
          >
            <span className="text-4xl font-black opacity-20" style={{ color: typeColor }}>
              {item.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {/* Type badge */}
        <span
          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white shadow-sm"
          style={{ backgroundColor: typeColor }}
        >
          {typeLabel}
        </span>
        {/* External link */}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center transition-colors"
            title="Open link"
          >
            <ExternalLink className="w-3 h-3 text-white" />
          </a>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1.5 p-3 flex-1">
        <h3 className="text-sm font-semibold line-clamp-2 leading-tight">{item.title}</h3>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground line-clamp-1">{item.subtitle}</p>
        )}
        {item.authors.length > 0 && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {item.authors.join(", ")}
          </p>
        )}
        {item.description && (
          <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-0.5">{item.description}</p>
        )}
        <div className="flex items-center gap-2 mt-auto pt-1.5 flex-wrap">
          {rating !== null && rating > 0 && (
            <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium">
              <Star className="w-3 h-3 fill-amber-500 stroke-amber-500" />
              {rating.toFixed(1)}
              {item.ratingCount ? (
                <span className="text-muted-foreground font-normal ml-0.5">
                  ({item.ratingCount.toLocaleString()})
                </span>
              ) : null}
            </span>
          )}
          {item.publishedDate && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {item.publishedDate.slice(0, 4)}
            </span>
          )}
          {item.language && item.language !== "en" && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Globe className="w-3 h-3" />
              {item.language.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MediaTab ──────────────────────────────────────────────────────────────────
interface MediaTabProps {
  query: string;
}

export function MediaTab({ query }: MediaTabProps) {
  const [activeGroup, setActiveGroup] = useLocalStorage<MediaGroup>("lib:mediaGroup", "all");
  const [sort, setSort] = useLocalStorage<SortOption>("lib:mediaSort", "newest");
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 48;

  const groupCountsQuery = trpc.contentItems.getGroupCounts.useQuery(undefined, {
    staleTime: 2 * 60_000,
  });

  const { data, isLoading, isFetching } = trpc.contentItems.list.useQuery(
    {
      group: activeGroup,
      query,
      sort,
      limit: PAGE_SIZE,
      offset,
      includedOnly: true,
    },
    { staleTime: 60_000 }
  );

  const handleGroupChange = useCallback((g: MediaGroup) => {
    setActiveGroup(g);
    setOffset(0);
  }, [setActiveGroup]);

  const counts = groupCountsQuery.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Sub-filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {MEDIA_GROUPS.map(({ key, label, icon: Icon }) => {
          const isActive = activeGroup === key;
          const count = counts ? counts[key as keyof typeof counts] : undefined;
          return (
            <button
              key={key}
              onClick={() => handleGroupChange(key)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
              style={{
                backgroundColor: isActive ? "hsl(var(--primary) / 0.12)" : "transparent",
                color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                borderColor: isActive ? "hsl(var(--primary))" : "hsl(var(--border))",
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count !== undefined && count > 0 && (
                <span
                  className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                  style={{
                    backgroundColor: isActive ? "hsl(var(--primary) / 0.2)" : "hsl(var(--muted))",
                    color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {/* Sort control */}
        <div className="ml-auto flex items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="h-7 text-xs w-[140px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="title-asc">Title A → Z</SelectItem>
              <SelectItem value="title-desc">Title Z → A</SelectItem>
              <SelectItem value="rating-desc">Highest rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results header */}
      {!isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {total === 0
              ? "No media items found"
              : `${total.toLocaleString()} item${total !== 1 ? "s" : ""}`}
          </span>
          {isFetching && <Loader2 className="w-3 h-3 animate-spin" />}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/30 bg-muted/20 animate-pulse">
              <div className="aspect-[16/9] bg-muted/40 rounded-t-xl" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-muted/60 rounded w-3/4" />
                <div className="h-2.5 bg-muted/40 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <Film className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-lg font-semibold text-muted-foreground">No media items yet</p>
          <p className="text-sm text-muted-foreground/70 max-w-md">
            Articles, papers, podcasts, videos, courses, films, and other non-book content will
            appear here. Use the Admin Console to add media content items.
          </p>
        </div>
      )}

      {/* Card grid */}
      {!isLoading && items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <MediaItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/50 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-xs text-muted-foreground">
            {Math.floor(offset / PAGE_SIZE) + 1} / {Math.ceil(total / PAGE_SIZE)}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted/50 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
