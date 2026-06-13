/**
 * ResearchSearch — Web research search powered by Exa (neural web search) +
 * Perplexity (cited answer synthesis). Distinct from ThematicSearch, which
 * searches the internal library via Neon pgvector; this searches the live web.
 */
import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Globe, Search, Sparkles, ExternalLink, ArrowLeft, X, Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const EXAMPLE_QUERIES = [
  "latest research on deep work and focus",
  "what is Adam Grant working on in 2026",
  "best new books on behavioral economics",
  "criticism of the 10,000 hour rule",
  "recent interviews with Brené Brown",
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function ResearchSearch() {
  const [, setLocation] = useLocation();
  const [inputValue, setInputValue] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const { data, isLoading, isFetching } = trpc.webSearch.research.useQuery(
    { query: activeQuery, numResults: 10 },
    {
      enabled: activeQuery.length >= 2,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    }
  );

  const handleSearch = useCallback(() => {
    if (inputValue.trim().length >= 2) setActiveQuery(inputValue.trim());
  }, [inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleExampleClick = (q: string) => {
    setInputValue(q);
    setActiveQuery(q);
  };

  const loading = (isLoading || isFetching) && activeQuery.length >= 2;
  const answer = data?.answer ?? null;
  const citations = data?.citations ?? [];
  const sources = data?.sources ?? [];
  const hasResults = !!answer || sources.length > 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="flex-shrink-0">
            <ArrowLeft size={18} />
          </Button>
          <div className="flex-1 relative">
            <Globe size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Research anything on the web…"
              className="pl-9 pr-9"
              autoFocus
            />
            {inputValue && (
              <button
                onClick={() => { setInputValue(""); setActiveQuery(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <Button onClick={handleSearch} disabled={inputValue.trim().length < 2} className="gap-2 flex-shrink-0">
            <Search size={15} />
            Search
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Intro / examples (no active query) */}
        {!activeQuery && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles size={14} />
              <span>Ask a question or search the live web:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleExampleClick(q)}
                  className="px-3 py-1.5 rounded-full text-sm bg-muted hover:bg-accent border border-border/60 transition-colors text-foreground/80"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-primary" />
                <h3 className="font-semibold text-sm">How Web Research Works</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Unlike library search (which looks inside your own collection), web research
                queries the live internet. <strong>Perplexity</strong> synthesises a cited answer and
                <strong> Exa</strong> returns relevant source pages — so you can quickly research an
                author, idea, or current topic and jump to the originals.
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && activeQuery.length >= 2 && (
          <>
            {!hasResults && (
              <div className="text-center py-12 space-y-3">
                <Globe size={40} className="mx-auto text-muted-foreground/30" />
                <p className="text-muted-foreground">
                  No web results for “{activeQuery}”. Try rephrasing, or check that the Exa /
                  Perplexity keys are configured.
                </p>
              </div>
            )}

            {/* Perplexity answer */}
            {answer && (
              <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Quote size={16} className="text-primary" />
                  <h2 className="text-sm font-semibold">Answer</h2>
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Sparkles size={10} />
                    Perplexity
                  </Badge>
                </div>
                <p className="text-sm leading-relaxed text-card-foreground whitespace-pre-wrap">{answer}</p>
                {citations.length > 0 && (
                  <div className="pt-2 border-t border-border/50 space-y-1">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Citations</p>
                    <ol className="space-y-0.5">
                      {citations.map((c, i) => (
                        <li key={c} className="text-xs flex items-start gap-1.5">
                          <span className="text-muted-foreground font-mono">{i + 1}.</span>
                          <a
                            href={c}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline break-all"
                          >
                            {hostOf(c)}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* Exa sources */}
            {sources.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Globe size={15} className="text-muted-foreground" />
                    Sources
                  </h2>
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Sparkles size={10} />
                    Exa
                  </Badge>
                </div>
                {sources.map((s, i) => (
                  <a
                    key={`${s.url}-${i}`}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-card hover:bg-accent/30 hover:border-primary/30 transition-all"
                  >
                    <div className="w-6 text-center flex-shrink-0 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-semibold leading-tight line-clamp-2 text-card-foreground group-hover:text-primary transition-colors">
                        {s.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {hostOf(s.url)}
                        {s.publishedDate && ` · ${new Date(s.publishedDate).toLocaleDateString()}`}
                      </p>
                      {s.snippet && (
                        <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed mt-1">{s.snippet}</p>
                      )}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
