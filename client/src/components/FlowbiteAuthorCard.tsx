/**
 * FlowbiteAuthorCard
 *
 * Theme-compliant author card using flowbite-react Card + Badge + Modal.
 *
 * DESIGN RULES (absolute — no exceptions without explicit user request):
 *   - Zero hardcoded hex / rgb / rgba / hsl values
 *   - Zero Tailwind colour classes (rose-*, emerald-*, indigo-*, amber-*, slate-*, gray-*, etc.)
 *   - All colours from CSS variable tokens: bg-card, bg-muted, text-foreground,
 *     text-muted-foreground, border-border, shadow-sm/md/lg, ring-border
 *   - Category identity via icon + label only (no coloured stripes or tints)
 *   - Shadows are neutral — no RGBA colour tinting
 *   - Card content is top-justified (flex-col, items start at top)
 *
 * Features:
 *   - Avatar: hover:scale-[4] with smooth transition, click opens inline bio Modal
 *   - Bio Modal: Flowbite Modal with author photo, category, specialty, bio, links
 *   - Bio data: authorBios.json (JSON) → trpc.authorProfiles.get (DB) → auto-enrich
 *   - Resource pills: icon + label on bg-muted (no per-type colour coding)
 *   - Mini book cover strip with Tooltip enlarged preview
 *   - Framer Motion 3D tilt on card
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Card, Badge, Modal, ModalBody, ModalHeader } from "flowbite-react";
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
  Globe,
  Twitter,
  Linkedin,
  RefreshCw,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { AvatarUpload } from "@/components/AvatarUpload";
import { getAuthorPhoto } from "@/lib/authorPhotos";
import { canonicalName } from "@/lib/authorAliases";
import {
  CATEGORY_ICONS,
  CONTENT_TYPE_ICONS,
  type AuthorEntry,
} from "@/lib/libraryData";
import { trpc } from "@/lib/trpc";
import authorBios from "@/lib/authorBios.json";

// ── Shared LucideIcon type ─────────────────────────────────────────────────────

type LucideIcon = React.FC<{
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}>;

// ── Icon maps ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  briefcase:        Briefcase as LucideIcon,
  brain:            Brain as LucideIcon,
  handshake:        Handshake as LucideIcon,
  users:            Users2 as LucideIcon,
  zap:              Zap as LucideIcon,
  "message-circle": MessageCircle as LucideIcon,
  cpu:              Cpu as LucideIcon,
  "trending-up":    TrendingUp as LucideIcon,
  "book-open":      BookMarked as LucideIcon,
};

const CT_ICON_MAP: Record<string, LucideIcon> = {
  "file-text":  FileText as LucideIcon,
  "book":       Book as LucideIcon,
  "file":       File as LucideIcon,
  "align-left": AlignLeft as LucideIcon,
  "video":      Video as LucideIcon,
  "image":      Image as LucideIcon,
  "package":    Package as LucideIcon,
  "scroll":     Scroll as LucideIcon,
  "newspaper":  Newspaper as LucideIcon,
  "link":       Link as LucideIcon,
  "list":       List as LucideIcon,
  "folder":     Folder as LucideIcon,
};

// ── Content-type normalisation ─────────────────────────────────────────────────

const DISPLAY_NAME_MAP: Record<string, string> = {
  "Additional DOC":       "Supplemental",
  "PDF Extra":            "PDF",
  "PDF Extra 2":          "PDF",
  "PDF Extras":           "PDF",
  "Complete Book in PDF": "PDF",
  "DOC":                  "Transcript",
  "ChatGPT":              "Supplemental",
  "Sana AI":              "Supplemental",
  "Notes":                "Supplemental",
  "Knowledge Base":       "Supplemental",
  "temp":                 "Supplemental",
  "Temp":                 "Supplemental",
  "TEMP":                 "Supplemental",
};

function normalizeContentTypes(raw: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [type, count] of Object.entries(raw)) {
    const normalized = DISPLAY_NAME_MAP[type] ?? type;
    result[normalized] = (result[normalized] ?? 0) + count;
  }
  return result;
}

// ── Resource pill — theme-token only ──────────────────────────────────────────

function ResourcePill({ type, count }: { type: string; count: number }) {
  const iconName = CONTENT_TYPE_ICONS[type] ?? "folder";
  const Icon = (CT_ICON_MAP[iconName] ?? Folder) as LucideIcon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Icon className="w-3 h-3" />
      {type}
      {count > 1 && <span className="opacity-60 ml-0.5">{count}</span>}
    </span>
  );
}

// ── Book subfolder row ─────────────────────────────────────────────────────────

function ContentTypeBadge({ type, count }: { type: string; count: number }) {
  const iconName = CONTENT_TYPE_ICONS[type] ?? "folder";
  const Icon = (CT_ICON_MAP[iconName] ?? Folder) as LucideIcon;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-medium"
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
      className="flex flex-col gap-1 px-2 py-1.5 rounded-md hover:bg-accent transition-colors group/book"
    >
      <div className="flex items-center gap-1.5">
        <BookOpen className="w-3 h-3 text-muted-foreground flex-shrink-0 group-hover/book:text-foreground transition-colors" />
        <span className="text-[11px] font-medium leading-tight text-muted-foreground group-hover/book:text-foreground transition-colors line-clamp-1 flex-1">
          {displayTitle}
        </span>
        <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover/book:opacity-60 transition-opacity flex-shrink-0" />
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

function useCardTilt(maxDeg = 10) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [maxDeg, -maxDeg]), {
    stiffness: 300, damping: 25, mass: 0.5,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-maxDeg, maxDeg]), {
    stiffness: 300, damping: 25, mass: 0.5,
  });
  const scale = useSpring(1, { stiffness: 300, damping: 25, mass: 0.5 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      x.set((e.clientX - rect.left) / rect.width - 0.5);
      y.set((e.clientY - rect.top) / rect.height - 0.5);
      scale.set(1.03);
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

// ── Inline bio modal ───────────────────────────────────────────────────────────

function AuthorBioModal({
  open,
  onClose,
  displayName,
  specialty,
  category,
  photoUrl,
  Icon,
}: {
  open: boolean;
  onClose: () => void;
  displayName: string;
  specialty: string;
  category: string;
  photoUrl: string | null;
  Icon: LucideIcon;
}) {
  const jsonBio = (authorBios as Record<string, string>)[displayName] ?? null;

  const { data: profile, isLoading } = trpc.authorProfiles.get.useQuery(
    { authorName: displayName },
    { enabled: open && !jsonBio }
  );

  const enrichMutation = trpc.authorProfiles.enrich.useMutation();
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (open && !jsonBio && !isLoading && !profile && !hasTriggered.current) {
      hasTriggered.current = true;
      enrichMutation.mutate({ authorName: displayName });
    }
  }, [open, jsonBio, isLoading, profile]);

  const bioText = jsonBio ?? profile?.bio ?? null;
  const isBioLoading = !jsonBio && (isLoading || enrichMutation.isPending);

  return (
    <Modal show={open} size="md" onClose={onClose} popup>
      <ModalHeader>
        <span className="text-sm font-semibold text-card-foreground">{displayName}</span>
      </ModalHeader>
      <ModalBody>
        <div className="flex flex-col gap-4 text-sm">
          {/* Author header: photo + category + specialty */}
          <div className="flex items-center gap-3">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={displayName}
                className="h-14 w-14 rounded-full object-cover shadow-sm ring-2 ring-border ring-offset-1 flex-shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-xl font-bold text-muted-foreground flex-shrink-0 ring-2 ring-border ring-offset-1">
                {displayName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </span>
              </div>
              {specialty && (
                <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                  {specialty}
                </p>
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Bio */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              About
            </p>
            {isBioLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">Loading bio…</span>
              </div>
            ) : bioText ? (
              <p className="text-sm leading-relaxed text-card-foreground">{bioText}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No bio available yet.</p>
            )}
          </div>

          {/* Links */}
          {profile && (profile.websiteUrl || profile.twitterUrl || profile.linkedinUrl) && (
            <>
              <div className="h-px bg-border" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Links
                </p>
                <div className="flex flex-col gap-1.5">
                  {profile.websiteUrl && (
                    <a
                      href={profile.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-primary hover:underline"
                    >
                      <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                      {profile.websiteUrl.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  )}
                  {profile.twitterUrl && (
                    <a
                      href={profile.twitterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-primary hover:underline"
                    >
                      <Twitter className="w-3.5 h-3.5 flex-shrink-0" />
                      Twitter / X
                    </a>
                  )}
                  {profile.linkedinUrl && (
                    <a
                      href={profile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-primary hover:underline"
                    >
                      <Linkedin className="w-3.5 h-3.5 flex-shrink-0" />
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </ModalBody>
    </Modal>
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
  const iconName = CATEGORY_ICONS[author.category] ?? "briefcase";
  const Icon = (ICON_MAP[iconName] ?? Briefcase) as LucideIcon;
  const driveUrl = `https://drive.google.com/drive/folders/${author.id}?view=grid`;

  const displayName = canonicalName(author.name);
  const specialty = author.name.includes(" - ")
    ? author.name.slice(author.name.indexOf(" - ") + 3)
    : "";

  const photoUrl =
    dbPhotoMap?.get(displayName.toLowerCase()) ?? getAuthorPhoto(displayName) ?? null;

  const hasBooks = author.books && author.books.length > 0;

  // ── Avatar bio modal state ──
  const [openBio, setOpenBio] = useState(false);
  const handleAvatarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenBio(true);
  }, []);

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
    <>
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="card-animate group h-full"
        style={{ rotateX, rotateY, scale, willChange: "transform" }}
      >
        {/*
         * Card layout: flex-col with items-start ensures all content stacks
         * from the top — no vertical centering regardless of card height.
         */}
        <Card
          className="
            h-full overflow-hidden relative !p-0
            bg-card text-card-foreground
            border border-border rounded-2xl
            shadow-sm hover:shadow-md
            transition-shadow duration-200
            flex flex-col items-stretch justify-start
          "
        >
          {/* Category watermark — neutral opacity, no colour tint */}
          <div
            className="pointer-events-none absolute bottom-2 right-2 select-none"
            aria-hidden
          >
            <Icon className="w-16 h-16 text-foreground opacity-[0.04]" strokeWidth={1} />
          </div>

          {/* ── Clickable header (opens full bio panel in parent) ── */}
          <button
            onClick={() => onBioClick(author)}
            className="block w-full text-left px-4 pt-4 pb-3 cursor-pointer relative z-10 hover:bg-accent transition-colors flex-shrink-0"
          >
            {/* Top row: category icon + label + Drive link + Bio badge */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
                  className="p-0.5 rounded hover:bg-muted transition-colors"
                  title="Open in Google Drive"
                >
                  <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 transition-opacity text-muted-foreground" />
                </a>
              </div>
            </div>

            {/* Author avatar + name + specialty */}
            <div className="flex items-start gap-3">
              {/* Avatar with 4× hover scale — click opens bio modal */}
              <div className="relative h-9 w-9 flex-shrink-0">
                <AvatarUpload authorName={displayName} currentPhotoUrl={photoUrl} size={40}>
                  {(url) =>
                    url ? (
                      <img
                        src={url}
                        alt={displayName}
                        onClick={handleAvatarClick}
                        className="
                          h-9 w-9 rounded-full object-cover shadow-sm
                          ring-2 ring-border ring-offset-1
                          transition-transform duration-300 ease-out
                          hover:scale-[4]
                          origin-center
                          cursor-pointer
                          relative z-20
                        "
                        loading="lazy"
                      />
                    ) : (
                      <div
                        onClick={handleAvatarClick}
                        className="
                          h-9 w-9 rounded-full bg-muted text-muted-foreground
                          flex items-center justify-center text-sm font-bold
                          ring-2 ring-border ring-offset-1
                          transition-transform duration-300 ease-out
                          hover:scale-[4]
                          origin-center
                          cursor-pointer
                          relative z-20
                        "
                      >
                        {displayName.charAt(0)}
                      </div>
                    )
                  }
                </AvatarUpload>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-card-foreground leading-snug tracking-tight">
                  <Highlight text={displayName} query={query} />
                </h3>
                {specialty && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    <Highlight text={specialty} query={query} />
                  </p>
                )}
              </div>
            </div>

            {/* Bio status line */}
            <div className="mt-3 text-[11px]">
              {isEnriched ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <UserCheck className="w-3 h-3" />
                  <span className="font-medium">Bio ready</span>
                  <span className="opacity-60">· click to view</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-3 h-3" />
                  <span>Click to view bio &amp; links</span>
                </span>
              )}
            </div>
          </button>

          {/* ── Divider ── */}
          <div className="mx-4 h-px bg-border flex-shrink-0" />

          {/* ── Books section — top-justified, grows naturally ── */}
          {hasBooks && (
            <div className="px-4 py-3 relative z-10 flex flex-col items-start gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Books ({author.books.length})
              </p>

              {/* Resource type pills */}
              {Object.keys(resourceTotals).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(resourceTotals).map(([type, count]) => (
                    <ResourcePill key={type} type={type} count={count} />
                  ))}
                </div>
              )}

              {/* Mini book cover strip */}
              {coverMap && (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 cover-strip-scroll w-full">
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
                                className="w-8 h-11 object-cover rounded shadow-sm ring-1 ring-border group-hover/cover:ring-2 group-hover/cover:shadow-md transition-all duration-150"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-8 h-11 rounded shadow-sm ring-1 ring-border bg-muted flex items-center justify-center group-hover/cover:ring-2 group-hover/cover:shadow-md transition-all duration-150">
                                <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          sideOffset={8}
                          className="p-0 bg-transparent border-0 shadow-none rounded-lg overflow-hidden"
                        >
                          <div className="flex flex-col items-center gap-1.5 p-2 bg-card border border-border rounded-xl shadow-lg">
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                alt={titleKey}
                                className="w-[90px] h-[126px] object-cover rounded-md shadow-md"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-[90px] h-[126px] rounded-md bg-muted flex items-center justify-center">
                                <BookOpen className="w-8 h-8 text-muted-foreground opacity-40" />
                              </div>
                            )}
                            <p className="text-[10px] font-medium text-card-foreground text-center max-w-[90px] leading-tight line-clamp-2">
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
              <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto w-full">
                {author.books.map((book) => (
                  <BookSubfolderRow key={book.id} book={book} />
                ))}
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ── Flowbite bio modal — rendered outside the card to avoid stacking context issues ── */}
      <AuthorBioModal
        open={openBio}
        onClose={() => setOpenBio(false)}
        displayName={displayName}
        specialty={specialty}
        category={author.category}
        photoUrl={photoUrl}
        Icon={Icon}
      />
    </>
  );
}

export default FlowbiteAuthorCard;
