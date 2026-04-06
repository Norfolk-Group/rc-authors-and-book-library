/**
 * LinkedInStatsPanel — displays LinkedIn follower count, headline, and link
 * Uses data from socialStatsJson.linkedin (fetched via RapidAPI enrichment)
 */
import { Users, ExternalLink, TrendingUp } from "lucide-react";

interface LinkedInStats {
  followerCount: number | null;
  connectionCount: number | null;
  headline: string | null;
  profileUrl: string;
  fetchedAt?: string;
}

interface Props {
  linkedin: LinkedInStats | null | undefined;
  linkedinUrl?: string | null;
}

function formatCount(n: number | null | undefined): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export function LinkedInStatsPanel({ linkedin, linkedinUrl }: Props) {
  const url = linkedin?.profileUrl || linkedinUrl;
  if (!linkedin && !url) return null;

  const hasStats = linkedin?.followerCount || linkedin?.connectionCount || linkedin?.headline;

  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
        LinkedIn
      </h2>
      <div className="rounded-2xl border border-border bg-card shadow-sm p-4">
        <div className="flex items-start gap-3">
          {/* LinkedIn logo */}
          <div
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "#0A66C218", color: "#0A66C2" }}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden>
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            {linkedin?.headline && (
              <p className="text-sm text-foreground font-medium leading-snug mb-2 line-clamp-2">
                {linkedin.headline}
              </p>
            )}

            {/* Stats row */}
            {hasStats && (
              <div className="flex flex-wrap gap-3 mb-2">
                {linkedin?.followerCount && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5 text-[#0A66C2]" />
                    <span className="font-semibold text-foreground">
                      {formatCount(linkedin.followerCount)}
                    </span>
                    <span>followers</span>
                  </div>
                )}
                {linkedin?.connectionCount && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="w-3.5 h-3.5 text-[#0A66C2]" />
                    <span className="font-semibold text-foreground">
                      {formatCount(linkedin.connectionCount)}
                    </span>
                    <span>connections</span>
                  </div>
                )}
              </div>
            )}

            {!hasStats && (
              <p className="text-xs text-muted-foreground mb-2">
                Professional network profile
              </p>
            )}

            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0A66C2] hover:underline"
              >
                View LinkedIn profile
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {linkedin?.fetchedAt && (
          <p className="text-[10px] text-muted-foreground/50 mt-3 text-right">
            Updated {new Date(linkedin.fetchedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </section>
  );
}
