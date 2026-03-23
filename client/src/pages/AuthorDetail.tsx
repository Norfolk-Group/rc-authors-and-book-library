/**
 * AuthorDetail — Dedicated full-page view for a single author.
 * Route: /author/:slug  (slug = URL-encoded canonical name)
 *
 * Sections:
 *   1. PageHeader breadcrumb (← Home › Authors › [Name])
 *   2. Hero: large avatar, name, category pill, specialty, Drive link
 *   3. Wikipedia summary card (thumbnail + description + monthly views)
 *   4. Bio
 *   5. Social Stats badges row
 *   6. Platform Presence (PlatformPills)
 *   7. Books grid with covers, ratings, summaries
 *   8. Footer with Drive link
 *
 * Deep-link: /author/Adam%20Grant
 * Share: copy URL from address bar
 */

import { useMemo, useRef, useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { PlatformPills } from "@/components/library/PlatformPills";
import {
  BookOpen,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Eye,
  FileText,
  Users,
  BarChart2,
  Star,
  Calendar,
  Building2,
} from "lucide-react";
import { AUTHORS, CATEGORY_COLORS } from "@/lib/libraryData";
import { canonicalName } from "@/lib/authorAliases";
import { getAuthorAvatar } from "@/lib/authorAvatars";
import { AvatarUpload } from "@/components/AvatarUpload";
import { fireConfetti } from "@/hooks/useConfetti";
import authorBios from "@/lib/authorBios.json";
import { useAppSettings } from "@/contexts/AppSettingsContext";
import type { SocialStatsResult } from "../../../server/enrichment/socialStats";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCount(n: number | null | undefined): string | null {
  if (n == null || n === 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface StatBadgeProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatBadge({ icon, label, value }: StatBadgeProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border shadow-sm">
      <span className="text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">{label}</p>
        <p className="text-sm font-bold text-foreground leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ── Book card ─────────────────────────────────────────────────────────────────

interface BookCardProps {
  bookName: string;
  bookId: string;
  authorName: string;
}

function BookCard({ bookName, bookId, authorName }: BookCardProps) {
  const cleanTitle = bookName.split(" - ")[0];
  const driveUrl = `https://drive.google.com/drive/folders/${bookId}?view=grid`;

  const { data: profile } = trpc.bookProfiles.get.useQuery(
    { bookTitle: cleanTitle },
    { staleTime: 300_000 }
  );

  const coverUrl = profile?.s3CoverUrl ?? profile?.coverImageUrl ?? null;
  const rating = profile?.rating ? parseFloat(String(profile.rating)) : null;
  const publishedYear = profile?.publishedDate ? profile.publishedDate.substring(0, 4) : null;

  return (
    <a
      href={driveUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200"
    >
      {/* Cover */}
      <div className="flex-shrink-0 w-14 h-20 rounded-lg overflow-hidden bg-muted border border-border/50 flex items-center justify-center">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={cleanTitle}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <BookOpen className="w-6 h-6 text-muted-foreground/40" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {cleanTitle}
          </p>
          {profile?.summary && (
            <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2">
              {profile.summary}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {rating && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-semibold">
              <Star className="w-2.5 h-2.5 fill-amber-500" />
              {rating.toFixed(1)}
            </span>
          )}
          {publishedYear && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Calendar className="w-2.5 h-2.5" />
              {publishedYear}
            </span>
          )}
          {profile?.publisher && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Building2 className="w-2.5 h-2.5" />
              <span className="truncate max-w-[80px]">{profile.publisher}</span>
            </span>
          )}
          <ExternalLink className="w-2.5 h-2.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
        </div>
      </div>
    </a>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AuthorDetail() {
  const params = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const rawSlug = params.slug ?? "";
  const decodedName = decodeURIComponent(rawSlug);

  // Find the author entry from libraryData
  const author = useMemo(() => {
    const canonical = canonicalName(decodedName);
    return AUTHORS.find((a) => canonicalName(a.name) === canonical) ?? null;
  }, [decodedName]);

  const displayName = author ? canonicalName(author.name) : decodedName;
  const specialty = author?.name.includes(" - ")
    ? author.name.slice(author.name.indexOf(" - ") + 3)
    : "";
  const color = author ? (CATEGORY_COLORS[author.category] ?? "hsl(var(--muted-foreground))") : "hsl(var(--muted-foreground))";
  const avatarUrl = getAuthorAvatar(displayName);
  const driveUrl = author ? `https://drive.google.com/drive/folders/${author.id}?view=grid` : null;

  const jsonBio = (authorBios as Record<string, string>)[displayName] ?? null;

  const { data: profile, isLoading } = trpc.authorProfiles.get.useQuery(
    { authorName: displayName },
    { staleTime: 60_000 }
  );

  const { settings } = useAppSettings();
  const enrichMutation = trpc.authorProfiles.enrich.useMutation({
    onError: (e) => toast.error("Failed to load bio: " + e.message),
  });

  const [generatedPhotoUrl, setGeneratedPhotoUrl] = useState<string | null>(null);
  const generateAvatarMutation = trpc.authorProfiles.generateAvatar.useMutation({
    onSuccess: (data) => {
      setGeneratedPhotoUrl(data.url);
      toast.success("AI avatar generated and saved!");
      fireConfetti("avatar");
    },
    onError: (e) => toast.error("Avatar generation failed: " + e.message),
  });

  const hasTriggered = useRef(false);
  useEffect(() => {
    if (!jsonBio && !isLoading && !profile && !hasTriggered.current) {
      hasTriggered.current = true;
      enrichMutation.mutate({
        authorName: displayName,
        model: settings.authorResearchModel || settings.primaryModel || undefined,
        secondaryModel:
          settings.authorResearchSecondaryEnabled && settings.authorResearchSecondaryModel
            ? settings.authorResearchSecondaryModel
            : undefined,
      });
    }
  }, [jsonBio, isLoading, profile]);

  const effectiveAvatarUrl =
    generatedPhotoUrl ?? profile?.s3AvatarUrl ?? profile?.avatarUrl ?? avatarUrl;

  // Parse social stats
  const socialStats: SocialStatsResult | null = useMemo(() => {
    try {
      return profile?.socialStatsJson ? JSON.parse(profile.socialStatsJson) : null;
    } catch {
      return null;
    }
  }, [profile?.socialStatsJson]);

  const wiki = socialStats?.wikipedia;
  const wikiViews = formatCount(wiki?.avgMonthlyViews);

  const platformLinks = profile
    ? {
        websiteUrl: profile.websiteUrl,
        businessWebsiteUrl: profile.businessWebsiteUrl,
        youtubeUrl: profile.youtubeUrl,
        twitterUrl: profile.twitterUrl,
        linkedinUrl: profile.linkedinUrl,
        substackUrl: profile.substackUrl,
        facebookUrl: profile.facebookUrl,
        instagramUrl: profile.instagramUrl,
        tiktokUrl: profile.tiktokUrl,
        githubUrl: profile.githubUrl,
        podcastUrl: profile.podcastUrl,
        newsletterUrl: profile.newsletterUrl,
        speakingUrl: profile.speakingUrl,
        blogUrl: profile.blogUrl,
      }
    : null;

  const hasPlatformLinks = platformLinks && Object.values(platformLinks).some(Boolean);

  // Stat badges
  const statBadges: StatBadgeProps[] = useMemo(() => {
    const badges: StatBadgeProps[] = [];
    if (socialStats?.github?.followers) {
      const fmt = formatCount(socialStats.github.followers);
      if (fmt) badges.push({ icon: <Users className="w-4 h-4" />, label: "GitHub", value: `${fmt} followers` });
    }
    if (socialStats?.substack?.postCount) {
      badges.push({ icon: <FileText className="w-4 h-4" />, label: "Substack", value: `${socialStats.substack.postCount} posts` });
    }
    if (wikiViews) {
      badges.push({ icon: <Eye className="w-4 h-4" />, label: "Wikipedia", value: `${wikiViews}/mo views` });
    }
    if (socialStats?.linkedin?.followerCount) {
      const fmt = formatCount(socialStats.linkedin.followerCount);
      if (fmt) badges.push({ icon: <BarChart2 className="w-4 h-4" />, label: "LinkedIn", value: `${fmt} followers` });
    }
    return badges;
  }, [socialStats, wikiViews]);

  const bioText = jsonBio ?? profile?.bio ?? null;
  const isBioLoading = !jsonBio && (isLoading || enrichMutation.isPending);

  // 404 guard
  if (!author && !isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader crumbs={[{ label: "Authors", href: "/" }, { label: "Not Found" }]} />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold mb-2">Author not found</h1>
          <p className="text-muted-foreground mb-6">No author named "{decodedName}" exists in the library.</p>
          <button
            onClick={() => setLocation("/")}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Breadcrumb ── */}
      <PageHeader
        crumbs={[
          { label: "Authors", href: "/" },
          { label: displayName },
        ]}
      />

      <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
        {/* ── Hero ── */}
        <section className="flex items-start gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0 group/avatar">
            <AvatarUpload authorName={displayName} currentAvatarUrl={effectiveAvatarUrl} size={96}>
              {(url) =>
                url ? (
                  <img
                    src={url}
                    alt={displayName}
                    className="w-24 h-24 rounded-2xl object-cover ring-2 ring-offset-2 shadow-lg"
                    style={{ "--tw-ring-color": color + "66" } as React.CSSProperties}
                  />
                ) : (
                  <div
                    className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-lg"
                    style={{ backgroundColor: color + "22", color }}
                  >
                    {displayName.charAt(0)}
                  </div>
                )
              }
            </AvatarUpload>
            {!effectiveAvatarUrl && (
              <button
                onClick={() =>
                  generateAvatarMutation.mutate({
                    authorName: displayName,
                    bgColor: settings.avatarBgColor,
                    avatarGenVendor: settings.avatarGenVendor,
                    avatarGenModel: settings.avatarGenModel,
                    avatarResearchVendor: settings.avatarResearchVendor,
                    avatarResearchModel: settings.avatarResearchModel,
                  })
                }
                disabled={generateAvatarMutation.isPending}
                title="Generate AI avatar"
                className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full flex items-center justify-center shadow-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
              >
                {generateAvatarMutation.isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 sparkle-spin" style={{ color }} />
                )}
              </button>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {author && (
                <span
                  className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: color + "22", color }}
                >
                  {author.category}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold font-display leading-tight text-foreground">{displayName}</h1>
            {specialty && (
              <p className="text-sm text-muted-foreground mt-1">{specialty}</p>
            )}
            {author && (
              <p className="text-xs text-muted-foreground mt-2">
                {author.books.length} book{author.books.length !== 1 ? "s" : ""} in library
              </p>
            )}
            {driveUrl && (
              <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-primary hover:underline font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                Open in Google Drive
              </a>
            )}
          </div>
        </section>

        {/* ── Wikipedia Summary Card ── */}
        {wiki && (wiki.description || wiki.extract || wiki.thumbnailUrl) && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Wikipedia</h2>
            <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex gap-4 p-4">
                {wiki.thumbnailUrl && (
                  <a href={wiki.pageUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                    <img
                      src={wiki.thumbnailUrl}
                      alt={`${displayName} on Wikipedia`}
                      className="w-20 h-20 rounded-xl object-cover ring-1 ring-border hover:ring-primary transition-all duration-200 hover:scale-105"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </a>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Wikipedia</span>
                    {wikiViews && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                        <Eye className="w-2.5 h-2.5" />
                        {wikiViews}/mo
                      </span>
                    )}
                  </div>
                  {wiki.description && (
                    <p className="text-sm font-semibold text-foreground leading-snug mb-1.5">{wiki.description}</p>
                  )}
                  {wiki.extract && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">{wiki.extract}</p>
                  )}
                  {wiki.pageUrl && (
                    <a
                      href={wiki.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2 font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Read on Wikipedia
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Bio ── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">About</h2>
          {isBioLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Loading bio…
            </div>
          ) : bioText ? (
            <p className="text-sm leading-relaxed text-foreground/80">{bioText}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No bio available yet.</p>
          )}
        </section>

        {/* ── Social Stats Badges ── */}
        {statBadges.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Social Presence</h2>
            <div className="flex flex-wrap gap-2">
              {statBadges.map((badge) => (
                <StatBadge key={badge.label} {...badge} />
              ))}
            </div>
          </section>
        )}

        {/* ── Platform Presence ── */}
        {hasPlatformLinks && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Platform Presence</h2>
            <div className="p-4 rounded-2xl border border-border bg-card shadow-sm">
              <PlatformPills
                links={platformLinks!}
                socialStats={socialStats}
                maxVisible={20}
                size="md"
              />
            </div>
          </section>
        )}

        {/* ── Books ── */}
        {author && author.books.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              Books in Library ({author.books.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {author.books.map((book) => (
                <BookCard
                  key={book.id}
                  bookName={book.name}
                  bookId={book.id}
                  authorName={displayName}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Footer ── */}
        <div className="flex gap-3 pt-2 pb-8">
          <button
            onClick={() => setLocation("/")}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium bg-muted hover:bg-muted/80 transition-colors border border-border"
          >
            ← Back to Library
          </button>
          {driveUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium border border-border hover:bg-muted transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Google Drive
            </a>
          )}
        </div>
      </main>
    </div>
  );
}
