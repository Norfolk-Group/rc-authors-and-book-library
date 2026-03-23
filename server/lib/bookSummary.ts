/**
 * bookSummary.ts
 * Enriches book profiles with AI-generated summaries, key themes, and metadata.
 * Uses Perplexity (web-grounded) as primary, Gemini as fallback.
 */

import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";

export interface BookSummaryResult {
  summary: string;
  keyThemes: string;
  rating?: string;
  ratingCount?: number;
  publishedDate?: string;
  publisher?: string;
  isbn?: string;
  amazonUrl?: string;
  goodreadsUrl?: string;
  wikipediaUrl?: string;
  publisherUrl?: string;
  source: "perplexity" | "gemini" | "fallback";
}

/**
 * Enriches a book with a summary, key themes, and metadata.
 * @param bookTitle - Clean book title (without author suffix)
 * @param authorName - Author name for context
 * @param researchVendor - Which vendor to use for research ('perplexity', 'gemini', 'anthropic')
 * @param researchModel - Model ID
 */
export async function enrichBookSummary(
  bookTitle: string,
  authorName: string,
  researchVendor: string = "perplexity",
  researchModel: string = "sonar-pro"
): Promise<BookSummaryResult> {
  const prompt = `Research the book "${bookTitle}" by ${authorName}. Provide:
1. A compelling 2-3 sentence summary of the book's core message and value
2. 5-8 key themes as comma-separated keywords (e.g. "leadership,habits,psychology")
3. Average rating (e.g. "4.5") if available on Amazon or Goodreads
4. Number of ratings as a plain integer (e.g. 45000) if available
5. Published date (YYYY-MM-DD format)
6. Publisher name
7. ISBN-13 if available
8. Amazon product page URL
9. Goodreads book page URL
10. Wikipedia article URL for this book (if it has a Wikipedia page)
11. Publisher's official page for this book (if available)

Return ONLY a JSON object:
{
  "summary": "...",
  "keyThemes": "theme1,theme2,theme3",
  "rating": "4.5" or null,
  "ratingCount": 45000 or null,
  "publishedDate": "YYYY-MM-DD" or null,
  "publisher": "..." or null,
  "isbn": "..." or null,
  "amazonUrl": "https://amazon.com/..." or null,
  "goodreadsUrl": "https://goodreads.com/..." or null,
  "wikipediaUrl": "https://en.wikipedia.org/wiki/..." or null,
  "publisherUrl": "https://..." or null
}`;

  try {
    // Try Perplexity first (web-grounded for accurate metadata)
    if (researchVendor === "perplexity" && ENV.perplexityApiKey) {
      const result = await callPerplexityBookSummary(bookTitle, authorName, researchModel, prompt);
      if (result) return { ...result, source: "perplexity" };
    }

    // Fallback to Gemini via invokeLLM
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a book research assistant. Provide accurate summaries and metadata. Return only valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "book_summary",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              keyThemes: { type: "string" },
              rating: { type: ["string", "null"] },
              ratingCount: { type: ["integer", "null"] },
              publishedDate: { type: ["string", "null"] },
              publisher: { type: ["string", "null"] },
              isbn: { type: ["string", "null"] },
              amazonUrl: { type: ["string", "null"] },
              goodreadsUrl: { type: ["string", "null"] },
              wikipediaUrl: { type: ["string", "null"] },
              publisherUrl: { type: ["string", "null"] },
            },
            required: [
              "summary",
              "keyThemes",
              "rating",
              "ratingCount",
              "publishedDate",
              "publisher",
              "isbn",
              "amazonUrl",
              "goodreadsUrl",
              "wikipediaUrl",
              "publisherUrl",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from LLM");

    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return {
      summary: parsed.summary ?? "",
      keyThemes: parsed.keyThemes ?? "",
      rating: parsed.rating ?? undefined,
      ratingCount: parsed.ratingCount != null ? Number(parsed.ratingCount) : undefined,
      publishedDate: parsed.publishedDate ?? undefined,
      publisher: parsed.publisher ?? undefined,
      isbn: parsed.isbn ?? undefined,
      amazonUrl: parsed.amazonUrl ?? undefined,
      goodreadsUrl: parsed.goodreadsUrl ?? undefined,
      wikipediaUrl: parsed.wikipediaUrl ?? undefined,
      publisherUrl: parsed.publisherUrl ?? undefined,
      source: "gemini",
    };
  } catch (err) {
    console.error(`[bookSummary] Failed to enrich summary for "${bookTitle}":`, err);
    return {
      summary: "",
      keyThemes: "",
      source: "fallback",
    };
  }
}

async function callPerplexityBookSummary(
  bookTitle: string,
  authorName: string,
  model: string,
  prompt: string
): Promise<Omit<BookSummaryResult, "source"> | null> {
  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ENV.perplexityApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "sonar-pro",
        messages: [
          {
            role: "system",
            content:
              "You are a book research assistant. Return only valid JSON with accurate book metadata.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.warn(
        `[bookSummary] Perplexity returned ${response.status} for "${bookTitle}"`
      );
      return null;
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summary: parsed.summary ?? "",
      keyThemes: parsed.keyThemes ?? "",
      rating: parsed.rating ?? undefined,
      ratingCount: parsed.ratingCount != null ? Number(parsed.ratingCount) : undefined,
      publishedDate: parsed.publishedDate ?? undefined,
      publisher: parsed.publisher ?? undefined,
      isbn: parsed.isbn ?? undefined,
       amazonUrl: parsed.amazonUrl ?? undefined,
      goodreadsUrl: parsed.goodreadsUrl ?? undefined,
      wikipediaUrl: parsed.wikipediaUrl ?? undefined,
      publisherUrl: parsed.publisherUrl ?? undefined,
    };
  } catch (err) {
    console.warn(`[bookSummary] Perplexity call failed for "${bookTitle}"`, err);
    return null;
  }
}
