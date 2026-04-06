/**
 * YahooFinancePanel — displays stock/company data for authors with a stock ticker
 * Uses data from businessProfileJson.yahooFinance (fetched via RapidAPI)
 */
import { TrendingUp, DollarSign, ExternalLink, BarChart2 } from "lucide-react";

interface YahooFinanceStats {
  ticker: string;
  shortName: string;
  regularMarketPrice: number | null;
  marketCap: number | null;
  currency: string | null;
  exchange: string | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fetchedAt?: string;
}

interface Props {
  yahooFinance: YahooFinanceStats | null | undefined;
  stockTicker?: string | null;
}

function formatMarketCap(n: number | null | undefined): string {
  if (!n) return "";
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function formatPrice(n: number | null | undefined, currency: string | null): string {
  if (!n) return "";
  const symbol = currency === "USD" ? "$" : (currency ?? "$");
  return `${symbol}${n.toFixed(2)}`;
}

export function YahooFinancePanel({ yahooFinance, stockTicker }: Props) {
  if (!yahooFinance && !stockTicker) return null;
  if (!yahooFinance) {
    return (
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Company / Stock
        </h2>
        <div className="rounded-2xl border border-border bg-card shadow-sm p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart2 className="w-4 h-4" />
            <span>Ticker: <strong className="text-foreground">{stockTicker}</strong></span>
            <span className="text-xs">(data not yet enriched)</span>
          </div>
        </div>
      </section>
    );
  }

  const price = formatPrice(yahooFinance.regularMarketPrice, yahooFinance.currency);
  const marketCap = formatMarketCap(yahooFinance.marketCap);
  const yahooUrl = `https://finance.yahoo.com/quote/${yahooFinance.ticker}`;

  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Company / Stock
      </h2>
      <div className="rounded-2xl border border-border bg-card shadow-sm p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">{yahooFinance.shortName}</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                {yahooFinance.ticker}
              </span>
            </div>
            {yahooFinance.exchange && (
              <p className="text-xs text-muted-foreground mt-0.5">{yahooFinance.exchange}</p>
            )}
          </div>
          {price && (
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">{price}</p>
              <p className="text-[10px] text-muted-foreground">Current price</p>
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {marketCap && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
              <DollarSign className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Market Cap</p>
                <p className="text-xs font-bold text-foreground">{marketCap}</p>
              </div>
            </div>
          )}
          {(yahooFinance.fiftyTwoWeekHigh || yahooFinance.fiftyTwoWeekLow) && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
              <TrendingUp className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">52-Week Range</p>
                <p className="text-xs font-bold text-foreground">
                  {formatPrice(yahooFinance.fiftyTwoWeekLow, yahooFinance.currency)} –{" "}
                  {formatPrice(yahooFinance.fiftyTwoWeekHigh, yahooFinance.currency)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <a
            href={yahooUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            View on Yahoo Finance
            <ExternalLink className="w-3 h-3" />
          </a>
          {yahooFinance.fetchedAt && (
            <span className="text-[10px] text-muted-foreground/50">
              Updated {new Date(yahooFinance.fetchedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
