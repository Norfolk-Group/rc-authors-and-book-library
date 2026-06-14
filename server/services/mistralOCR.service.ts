/**
 * mistralOCR.service.ts — Mistral OCR (mistral-ocr-latest), via REST.
 *
 * Reserved for PDFs where the text layer is missing or unreliable (scanned
 * pages, image-heavy books). The unpdf path is tried first because it's free,
 * local, and instant; Mistral OCR is the fallback when that returns too little
 * text. Both end in the same shape: Markdown ready for chunking.
 *
 * Mistral OCR accepts either a public document URL or base64-encoded bytes.
 * Books in R2 already have public URLs, so we pass the URL when available
 * (avoids re-uploading bytes through the LLM API).
 *
 * Pricing reference: ~$1 per 1,000 pages (June 2026) — affordable as a
 * fallback, not as the primary path for hundreds of books.
 */

import { ENV } from "../_core/env";

export const MISTRAL_OCR_MODEL = "mistral-ocr-latest";
const MISTRAL_API_BASE = "https://api.mistral.ai/v1";

type MistralOCRPage = {
  index: number;
  markdown?: string;
  text?: string;
};

type MistralOCRResponse = {
  pages?: MistralOCRPage[];
  // older responses may use `document_annotation` or top-level markdown — handled
  // defensively below.
  markdown?: string;
};

function authHeaders(): Record<string, string> {
  if (!ENV.mistralApiKey) {
    throw new Error("MISTRAL_API_KEY is not configured");
  }
  return {
    authorization: `Bearer ${ENV.mistralApiKey}`,
    "content-type": "application/json",
    accept: "application/json",
  };
}

async function callOcr(documentField: Record<string, unknown>): Promise<string> {
  const resp = await fetch(`${MISTRAL_API_BASE}/ocr`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: MISTRAL_OCR_MODEL,
      document: documentField,
      // Markdown output is the most useful for downstream chunking.
      include_image_base64: false,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Mistral OCR failed: ${resp.status} ${resp.statusText} - ${text}`);
  }
  const data = (await resp.json()) as MistralOCRResponse;
  if (data.pages?.length) {
    return data.pages
      .map((p) => p.markdown ?? p.text ?? "")
      .filter(Boolean)
      .join("\n\n");
  }
  return data.markdown ?? "";
}

/**
 * OCR a PDF that's already public-readable in storage (e.g. R2 with a public
 * URL). Returns Markdown text ready for chunking.
 */
export async function ocrPdfFromUrl(url: string): Promise<string> {
  return callOcr({ type: "document_url", document_url: url });
}

/**
 * OCR a PDF from raw bytes (base64-encoded inline). Use only when a public URL
 * isn't available — the URL form is preferable since it avoids re-uploading.
 */
export async function ocrPdfFromBuffer(buf: Buffer): Promise<string> {
  return callOcr({
    type: "document_base64",
    document_base64: buf.toString("base64"),
  });
}
