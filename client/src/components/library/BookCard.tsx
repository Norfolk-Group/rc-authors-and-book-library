/**
 * BookCard — individual book card for the Books tab.
 *
 * -- DESIGN RULES (mirrors FlowbiteAuthorCard) --
 *   - Centered cover as the visual anchor (like the author avatar)
 *   - Category pill at top (same row layout as author cards)
 *   - Title + author name below cover
 *   - Content-type badges in lower section (moved here from author cards)
 *   - Zero hardcoded hex/rgb values — CSS variable tokens only
 *
 * -- INTERACTION MODEL --
 *   1. Cover image     → click opens cover lightbox (zoom)
 *   2. Author name     → click navigates to author card in Authors tab
 *   3. Card surface    → click opens BookDetailPanel
 *   4. Drive icon      → opens Google Drive folder
 *
 * -- ANIMATIONS (framer-motion, already installed) --
 *   - Card: whileHover scale-up + shadow lift, whileTap scale-down
 *   - Cover: hover scale-[1.08], active scale-[0.94] (press feel)
 */

import { motion } from "framer-motion";
import {
  BookOpen,
  ExternalLink,
  BookMarked as BookMarkedIcon,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_ICONS, type BookRecord } from "@/lib/libraryData";
import { ICON_MAP } from "./libraryConstants";
import { ContentTypeBadge } from "./LibraryPrimitives";

interface BookCardProps {
  book: BookRecord;
  query: string;
  onDetailClick?: (b: BookRecord) => void;
  coverImageUrl?: string;
  isEnriched?: boolean;
  amazonUrl?: string;
  onCoverClick?: (url: string, title: string, color: string) => void;
  /** Called when user clicks the author name — navigates to author in Authors tab */
  onAuthorClick?: (authorName: string) => void;
  /** Used for scroll-to highlight — set to true when this card is the navigation target */
  isHighlighted?: boolean;
}

export function BookCard({
  book,
  query,
  onDetailClick,
  coverImageUrl,
  isEnriched,
  amazonUrl,
  onCoverClick,
  onAuthorClick,
  isHighlighted,
}: BookCardProps) {
  const color = CATEGORY_COLORS[book.category] ?? "hsl(var(--muted-foreground))";
  const iconName = CATEGORY_ICONS[book.category] ?? "book-open";
  const Icon = (ICON_MAP[iconName] ?? BookMarkedIcon) as LucideIcon;
  const driveUrl = `https://drive.google.com/drive/folders/${book.id}?view=grid`;
  const dashIdx = book.name.indexOf(" - ");
  const displayTitle = dashIdx !== -1 ? book.name.slice(0, dashIdx) : book.name;
  const bookAuthor = dashIdx !== -1 ? book.name.slice(dashIdx + 3) : "";
  const hasContent = Object.keys(book.contentTypes).length > 0;

  const highlight = (text: string) => {
    if (!query) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-transparent font-bold text-foreground">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <motion.div
      className="card-animate group relative cursor-pointer h-full"
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      onClick={() => onDetailClick?.(book)}
    >
      <div
        className={`
          h-full overflow-hidden relative
          bg-card text-card-foreground
          border border-border rounded-2xl
          shadow-sm hover:shadow-md
          transition-shadow duration-200
          flex flex-col items-stretch justify-start
          ${isHighlighted ? "ring-2 ring-offset-2" : ""}
        `}
        style={isHighlighted ? { '--tw-ring-color': color } as React.CSSProperties : undefined}
      >
        {/* Category watermark — presentational */}
        {!coverImageUrl && (
          <div className="pointer-events-none absolute bottom-2 right-2 select-none" aria-hidden>
            <Icon className="w-16 h-16 text-foreground opacity-[0.04]" strokeWidth={1} />
          </div>
        )}

        {/* ── Row 1: Category pill + Drive link ───────────────────────────── */}
        <div className="px-4 pt-4 pb-0 flex items-center justify-between gap-2 h-[28px] flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
              <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground truncate min-w-0"
              title={book.category}
            >
              {book.category}
            </p>
          </div>
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title="Open in Drive"
          >
            <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
          </a>
        </div>

        {/* ── Row 2: Cover (centered, like author avatar) ─────────────────── */}
        <div className="flex flex-col items-center gap-3 px-4 pt-4 pb-3 flex-shrink-0">
          {/* Cover image — HOTSPOT 1: click opens lightbox */}
          <div className="relative flex-shrink-0">
            {coverImageUrl ? (
              <motion.div
                className="cursor-zoom-in"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onCoverClick?.(coverImageUrl, displayTitle, color);
                }}
              >
                <img
                  src={coverImageUrl}
                  alt={displayTitle}
                  className="
                    h-[103px] w-[76px] object-cover rounded-lg shadow-md
                    ring-2 ring-border ring-offset-2
                  "
                  loading="lazy"
                />
              </motion.div>
            ) : (
              <motion.div
                className="
                  h-[103px] w-[76px] rounded-lg bg-muted shadow-md
                  ring-2 ring-border ring-offset-2
                  flex items-center justify-center
                "
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                <BookOpen className="w-8 h-8 text-muted-foreground" />
              </motion.div>
            )}
          </div>

          {/* Title + author name */}
          <div className="min-w-0 w-full text-center">
            <h3 className="text-sm font-bold text-card-foreground leading-snug tracking-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.06)]">
              {highlight(displayTitle)}
            </h3>
            {/* HOTSPOT 2: author name navigates to author card */}
            {bookAuthor && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAuthorClick?.(bookAuthor);
                }}
                className="
                  mt-1 text-xs text-muted-foreground hover:text-foreground
                  transition-colors underline-offset-2 hover:underline
                  cursor-pointer leading-relaxed
                "
              >
                <span className="font-medium">by</span> {highlight(bookAuthor)}
              </button>
            )}
          </div>

          {/* Enrichment status */}
          <div className="text-[11px] flex justify-center">
            {isEnriched ? (
              <span className="flex items-center gap-1.5 text-muted-foreground cursor-default">
                <BookMarkedIcon className="w-3 h-3 text-chart-5" />
                <span className="font-medium">Cover ready</span>
                <span className="opacity-60">· click for details</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <BookOpen className="w-3 h-3" />
                <span>Click for details</span>
              </span>
            )}
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        {hasContent && <div className="mx-4 h-px bg-border flex-shrink-0" />}

        {/* ── Row 3: Content-type badges (moved from Author card) ──────────── */}
        {hasContent && (
          <div className="px-4 py-3 relative z-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 cursor-default">
              Resources
            </p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(book.contentTypes).map(([type, count]) => (
                <ContentTypeBadge key={type} type={type} count={count} />
              ))}
            </div>
          </div>
        )}

        {/* Amazon badge */}
        {amazonUrl && (
          <a
            href={amazonUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="amazon-badge absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide text-white"
            style={{ backgroundColor: "#FF9900" }}
            title="View on Amazon"
          >
            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.699-3.182v.685zm3.186 7.705c-.209.189-.512.201-.745.074-1.047-.872-1.234-1.276-1.814-2.106-1.734 1.767-2.962 2.297-5.209 2.297-2.66 0-4.731-1.641-4.731-4.925 0-2.565 1.391-4.309 3.37-5.164 1.715-.754 4.11-.891 5.942-1.099v-.41c0-.753.06-1.642-.384-2.294-.385-.579-1.124-.82-1.775-.82-1.205 0-2.277.618-2.54 1.897-.054.285-.261.567-.549.582l-3.061-.333c-.259-.056-.548-.266-.472-.66C6.265 1.862 9.316.5 12.073.5c1.407 0 3.245.374 4.354 1.44 1.407 1.312 1.273 3.063 1.273 4.969v4.5c0 1.353.561 1.948 1.089 2.678.186.261.226.574-.009.769l-1.636 1.939z"/>
            </svg>
            Amazon
          </a>
        )}
      </div>
    </motion.div>
  );
}
