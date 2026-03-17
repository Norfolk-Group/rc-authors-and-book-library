/**
 * FlowbiteDemo — AuthorCard Pattern Showcase
 *
 * Demonstrates the Flowbite React AuthorCard pattern:
 *   - Card + Badge from flowbite-react
 *   - Responsive 4-column grid
 *   - Live search + category filter chips
 *   - Dark mode toggle (DarkThemeToggle)
 *   - Stats strip (total authors, enriched, categories)
 *   - Tooltip on content-type badges
 *   - Spinner loading state
 *   - Alert for empty search results
 */

import { useState, useMemo } from "react";
import {
  Card,
  Badge,
  TextInput,
  Button,
  DarkThemeToggle,
  Tooltip,
  Alert,
  Spinner,
  Progress,
  Avatar,
  HR,
} from "flowbite-react";
import {
  Search,
  BookOpen,
  Users,
  CheckCircle2,
  LayoutGrid,
  ArrowLeft,
  FileText,
  Headphones,
  Video,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";

// ── Sample data ────────────────────────────────────────────────────────────────

type ContentType = "PDF" | "Transcript" | "Audio" | "Video" | "Summary";

type Author = {
  id: number;
  name: string;
  category: string;
  books: number;
  hasBio: boolean;
  avatarInitials: string;
  avatarColor: string;
  contentTypes: ContentType[];
  specialty: string;
};

const SAMPLE_AUTHORS: Author[] = [
  {
    id: 1,
    name: "Adam Grant",
    category: "Leadership",
    books: 6,
    hasBio: true,
    avatarInitials: "AG",
    avatarColor: "bg-blue-500",
    contentTypes: ["PDF", "Transcript", "Audio"],
    specialty: "Organizational psychology & workplace culture",
  },
  {
    id: 2,
    name: "Brené Brown",
    category: "Leadership",
    books: 5,
    hasBio: true,
    avatarInitials: "BB",
    avatarColor: "bg-purple-500",
    contentTypes: ["PDF", "Video", "Transcript"],
    specialty: "Vulnerability, courage & authentic leadership",
  },
  {
    id: 3,
    name: "Simon Sinek",
    category: "Strategy",
    books: 4,
    hasBio: true,
    avatarInitials: "SS",
    avatarColor: "bg-cyan-600",
    contentTypes: ["PDF", "Audio"],
    specialty: "Purpose-driven leadership & the infinite game",
  },
  {
    id: 4,
    name: "Alex Hormozi",
    category: "Sales",
    books: 3,
    hasBio: false,
    avatarInitials: "AH",
    avatarColor: "bg-orange-500",
    contentTypes: ["PDF", "Summary"],
    specialty: "Offer creation, acquisition & business scaling",
  },
  {
    id: 5,
    name: "Daniel Kahneman",
    category: "Psychology",
    books: 2,
    hasBio: true,
    avatarInitials: "DK",
    avatarColor: "bg-green-600",
    contentTypes: ["PDF", "Transcript"],
    specialty: "Behavioral economics & cognitive biases",
  },
  {
    id: 6,
    name: "Ray Dalio",
    category: "Strategy",
    books: 3,
    hasBio: true,
    avatarInitials: "RD",
    avatarColor: "bg-yellow-600",
    contentTypes: ["PDF", "Audio", "Video"],
    specialty: "Principles-based management & macro investing",
  },
  {
    id: 7,
    name: "Malcolm Gladwell",
    category: "Psychology",
    books: 7,
    hasBio: true,
    avatarInitials: "MG",
    avatarColor: "bg-red-500",
    contentTypes: ["PDF", "Audio", "Transcript"],
    specialty: "Social dynamics, outliers & tipping points",
  },
  {
    id: 8,
    name: "Patrick Lencioni",
    category: "Leadership",
    books: 5,
    hasBio: false,
    avatarInitials: "PL",
    avatarColor: "bg-indigo-500",
    contentTypes: ["PDF", "Summary"],
    specialty: "Team dysfunction, trust & organizational health",
  },
  {
    id: 9,
    name: "James Clear",
    category: "Productivity",
    books: 1,
    hasBio: true,
    avatarInitials: "JC",
    avatarColor: "bg-teal-500",
    contentTypes: ["PDF", "Transcript", "Audio"],
    specialty: "Habit formation & compound improvement",
  },
  {
    id: 10,
    name: "Cal Newport",
    category: "Productivity",
    books: 4,
    hasBio: true,
    avatarInitials: "CN",
    avatarColor: "bg-slate-600",
    contentTypes: ["PDF", "Summary"],
    specialty: "Deep work, digital minimalism & focused success",
  },
  {
    id: 11,
    name: "Seth Godin",
    category: "Marketing",
    books: 8,
    hasBio: true,
    avatarInitials: "SG",
    avatarColor: "bg-pink-500",
    contentTypes: ["PDF", "Audio"],
    specialty: "Permission marketing, tribes & the purple cow",
  },
  {
    id: 12,
    name: "Nassim Taleb",
    category: "Strategy",
    books: 4,
    hasBio: false,
    avatarInitials: "NT",
    avatarColor: "bg-amber-600",
    contentTypes: ["PDF", "Transcript"],
    specialty: "Antifragility, black swans & risk asymmetry",
  },
];

const ALL_CATEGORIES = ["All", ...Array.from(new Set(SAMPLE_AUTHORS.map((a) => a.category))).sort()];

const CONTENT_TYPE_ICONS: Record<ContentType, React.ReactNode> = {
  PDF: <FileText className="w-3 h-3" />,
  Transcript: <FileText className="w-3 h-3" />,
  Audio: <Headphones className="w-3 h-3" />,
  Video: <Video className="w-3 h-3" />,
  Summary: <BookOpen className="w-3 h-3" />,
};

// ── AuthorCard component ────────────────────────────────────────────────────────

type AuthorCardProps = {
  author: Author;
  onClick: (author: Author) => void;
};

function AuthorCard({ author, onClick }: AuthorCardProps) {
  const { name, category, books, hasBio, avatarInitials, avatarColor, contentTypes, specialty } = author;

  return (
    <Card
      className="h-full cursor-pointer shadow-sm hover:shadow-lg transition-shadow duration-200 group"
      onClick={() => onClick(author)}
    >
      {/* Header: avatar + name + bio badge */}
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${avatarColor} transition-transform duration-200 group-hover:scale-110`}
        >
          {avatarInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                {category}
              </span>
              <h3 className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">
                {name}
              </h3>
            </div>
            {hasBio && (
              <Tooltip content="Bio enriched" placement="top">
                <Badge color="success" className="text-[10px] shrink-0">
                  Bio ready
                </Badge>
              </Tooltip>
            )}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-snug">
            {specialty}
          </p>
        </div>
      </div>

      <HR className="my-2" />

      {/* Footer: book count + content-type chips */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
          <BookOpen className="w-3.5 h-3.5" />
          {books} {books === 1 ? "book" : "books"}
        </span>
        <span className="flex gap-1 flex-wrap justify-end">
          {contentTypes.map((ct) => (
            <Tooltip key={ct} content={ct} placement="top">
              <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 text-[10px]">
                {CONTENT_TYPE_ICONS[ct]}
              </span>
            </Tooltip>
          ))}
        </span>
      </div>
    </Card>
  );
}

// ── Stats strip ────────────────────────────────────────────────────────────────

function StatsStrip({ authors }: { authors: Author[] }) {
  const enriched = authors.filter((a) => a.hasBio).length;
  const categories = new Set(authors.map((a) => a.category)).size;
  const totalBooks = authors.reduce((sum, a) => sum + a.books, 0);
  const enrichedPct = authors.length > 0 ? Math.round((enriched / authors.length) * 100) : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: "Authors", value: authors.length, icon: <Users className="w-4 h-4 text-cyan-500" /> },
        { label: "Books", value: totalBooks, icon: <BookOpen className="w-4 h-4 text-blue-500" /> },
        { label: "Categories", value: categories, icon: <LayoutGrid className="w-4 h-4 text-purple-500" /> },
        { label: "Enriched", value: `${enriched} / ${authors.length}`, icon: <CheckCircle2 className="w-4 h-4 text-green-500" /> },
      ].map(({ label, value, icon }) => (
        <Card key={label} className="py-3 px-4">
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{value}</p>
            </div>
          </div>
        </Card>
      ))}
      {/* Bio enrichment progress bar spanning full width */}
      <div className="col-span-2 sm:col-span-4">
        <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-1">
          <span>Bio enrichment progress</span>
          <span>{enrichedPct}%</span>
        </div>
        <Progress progress={enrichedPct} size="sm" color="cyan" />
      </div>
    </div>
  );
}

// ── Author detail modal (simple inline panel) ──────────────────────────────────

function AuthorDetailPanel({ author, onClose }: { author: Author; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0 ${author.avatarColor}`}
          >
            {author.avatarInitials}
          </div>
          <div className="flex-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              {author.category}
            </span>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{author.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{author.specialty}</p>
          </div>
          {author.hasBio && <Badge color="success">Bio ready</Badge>}
        </div>
        <HR />
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Books in library</span>
            <span className="font-semibold text-gray-900 dark:text-white">{author.books}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Content formats</span>
            <span className="flex gap-1">
              {author.contentTypes.map((ct) => (
                <Badge key={ct} color="gray" className="text-[10px]">{ct}</Badge>
              ))}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Bio status</span>
            <Badge color={author.hasBio ? "success" : "warning"}>
              {author.hasBio ? "Enriched" : "Pending"}
            </Badge>
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <Button color="blue" size="sm" className="flex-1">
            View books
            <ChevronRight className="ml-1 w-4 h-4" />
          </Button>
          <Button color="gray" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main demo page ─────────────────────────────────────────────────────────────

export default function FlowbiteDemo() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedAuthor, setSelectedAuthor] = useState<Author | null>(null);
  const [isLoading] = useState(false);

  const filtered = useMemo(() => {
    return SAMPLE_AUTHORS.filter((a) => {
      const matchesSearch =
        search.trim() === "" ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.specialty.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === "All" || a.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, activeCategory]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Page header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            color="gray"
            size="xs"
            onClick={() => navigate("/")}
            className="flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Button>
          <div>
            <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
              Flowbite React — AuthorCard Demo
            </h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Card · Badge · TextInput · Tooltip · Progress · DarkThemeToggle
            </p>
          </div>
        </div>
        <DarkThemeToggle />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats strip */}
        <StatsStrip authors={filtered} />

        {/* Search + category filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="flex-1">
            <TextInput
              icon={() => <Search className="w-4 h-4 text-gray-400" />}
              placeholder="Search authors or specialties…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sizing="sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {ALL_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activeCategory === cat
                    ? "bg-cyan-600 text-white border-cyan-600"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-cyan-400"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <Spinner size="xl" color="info" aria-label="Loading authors…" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filtered.length === 0 && (
          <Alert color="info" icon={() => <Search className="w-5 h-5" />}>
            <span className="font-medium">No authors found</span> — try a different search term or category.
          </Alert>
        )}

        {/* Card grid */}
        {!isLoading && filtered.length > 0 && (
          <>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              Showing {filtered.length} of {SAMPLE_AUTHORS.length} authors
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((author) => (
                <AuthorCard key={author.id} author={author} onClick={setSelectedAuthor} />
              ))}
            </div>
          </>
        )}

        {/* Code snippet section */}
        <div className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-8">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
            Component Pattern
          </h2>
          <Card className="bg-gray-900 dark:bg-gray-950 border-gray-700">
            <pre className="text-[11px] text-green-400 overflow-x-auto leading-relaxed font-mono whitespace-pre">
{`import { Card, Badge } from "flowbite-react";

export function AuthorCard({ name, category, books, hasBio }) {
  return (
    <Card className="h-full shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase text-cyan-600">
            {category}
          </span>
          <h3 className="mt-1 text-sm font-semibold text-gray-900">
            {name}
          </h3>
        </div>
        {hasBio && (
          <Badge color="success" className="text-[10px]">
            Bio ready
          </Badge>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
        <span>{books} books</span>
        <span className="flex gap-2">
          <span className="rounded-full bg-gray-100 px-2 py-0.5">PDF</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5">Transcript</span>
        </span>
      </div>
    </Card>
  );
}`}
            </pre>
          </Card>
        </div>

        {/* Component inventory */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
            Flowbite Components Used on This Page
          </h2>
          <div className="flex flex-wrap gap-2">
            {["Card", "Badge", "TextInput", "Button", "DarkThemeToggle", "Tooltip", "Alert", "Spinner", "Progress", "Avatar", "HR"].map(
              (c) => (
                <Badge key={c} color="indigo">
                  {c}
                </Badge>
              )
            )}
          </div>
        </div>
      </div>

      {/* Author detail panel */}
      {selectedAuthor && (
        <AuthorDetailPanel author={selectedAuthor} onClose={() => setSelectedAuthor(null)} />
      )}
    </div>
  );
}
