/**
 * ISBNBarcode — Renders an EAN-13 / ISBN-13 barcode using JsBarcode.
 *
 * Falls back to a clean ISBN text display if the value is not a valid
 * 10- or 13-digit ISBN, or if JsBarcode fails to render.
 *
 * Usage:
 *   <ISBNBarcode isbn="9780735224292" />
 */
import { useEffect, useRef, useState } from "react";

interface Props {
  isbn: string;
  /** Width of each bar in pixels (default 1.5) */
  barWidth?: number;
  /** Height of the barcode in pixels (default 60) */
  height?: number;
  /** Show the human-readable ISBN text below the barcode (default true) */
  showText?: boolean;
}

/** Normalise ISBN-10 to ISBN-13 by prepending "978" and recalculating check digit */
function normalizeToISBN13(raw: string): string | null {
  const digits = raw.replace(/[-\s]/g, "");
  if (digits.length === 13 && /^\d{13}$/.test(digits)) return digits;
  if (digits.length === 10 && /^\d{9}[\dX]$/.test(digits)) {
    // Convert ISBN-10 → ISBN-13
    const base = "978" + digits.slice(0, 9);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const check = (10 - (sum % 10)) % 10;
    return base + check;
  }
  return null;
}

export function ISBNBarcode({ isbn, barWidth = 1.5, height = 60, showText = true }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState(false);
  const normalized = normalizeToISBN13(isbn);

  useEffect(() => {
    if (!normalized || !svgRef.current) return;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      try {
        JsBarcode(svgRef.current, normalized, {
          format: "EAN13",
          width: barWidth,
          height,
          displayValue: false, // we render our own text below
          margin: 4,
          background: "transparent",
          lineColor: "currentColor",
        });
        setError(false);
      } catch {
        setError(true);
      }
    });
  }, [normalized, barWidth, height]);

  if (!normalized || error) {
    return (
      <div className="flex flex-col items-center gap-1 py-2">
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted border border-border">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ISBN</span>
          <span className="text-xs font-mono text-foreground">{isbn}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Barcode SVG */}
      <div className="relative rounded-lg overflow-hidden border border-border/50 bg-white dark:bg-white p-2">
        <svg
          ref={svgRef}
          className="text-black"
          aria-label={`ISBN barcode: ${isbn}`}
        />
      </div>
      {/* Human-readable text */}
      {showText && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">ISBN</span>
          <span className="text-[11px] font-mono text-muted-foreground">{normalized.replace(/(\d{3})(\d{1})(\d{5})(\d{3})(\d{1})/, "$1-$2-$3-$4-$5")}</span>
        </div>
      )}
    </div>
  );
}
