/**
 * AuthorAccordionRow — compact single-row author entry for the accordion/list view.
 *
 * Collapsed: avatar · name · category icon · book count · resource pill counts
 * Expanded:  + mini cover strip, bio status, specialty, and action links
 *
 * Design rules:
 * - Zero hardcoded colours — all CSS token classes only
 * - Category identity via icon only (no colour fills)
 * - Smooth height animation via max-height transition
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  UserCheck,
  Users,
  FileText,
  Headphones,
  File,
  AlignLeft,
  Video,
  Image,
  Package,
  Folder,
  Briefcase,
  Brain,
  Handshake,
  Users2,
  Zap,
  MessageCircle,
  Cpu,
  TrendingUp,
  BookMarked,
} from "lucide-react";
import {
  CATEGORY_ICONS,
  type AuthorEntry,
} from "@/lib/libraryData";
import { canonicalName } from "@/lib/authorAliases";

// Inline Highlight component (no external dep)
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-transparent font-bold text-foreground">{p}</mark>
        ) : (
          p
        )
      )}
    </>
  );
}

// ── LucideIcon type ────────────────────────────────────────────────────────────

type LucideIcon = React.FC<{
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}>;

// ── Icon maps ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Briefcase,
  Brain,
  Handshake,
  Users2,
  Zap,
  MessageCircle,
  Cpu,
  TrendingUp,
  BookMarked,
};

const CT_ICON_MAP: Record<string, LucideIcon> = {
  pdf: FileText,
  transcript: AlignLeft,
  binder: File,
  supplemental: Package,
  audio: Headphones,
  video: Video,
  image: Image,
  folder: Folder,
};

function getCTIcon(type: string): LucideIcon {
  const key = type.toLowerCase();
  for (const [k, v] of Object.entries(CT_ICON_MAP)) {
    if (key.includes(k)) return v;
  }
  return BookOpen;
}

// ── Normalise content-type keys ───────────────────────────────────────────────

function normalizeContentTypes(raw: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : 0;
    if (!isNaN(n) && n > 0) out[k] = n;
  }
  return out;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface AuthorAccordionRowProps {
  author: AuthorEntry;
  query: string;
  isEnriched: boolean;
  coverMap?: Map<string, string>;
  dbPhotoMap?: Map<string, string>;
  onBioClick: (author: AuthorEntry) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AuthorAccordionRow({
  author,
  query,
  isEnriched,
  coverMap,
  dbPhotoMap,
  onBioClick,
}: AuthorAccordionRowProps) {
  const [open, setOpen] = useState(false);

  const displayName = useMemo(() => {
    const base = author.name.includes(" - ")
      ? author.name.slice(0, author.name.indexOf(" - "))
      : author.name;
    return canonicalName(base);
  }, [author.name]);

  const specialty = useMemo(() => {
    if (!author.name.includes(" - ")) return undefined;
    const raw = author.name.slice(author.name.indexOf(" - ") + 3);
    return raw.trim() || undefined;
  }, [author.name]);

  const iconName = CATEGORY_ICONS[author.category] ?? "BookMarked";
  const Icon = (ICON_MAP[iconName] ?? BookOpen) as LucideIcon;

  // Photo: prefer DB photo, then static map
  const photoUrl = useMemo(() => {
    const canon = canonicalName(displayName);
    return dbPhotoMap?.get(canon) ?? dbPhotoMap?.get(displayName) ?? null;
  }, [displayName, dbPhotoMap]);

  // Deduplicated books
  const dedupedBooks = useMemo(() => {
    const seen = new Set<string>();
    return (author.books ?? []).filter((book) => {
      const tk = book.name.includes(" - ")
        ? book.name.slice(0, book.name.lastIndexOf(" - ")).trim()
        : book.name.trim();
      if (seen.has(tk)) return false;
      seen.add(tk);
      return true;
    });
  }, [author.books]);

  // Aggregate content-type totals
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const book of author.books) {
      const cts = normalizeContentTypes(book.contentTypes ?? {});
      for (const [k, v] of Object.entries(cts)) {
        t[k] = (t[k] ?? 0) + v;
      }
    }
    return t;
  }, [author.books]);

  const totalFiles = Object.values(totals).reduce((s, n) => s + n, 0);

  return (
    <div className="border-b border-border last:border-0">
      {/* ── Collapsed row ── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="
          w-full flex items-center gap-3 px-3 py-2.5
          hover:bg-muted/50 transition-colors text-left
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        "
        aria-expanded={open}
      >
        {/* Expand chevron */}
        <span className="flex-shrink-0 text-muted-foreground">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </span>

        {/* Avatar */}
        <div className="relative h-7 w-7 flex-shrink-0">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={displayName}
              className="h-7 w-7 rounded-full object-cover ring-1 ring-border"
              loading="lazy"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-muted ring-1 ring-border flex items-center justify-center text-[10px] font-bold text-muted-foreground">
              {displayName.charAt(0)}
            </div>
          )}
        </div>

        {/* Name */}
        <span className="flex-1 min-w-0 text-sm font-medium text-card-foreground truncate">
          <Highlight text={displayName} query={query} />
        </span>

        {/* Category icon */}
        <Icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />

        {/* Book count */}
        <span className="flex-shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground">
          <BookOpen className="w-3 h-3" />
          {dedupedBooks.length}
        </span>

        {/* File count */}
        {totalFiles > 0 && (
          <span className="flex-shrink-0 text-[11px] text-muted-foreground">
            {totalFiles} files
          </span>
        )}

        {/* Bio indicator */}
        {isEnriched && (
          <UserCheck className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* ── Expanded panel ── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-10 pb-3 flex flex-col gap-3">
              {/* Specialty */}
              {specialty && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">{specialty}</p>
              )}

              {/* Mini cover strip */}
              {coverMap && dedupedBooks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {dedupedBooks.map((book) => {
                    const titleKey = book.name.includes(" - ")
                      ? book.name.slice(0, book.name.lastIndexOf(" - ")).trim()
                      : book.name.trim();
                    const coverUrl = coverMap.get(titleKey);
                    return (
                      <div key={book.id} className="relative h-10 w-7 flex-shrink-0" title={titleKey}>
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={titleKey}
                            className="
                              h-full w-full rounded-sm object-cover shadow-sm
                              ring-1 ring-border
                              transition-transform duration-300 ease-out
                              hover:scale-[3]
                              origin-center cursor-pointer relative z-20
                            "
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full rounded-sm bg-muted ring-1 ring-border flex items-center justify-center">
                            <BookOpen className="w-3 h-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Content-type pills */}
              {Object.keys(totals).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(totals).map(([type, count]) => {
                    const CTIcon = getCTIcon(type);
                    return (
                      <span
                        key={type}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        <CTIcon className="w-2.5 h-2.5" />
                        {type} · {count}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onBioClick(author); }}
                  className="flex items-center gap-1.5 text-[11px] text-primary hover:underline"
                >
                  {isEnriched ? (
                    <><UserCheck className="w-3 h-3" /> View bio &amp; links</>
                  ) : (
                    <><Users className="w-3 h-3" /> View bio &amp; links</>
                  )}
                </button>
                <a
                  href={`https://drive.google.com/drive/folders/${author.id}?view=grid`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1.5 text-[11px] text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open in Drive
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AuthorAccordionRow;
