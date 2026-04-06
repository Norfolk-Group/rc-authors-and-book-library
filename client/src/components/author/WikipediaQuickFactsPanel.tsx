/**
 * WikipediaQuickFactsPanel — enhanced Wikipedia panel with quick facts
 * Uses data from socialStatsJson.wikipedia (fetched via Wikimedia REST API)
 */
import { Eye, ExternalLink, BookOpen } from "lucide-react";

interface WikipediaStats {
  pageTitle: string;
  pageUrl: string;
  description: string | null;
  extract: string | null;
  thumbnailUrl: string | null;
  avgMonthlyViews: number;
  fetchedAt?: string;
}

interface Props {
  wikipedia: WikipediaStats | null | undefined;
  authorName: string;
}

function formatCount(n: number | null | undefined): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

export function WikipediaQuickFactsPanel({ wikipedia, authorName }: Props) {
  if (!wikipedia) return null;

  const monthlyViews = formatCount(wikipedia.avgMonthlyViews);

  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Wikipedia Quick Facts
      </h2>
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Header row */}
        <div className="flex items-start gap-3 p-4">
          {wikipedia.thumbnailUrl && (
            <img
              src={wikipedia.thumbnailUrl}
              alt={authorName}
              className="w-16 h-20 object-cover rounded-xl flex-shrink-0 border border-border"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current text-foreground" aria-hidden>
                <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .084-.103.135-.2.157-.74.108-.835.361-.492 1.005 1.225 2.405 2.501 4.771 3.852 7.12l.828-1.569-2.947-5.542c-.238-.465-.557-.74-.927-.826-.127-.031-.198-.077-.198-.149v-.468l.055-.045h4.78l.05.045v.437c0 .084-.1.133-.198.157-.644.116-.834.361-.492 1.005l1.829 3.432 1.723-3.457c.353-.676.153-.93-.487-1.005-.1-.024-.199-.073-.199-.157v-.437l.05-.045h3.481l.05.045v.437c0 .084-.103.133-.199.157-.644.116-.834.361-.492 1.005l1.829 3.432 1.723-3.457c.353-.676.153-.93-.487-1.005-.1-.024-.199-.073-.199-.157v-.437l.05-.045h3.481l.05.045v.437c0 .084-.103.133-.199.157-.644.116-.834.361-.492 1.005l-4.147 8.334c-.617 1.074-1.127.931-1.532.029l-2.854-5.728z" />
              </svg>
              <span className="text-sm font-bold text-foreground">{wikipedia.pageTitle}</span>
            </div>
            {wikipedia.description && (
              <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                {wikipedia.description}
              </p>
            )}
            {monthlyViews && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Eye className="w-3.5 h-3.5 text-primary" />
                <span className="font-semibold text-foreground">{monthlyViews}</span>
                <span>page views / month</span>
              </div>
            )}
          </div>
        </div>

        {/* Extract snippet */}
        {wikipedia.extract && (
          <div className="px-4 pb-3">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/40">
              <BookOpen className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                {wikipedia.extract}
              </p>
            </div>
          </div>
        )}

        {/* Footer link */}
        <div className="px-4 pb-4 flex items-center justify-between">
          <a
            href={wikipedia.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            Read full article on Wikipedia
            <ExternalLink className="w-3 h-3" />
          </a>
          {wikipedia.fetchedAt && (
            <span className="text-[10px] text-muted-foreground/50">
              Updated {new Date(wikipedia.fetchedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
