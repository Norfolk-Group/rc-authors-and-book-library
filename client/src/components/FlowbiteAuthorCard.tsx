/**
 * FlowbiteAuthorCard
 *
 * Redesigned author card using flowbite-react Card + Badge as the structural shell,
 * styled to match the user's SaaS dashboard spec (rounded-2xl, layered shadows,
 * coloured resource pills, clean divider). All existing functionality is preserved:
 *
 *   - Author photo (AvatarUpload with zoom-on-hover)
 *   - Category icon + colour-coded left border stripe
 *   - "Bio ready" flowbite Badge (color="success")
 *   - Resource pills: PDF (rose), Transcript (emerald), Binder (indigo), Supplemental (amber)
 *   - Mini book cover strip with Tooltip + lightbox/Drive click handlers
 *   - BookSubfolderRow list (content-type badges per book)
 *   - Google Drive ExternalLink icon on hover
 *   - Framer Motion 3-D tilt
 *   - onBioClick / onBookClick callbacks
 *   - Search highlight via <mark className="search-highlight">
 *   - Specialty subtitle extracted from " - " suffix in author.name
 *   - Canonical display name via canonicalName()
 */

import { useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Card, Badge } from "flowbite-react";
import {
  BookOpen,
  Briefcase,
  Brain,
  Handshake,
  Users2,
  Zap,
  MessageCircle,
  Cpu,
  TrendingUp,
  BookMarked,
  ExternalLink,
  UserCheck,
  Users,
  FileText,
  AlignLeft,
  Book,
  List,
  Package,
  Video,
  Image,
  Folder,
  Scroll,
  Newspaper,
  Link,
  File,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { AvatarUpload } from "@/components/AvatarUpload";
import { getAuthorPhoto } from "@/lib/authorPhotos";
import { canonicalName } from "@/lib/authorAliases";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CONTENT_TYPE_ICONS,
  CONTENT_TYPE_COLORS,
  type AuthorEntry,
} from "@/lib/libraryData";

// ── Shared LucideIcon type ─────────────────────────────────────────────────────

type LucideIcon = React.FC<{
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}>;

// ── Icon maps ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  briefcase: Briefcase as LucideIcon,
  brain: Brain as LucideIcon,
  handshake: Handshake as LucideIcon,
  users: Users2 as LucideIcon,
  zap: Zap as LucideIcon,
  "message-circle": MessageCircle as LucideIcon,
  cpu: Cpu as LucideIcon,
  "trending-up": TrendingUp as LucideIcon,
  "book-open": BookMarked as LucideIcon,
};

const CT_ICON_MAP: Record<string, LucideIcon> = {
  "file-text": FileText as LucideIcon,
  "book": Book as LucideIcon,
  "file": File as LucideIcon,
  "align-left": AlignLeft as LucideIcon,
  "video": Video as LucideIcon,
  "image": Image as LucideIcon,
  "package": Package as LucideIcon,
  "scroll": Scroll as LucideIcon,
  "newspaper": Newspaper as LucideIcon,
  "link": Link as LucideIcon,
  "list": List as LucideIcon,
  "folder": Folder as LucideIcon,
};

// ── Content-type normalisation ─────────────────────────────────────────────────

const DISPLAY_NAME_MAP: Record<string, string> = {
  "Additional DOC": "Supplemental",
  "PDF Extra": "PDF",
  "PDF Extra 2": "PDF",
  "PDF Extras": "PDF",
  "Complete Book in PDF": "PDF",
  "DOC": "Transcript",
  "ChatGPT": "Supplemental",
  "Sana AI": "Supplemental",
  "Notes": "Supplemental",
  "Knowledge Base": "Supplemental",
  "temp": "Supplemental",
  "Temp": "Supplemental",
  "TEMP": "Supplemental",
};

function normalizeContentTypes(raw: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [type, count] of Object.entries(raw)) {
    const normalized = DISPLAY_NAME_MAP[type] ?? type;
    result[normalized] = (result[normalized] ?? 0) + count;
  }
  return result;
}

// ── Resource pill colours (user spec) ─────────────────────────────────────────

const PILL_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  PDF:          { bg: "bg-rose-50",    text: "text-rose-600",    dot: "bg-rose-400" },
  Transcript:   { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-400" },
  Binder:       { bg: "bg-indigo-50",  text: "text-indigo-600",  dot: "bg-indigo-400" },
  Supplemental: { bg: "bg-amber-50",   text: "text-amber-600",   dot: "bg-amber-400" },
  Summary:      { bg: "bg-sky-50",     text: "text-sky-600",     dot: "bg-sky-400" },
  Video:        { bg: "bg-purple-50",  text: "text-purple-600",  dot: "bg-purple-400" },
  Images:       { bg: "bg-pink-50",    text: "text-pink-600",    dot: "bg-pink-400" },
  Papers:       { bg: "bg-teal-50",    text: "text-teal-600",    dot: "bg-teal-400" },
  Articles:     { bg: "bg-orange-50",  text: "text-orange-600",  dot: "bg-orange-400" },
  Links:        { bg: "bg-cyan-50",    text: "text-cyan-600",    dot: "bg-cyan-400" },
};

function ResourcePill({ type, count }: { type: string; count: number }) {
  const style = PILL_STYLES[type] ?? {
    bg: "bg-slate-50",
    text: "text-slate-600",
    dot: "bg-slate-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {type}
      {count > 1 && <span className="opacity-70 ml-0.5">{count}</span>}
    </span>
  );
}

// ── Book subfolder row ─────────────────────────────────────────────────────────

function ContentTypeBadge({ type, count }: { type: string; count: number }) {
  const iconName = CONTENT_TYPE_ICONS[type] ?? "folder";
  const color = CONTENT_TYPE_COLORS[type] ?? "#9ca3af";
  const Icon = (CT_ICON_MAP[iconName] ?? Folder) as LucideIcon;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: color + "18", color } as React.CSSProperties}
      title={`${type}: ${count} file${count !== 1 ? "s" : ""}`}
    >
      <Icon className="w-2.5 h-2.5" />
      {type}
      {count > 1 && <span className="opacity-60">·{count}</span>}
    </span>
  );
}

function BookSubfolderRow({
  book,
}: {
  book: { name: string; id: string; contentTypes: Record<string, number> };
}) {
  const hasContent = Object.keys(book.contentTypes).length > 0;
  const displayTitle = (() => {
    const dashIdx = book.name.lastIndexOf(" - ");
    return dashIdx !== -1 ? book.name.slice(0, dashIdx) : book.name;
  })();

  return (
    <a
      href={`https://drive.google.com/drive/folders/${book.id}?view=grid`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col gap-1 px-2 py-1.5 rounded-md hover:bg-slate-50 transition-colors group/book"
    >
      <div className="flex items-center gap-1.5">
        <BookOpen className="w-3 h-3 text-slate-400 flex-shrink-0 group-hover/book:text-slate-600 transition-colors" />
        <span className="text-[11px] font-medium leading-tight text-slate-600 group-hover/book:text-slate-900 transition-colors line-clamp-1 flex-1">
          {displayTitle}
        </span>
        <ExternalLink className="w-2.5 h-2.5 text-slate-400 opacity-0 group-hover/book:opacity-60 transition-opacity flex-shrink-0" />
      </div>
      {hasContent && (
        <div className="flex flex-wrap gap-1 pl-4">
          {Object.entries(normalizeContentTypes(book.contentTypes)).map(([type, count]) => (
            <ContentTypeBadge key={type} type={type} count={count} />
          ))}
        </div>
      )}
    </a>
  );
}

// ── 3-D tilt hook ─────────────────────────────────────────────────────────────

function useCardTilt(maxDeg = 14) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [maxDeg, -maxDeg]), {
    stiffness: 300,
    damping: 25,
    mass: 0.5,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-maxDeg, maxDeg]), {
    stiffness: 300,
    damping: 25,
    mass: 0.5,
  });
  const scale = useSpring(1, { stiffness: 300, damping: 25, mass: 0.5 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      x.set((e.clientX - rect.left) / rect.width - 0.5);
      y.set((e.clientY - rect.top) / rect.height - 0.5);
      scale.set(1.04);
    },
    [x, y, scale]
  );

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
    scale.set(1);
  }, [x, y, scale]);

  return { rotateX, rotateY, scale, handleMouseMove, handleMouseLeave };
}

// ── Highlight helper ───────────────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface FlowbiteAuthorCardProps {
  author: AuthorEntry;
  query: string;
  onBioClick: (a: AuthorEntry) => void;
  isEnriched?: boolean;
  coverMap?: Map<string, string>;
  onBookClick?: (bookId: string, titleKey: string) => void;
  dbPhotoMap?: Map<string, string>;
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FlowbiteAuthorCard({
  author,
  query,
  onBioClick,
  isEnriched,
  coverMap,
  onBookClick,
  dbPhotoMap,
}: FlowbiteAuthorCardProps) {
  const color = CATEGORY_COLORS[author.category] ?? "#64748b";
  const iconName = CATEGORY_ICONS[author.category] ?? "briefcase";
  const Icon = (ICON_MAP[iconName] ?? Briefcase) as LucideIcon;
  const driveUrl = `https://drive.google.com/drive/folders/${author.id}?view=grid`;

  const displayName = canonicalName(author.name);
  const specialty = author.name.includes(" - ")
    ? author.name.slice(author.name.indexOf(" - ") + 3)
    : "";

  const photoUrl =
    dbPhotoMap?.get(displayName.toLowerCase()) ?? getAuthorPhoto(displayName);

  const hasBooks = author.books && author.books.length > 0;

  // Aggregate resource counts across all books
  const resourceTotals = (() => {
    const totals: Record<string, number> = {};
    for (const book of author.books ?? []) {
      for (const [type, count] of Object.entries(
        normalizeContentTypes(book.contentTypes ?? {})
      )) {
        totals[type] = (totals[type] ?? 0) + count;
      }
    }
    return totals;
  })();

  const { rotateX, rotateY, scale, handleMouseMove, handleMouseLeave } = useCardTilt(10);

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="card-animate group h-full"
      style={{ rotateX, rotateY, scale, willChange: "transform" }}
    >
      {/*
       * flowbite-react Card provides the white rounded surface.
       * We add the category left-border stripe via inline style.
       * The user-spec shadow + hover lift is applied via className.
       */}
      <Card
        className="
          h-full overflow-hidden relative !p-0
          rounded-2xl border border-slate-100 bg-white
          shadow-[0_10px_35px_rgba(15,23,42,0.08)]
          transition-shadow duration-200 ease-out
          hover:shadow-[0_22px_55px_rgba(15,23,42,0.18)]
        "
        style={{ borderLeftWidth: 3, borderLeftColor: color }}
      >
        {/* Category watermark */}
        <div
          className="pointer-events-none absolute bottom-2 right-2 select-none"
          aria-hidden
        >
          <Icon
            style={{ width: 68, height: 68, color, opacity: 0.06 }}
            strokeWidth={1}
          />
        </div>

        {/* ── Clickable header ── */}
        <button
          onClick={() => onBioClick(author)}
          className="block w-full text-left px-4 pt-4 pb-3 cursor-pointer relative z-10 hover:bg-slate-50/60 transition-colors"
        >
          {/* Top row: category label + Drive link + Bio badge */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: color + "20" }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                style={{ color }}
              >
                {author.category}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {isEnriched && (
                <Badge color="success" className="text-[10px] shrink-0">
                  Bio ready
                </Badge>
              )}
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-0.5 rounded hover:bg-slate-100 transition-colors"
                title="Open in Google Drive"
              >
                <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 transition-opacity text-slate-400" />
              </a>
            </div>
          </div>

          {/* Author avatar + name + specialty */}
          <div className="flex items-center gap-3">
            <AvatarUpload authorName={displayName} currentPhotoUrl={photoUrl} size={40}>
              {(url) =>
                url ? (
                  <img
                    src={url}
                    alt={displayName}
                    className="h-9 w-9 rounded-full object-cover shadow-sm flex-shrink-0 ring-2 ring-offset-1"
                    style={{
                      "--tw-ring-color": color + "55",
                      transition:
                        "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease",
                      cursor: "pointer",
                    } as React.CSSProperties}
                    loading="lazy"
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.transform = "scale(2) translateZ(0)";
                      el.style.boxShadow = `0 8px 24px -4px ${color}66`;
                      el.style.zIndex = "50";
                      el.style.position = "relative";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.transform = "scale(1) translateZ(0)";
                      el.style.boxShadow = "";
                      el.style.zIndex = "";
                    }}
                  />
                ) : (
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm"
                    style={{
                      backgroundColor: color + "22",
                      color,
                      transition:
                        "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.4s ease",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.transform = "scale(2) translateZ(0)";
                      el.style.boxShadow = `0 8px 24px -4px ${color}66`;
                      el.style.zIndex = "50";
                      el.style.position = "relative";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.transform = "scale(1) translateZ(0)";
                      el.style.boxShadow = "";
                      el.style.zIndex = "";
                    }}
                  >
                    {displayName.charAt(0)}
                  </div>
                )
              }
            </AvatarUpload>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 leading-snug tracking-tight">
                <Highlight text={displayName} query={query} />
              </h3>
              {specialty && (
                <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  <Highlight text={specialty} query={query} />
                </p>
              )}
            </div>
          </div>

          {/* Bio status line */}
          <div className="mt-3 text-[11px]">
            {isEnriched ? (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <UserCheck className="w-3 h-3" />
                <span className="font-medium">Bio ready</span>
                <span className="text-emerald-500">· click to view</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-400">
                <Users className="w-3 h-3" />
                <span>Click to view bio &amp; links</span>
              </span>
            )}
          </div>
        </button>

        {/* ── Divider ── */}
        <div className="mx-4 h-px bg-slate-100" />

        {/* ── Books section ── */}
        {hasBooks && (
          <div className="px-4 py-3 relative z-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">
              Books ({author.books.length})
            </p>

            {/* Resource type pills */}
            {Object.keys(resourceTotals).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {Object.entries(resourceTotals).map(([type, count]) => (
                  <ResourcePill key={type} type={type} count={count} />
                ))}
              </div>
            )}

            {/* Mini book cover strip */}
            {coverMap && (
              <div className="flex gap-1.5 mb-2 overflow-x-auto pb-0.5 cover-strip-scroll">
                {author.books.map((book) => {
                  const titleKey = book.name.includes(" - ")
                    ? book.name.slice(0, book.name.lastIndexOf(" - ")).trim()
                    : book.name.trim();
                  const coverUrl = coverMap.get(titleKey);
                  return (
                    <Tooltip key={book.id} delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBookClick
                              ? onBookClick(book.id, titleKey)
                              : window.open(
                                  `https://drive.google.com/drive/folders/${book.id}?view=grid`,
                                  "_blank"
                                );
                          }}
                          className="flex-shrink-0 group/cover cursor-pointer"
                        >
                          {coverUrl ? (
                            <img
                              src={coverUrl}
                              alt={titleKey}
                              className="w-8 h-11 object-cover rounded shadow-sm ring-1 ring-slate-200 group-hover/cover:ring-2 transition-all duration-150"
                              style={
                                { "--tw-ring-color": color + "55" } as React.CSSProperties
                              }
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className="w-8 h-11 rounded shadow-sm ring-1 ring-slate-200 flex items-center justify-center group-hover/cover:ring-2 transition-all duration-150"
                              style={
                                {
                                  backgroundColor: color + "18",
                                  "--tw-ring-color": color + "55",
                                } as React.CSSProperties
                              }
                            >
                              <BookOpen
                                className="w-3.5 h-3.5"
                                style={{ color, opacity: 0.7 }}
                              />
                            </div>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        sideOffset={8}
                        className="p-0 bg-transparent border-0 shadow-none rounded-lg overflow-hidden"
                      >
                        <div
                          className="flex flex-col items-center gap-1.5 p-2 bg-white rounded-xl shadow-xl border border-slate-100"
                          style={{ backdropFilter: "blur(8px)" }}
                        >
                          {coverUrl ? (
                            <img
                              src={coverUrl}
                              alt={titleKey}
                              className="w-[90px] h-[126px] object-cover rounded-md shadow-md"
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className="w-[90px] h-[126px] rounded-md shadow-md flex items-center justify-center"
                              style={{ backgroundColor: color + "22" }}
                            >
                              <BookOpen
                                className="w-8 h-8"
                                style={{ color, opacity: 0.5 }}
                              />
                            </div>
                          )}
                          <p className="text-[10px] font-medium text-slate-700 text-center max-w-[90px] leading-tight line-clamp-2">
                            {titleKey}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            )}

            {/* Book subfolder rows */}
            <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
              {author.books.map((book) => (
                <BookSubfolderRow key={book.id} book={book} />
              ))}
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

export default FlowbiteAuthorCard;
