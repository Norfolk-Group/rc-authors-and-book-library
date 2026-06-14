/**
 * documentParse.service.ts — extract plain text from PDF / DOCX bytes.
 *
 * PDF strategy:
 *   1. unpdf (Mozilla PDF.js, pure-JS/WASM) — free, local, fast. Works for
 *      born-digital PDFs with a real text layer (most books in our library).
 *   2. Mistral OCR fallback — engaged automatically when unpdf returns too
 *      little text (scanned books, image-heavy PDFs). Requires a public URL.
 *
 * DOCX strategy:
 *   mammoth (pure-JS) → raw text.
 *
 * Both extractors are kept behind a single  function so callers
 * don't have to think about format or fallback decisions.
 */

import * as mammoth from "mammoth";
import { ocrPdfFromUrl } from "./mistralOCR.service";

// Below this many characters per page, treat the text layer as unreliable and
// fall back to OCR. ~120 chars/page is a low but reasonable threshold (a normal
// book page has 1500–3000 chars of extractable text).
const OCR_FALLBACK_MIN_CHARS_PER_PAGE = 120;

export type ParsedDocument = {
  text: string;
  source: "pdf-text-layer" | "pdf-ocr" | "docx";
  pageCount?: number;
};

/**
 * Extract text from a PDF buffer using unpdf (Mozilla PDF.js, no native deps).
 * Returns the joined text and the page count.
 */
async function parsePdfBytes(buf: Buffer): Promise<{ text: string; pageCount: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const u8 = new Uint8Array(buf);
  const doc = await getDocumentProxy(u8);
  const { text } = await extractText(doc, { mergePages: true });
  const joined = Array.isArray(text) ? text.join("\n\n") : text;
  return { text: joined ?? "", pageCount: doc.numPages };
}

/**
 * Parse a PDF: try the text layer first, OCR fallback if it looks empty/scanned.
 * `publicUrl` is required only when the OCR fallback is allowed and used.
 */
export async function parsePdf(
  buf: Buffer,
  options: { publicUrl?: string; allowOcr?: boolean } = {}
): Promise<ParsedDocument> {
  const { text, pageCount } = await parsePdfBytes(buf);
  const charsPerPage = pageCount > 0 ? text.length / pageCount : text.length;
  const looksScanned = charsPerPage < OCR_FALLBACK_MIN_CHARS_PER_PAGE;

  if (looksScanned && options.allowOcr && options.publicUrl) {
    try {
      const ocrText = await ocrPdfFromUrl(options.publicUrl);
      if (ocrText.length > text.length) {
        return { text: ocrText, source: "pdf-ocr", pageCount };
      }
    } catch (err) {
      // OCR failure is non-fatal — return whatever the text layer gave us.
      console.warn("[documentParse] OCR fallback failed:", (err as Error).message);
    }
  }
  return { text, source: "pdf-text-layer", pageCount };
}

/**
 * Parse a DOCX buffer to raw text using mammoth.
 */
export async function parseDocx(buf: Buffer): Promise<ParsedDocument> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return { text: value, source: "docx" };
}

/**
 * Convenience: route by extension.
 */
export async function parseDocument(
  buf: Buffer,
  filename: string,
  options: { publicUrl?: string; allowOcr?: boolean } = {}
): Promise<ParsedDocument> {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
  if (ext === ".pdf") return parsePdf(buf, options);
  if (ext === ".docx") return parseDocx(buf);
  throw new Error(`Unsupported document type: ${ext}`);
}
