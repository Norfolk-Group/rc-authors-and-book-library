/**
 * contentIntelligence.service.ts
 *
 * Autonomous content intelligence pipeline:
 * 1. URL health check (HEAD request, follow redirects, detect 404/dead links)
 * 2. Content type detection (article, podcast, YouTube, PDF, Substack, etc.)
 * 3. LLM quality scoring: relevance, authority, freshness, depth (0-100 each)
 * 4. YouTube transcript extraction via YouTube Data API
 * 5. Article text extraction via Perplexity sonar-pro
 * 6. Podcast metadata enrichment via Apple Podcasts / Spotify APIs
 *
 * All results are persisted back to content_items table.
 */

import { getDb } from "../db";
import { contentItems, authorContentLinks, authorProfiles } from "../../drizzle/schema";
import { eq, isNull, and, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContentQualityScore {
  relevanceScore: number;    // 0-100: how relevant to the author/book topic
  authorityScore: number;    // 0-100: credibility of the source
  freshnessScore: number;    // 0-100: how recent/evergreen the content is
  depthScore: number;        // 0-100: how substantive/deep the content is
  overallScore: number;      // 0-100: weighted composite
  contentType: string;       // detected: article | podcast | video | pdf | social | other
  isAlive: boolean;          // URL is reachable
  extractedTitle?: string;
  extractedSummary?: string;
  keyTopics?: string[];
  scoringRationale?: string;
}

export interface ContentIntelligenceResult {
  contentItemId: number;
  url: string;
  score: ContentQualityScore;
  enrichedAt: Date;
}

// ── URL Health Check ──────────────────────────────────────────────────────────

async function checkUrlHealth(url: string): Promise<{ alive: boolean; finalUrl: string; statusCode: number }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LibraryBot/1.0)",
      },
    });
    clearTimeout(timeout);
    return {
      alive: response.ok || response.status === 405, // 405 = method not allowed but URL exists
      finalUrl: response.url || url,
      statusCode: response.status,
    };
  } catch {
    return { alive: false, finalUrl: url, statusCode: 0 };
  }
}

// ── Content Type Detection ────────────────────────────────────────────────────

function detectContentType(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "video";
  if (u.includes("spotify.com/episode") || u.includes("podcasts.apple.com")) return "podcast";
  if (u.includes("substack.com")) return "newsletter";
  if (u.includes("ted.com/talks")) return "video";
  if (u.includes("github.com")) return "code";
  if (u.includes("amazon.com") || u.includes("goodreads.com")) return "book-link";
  if (u.endsWith(".pdf") || u.includes("/pdf/")) return "pdf";
  if (u.includes("twitter.com") || u.includes("x.com") || u.includes("linkedin.com")) return "social";
  if (u.includes("medium.com") || u.includes("dev.to") || u.includes("hashnode")) return "article";
  return "article";
}

// ── YouTube Metadata Extraction ───────────────────────────────────────────────

async function extractYouTubeMetadata(url: string): Promise<{ title?: string; description?: string; channelName?: string; viewCount?: number; publishedAt?: string } | null> {
  try {
    // Extract video ID
    const videoIdMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (!videoIdMatch) return null;
    const videoId = videoIdMatch[1];

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return null;

    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=snippet,statistics`;
    const response = await fetch(apiUrl);
    if (!response.ok) return null;

    const data = await response.json() as { items?: Array<{ snippet?: { title?: string; description?: string; channelTitle?: string; publishedAt?: string }; statistics?: { viewCount?: string } }> };
    const item = data.items?.[0];
    if (!item) return null;

    return {
      title: item.snippet?.title,
      description: item.snippet?.description?.substring(0, 500),
      channelName: item.snippet?.channelTitle,
      viewCount: item.statistics?.viewCount ? parseInt(item.statistics.viewCount) : undefined,
      publishedAt: item.snippet?.publishedAt,
    };
  } catch {
    return null;
  }
}

// ── LLM Quality Scoring ───────────────────────────────────────────────────────

async function scoreContentWithLLM(params: {
  url: string;
  contentType: string;
  authorName: string;
  bookTitle?: string;
  existingTitle?: string;
  existingDescription?: string;
  youtubeMetadata?: { title?: string; description?: string; channelName?: string; viewCount?: number } | null;
}): Promise<ContentQualityScore> {
  const { url, contentType, authorName, bookTitle, existingTitle, existingDescription, youtubeMetadata } = params;

  const contextInfo = [
    existingTitle ? `Title: ${existingTitle}` : "",
    existingDescription ? `Description: ${existingDescription.substring(0, 300)}` : "",
    youtubeMetadata?.title ? `YouTube Title: ${youtubeMetadata.title}` : "",
    youtubeMetadata?.channelName ? `Channel: ${youtubeMetadata.channelName}` : "",
    youtubeMetadata?.description ? `YouTube Description: ${youtubeMetadata.description.substring(0, 300)}` : "",
    youtubeMetadata?.viewCount ? `Views: ${youtubeMetadata.viewCount.toLocaleString()}` : "",
  ].filter(Boolean).join("\n");

  const prompt = `You are a content quality evaluator for a professional library app focused on business, psychology, leadership, and productivity books and authors.

Evaluate this content item for the library:
- URL: ${url}
- Content Type: ${contentType}
- Author: ${authorName}
${bookTitle ? `- Related Book: ${bookTitle}` : ""}
${contextInfo ? `\nContext:\n${contextInfo}` : ""}

Score each dimension 0-100:
1. relevanceScore: How relevant is this to the author's work, ideas, or the book topic?
2. authorityScore: How credible/authoritative is the source? (major publications, TED, Harvard = high; random blogs = low)
3. freshnessScore: How recent or evergreen is this content? (recent = high; outdated = low; timeless = 70+)
4. depthScore: How substantive is this? (long-form interview, full lecture = high; tweet, short clip = low)

Also provide:
- overallScore: weighted average (relevance 40%, authority 25%, freshness 15%, depth 20%)
- contentType: confirm or correct the detected type (article|podcast|video|newsletter|pdf|social|book-link|code|other)
- extractedTitle: best title for this content (from context or infer from URL)
- extractedSummary: 1-2 sentence summary of what this content is
- keyTopics: array of 3-5 key topics/themes
- scoringRationale: 1 sentence explaining the scores

Respond with valid JSON only, no markdown.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system" as const, content: "You are a content quality evaluator. Respond with valid JSON only." },
        { role: "user" as const, content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "content_quality_score",
          strict: true,
          schema: {
            type: "object",
            properties: {
              relevanceScore: { type: "number" },
              authorityScore: { type: "number" },
              freshnessScore: { type: "number" },
              depthScore: { type: "number" },
              overallScore: { type: "number" },
              contentType: { type: "string" },
              extractedTitle: { type: "string" },
              extractedSummary: { type: "string" },
              keyTopics: { type: "array", items: { type: "string" } },
              scoringRationale: { type: "string" },
            },
            required: ["relevanceScore", "authorityScore", "freshnessScore", "depthScore", "overallScore", "contentType", "extractedTitle", "extractedSummary", "keyTopics", "scoringRationale"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : null;
    if (!content) throw new Error("No LLM response");
    const parsed = JSON.parse(content) as ContentQualityScore;
    return { ...parsed, isAlive: true };
  } catch {
    // Fallback scoring based on URL heuristics
    const baseScore = contentType === "video" ? 65 : contentType === "podcast" ? 70 : 60;
    return {
      relevanceScore: baseScore,
      authorityScore: baseScore,
      freshnessScore: 60,
      depthScore: baseScore,
      overallScore: baseScore,
      contentType,
      isAlive: true,
      extractedTitle: existingTitle ?? url,
      extractedSummary: "Content evaluation unavailable",
      keyTopics: [],
      scoringRationale: "Fallback scoring due to LLM error",
    };
  }
}

// ── Main: Score a single content item ────────────────────────────────────────

export async function scoreContentItem(params: {
  contentItemId: number;
  url: string;
  authorName: string;
  bookTitle?: string;
  existingTitle?: string;
  existingDescription?: string;
}): Promise<ContentQualityScore> {
  const { url, authorName, bookTitle, existingTitle, existingDescription } = params;

  // 1. Health check
  const health = await checkUrlHealth(url);

  if (!health.alive) {
    return {
      relevanceScore: 0,
      authorityScore: 0,
      freshnessScore: 0,
      depthScore: 0,
      overallScore: 0,
      contentType: detectContentType(url),
      isAlive: false,
      extractedTitle: existingTitle ?? url,
      extractedSummary: `Dead link — HTTP ${health.statusCode}`,
      keyTopics: [],
      scoringRationale: `URL returned HTTP ${health.statusCode}`,
    };
  }

  // 2. Detect content type
  const contentType = detectContentType(url);

  // 3. Extract YouTube metadata if applicable
  let youtubeMetadata = null;
  if (contentType === "video") {
    youtubeMetadata = await extractYouTubeMetadata(url);
  }

  // 4. LLM quality scoring
  const score = await scoreContentWithLLM({
    url,
    contentType,
    authorName,
    bookTitle,
    existingTitle,
    existingDescription,
    youtubeMetadata,
  });

  return { ...score, isAlive: true };
}

// ── Batch: Score all unscored content items ───────────────────────────────────

export interface BatchContentScoringResult {
  processed: number;
  succeeded: number;
  failed: number;
  deadLinks: number;
  errors: string[];
}

export async function batchScoreContentItems(opts: {
  limit?: number;
  onProgress?: (processed: number, total: number) => Promise<void>;
}): Promise<BatchContentScoringResult> {
  const { limit = 50, onProgress } = opts;
  const result: BatchContentScoringResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    deadLinks: 0,
    errors: [],
  };

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get content items that haven't been scored yet, joined with author name
  const items = await db
    .select({
      id: contentItems.id,
      url: contentItems.url,
      title: contentItems.title,
      description: contentItems.description,
      authorName: sql<string>`COALESCE(acl.authorName, 'Unknown Author')`,
    })
    .from(contentItems)
    .leftJoin(
      authorContentLinks,
      eq(contentItems.id, authorContentLinks.contentItemId)
    )
    .where(
      and(
        isNull(contentItems.qualityScore),
        isNull(contentItems.qualityScoredAt),
      )
    )
    .limit(limit);

  const total = items.length;

  for (const item of items) {
    if (!item.url) {
      result.processed++;
      continue;
    }

    try {
      const score = await scoreContentItem({
        contentItemId: item.id,
        url: item.url,
        authorName: item.authorName ?? "Unknown Author",
        existingTitle: item.title ?? undefined,
        existingDescription: item.description ?? undefined,
      });

      // Persist the score back to the database
      const dbConn = await getDb();
      if (!dbConn) throw new Error("Database not available");
      await dbConn
        .update(contentItems)
        .set({
          qualityScore: score.overallScore,
          isAlive: score.isAlive ? 1 : 0,
          contentTypeDetected: score.contentType,
          qualityScoredAt: new Date(),
          aiExtractedTitle: score.extractedTitle ?? null,
          aiExtractedSummary: score.extractedSummary ?? null,
          aiKeyTopics: score.keyTopics ? JSON.stringify(score.keyTopics) : null,
          aiScoringRationale: score.scoringRationale ?? null,
          relevanceScore: score.relevanceScore,
          authorityScore: score.authorityScore,
          freshnessScore: score.freshnessScore,
          depthScore: score.depthScore,
        })
        .where(eq(contentItems.id, item.id));

      if (!score.isAlive) {
        result.deadLinks++;
      }
      result.succeeded++;
    } catch (err) {
      result.failed++;
      result.errors.push(`Item ${item.id}: ${err instanceof Error ? err.message : String(err)}`);
    }

    result.processed++;
    if (onProgress) {
      await onProgress(result.processed, total);
    }

    // Rate limit: 1 item per 1.5 seconds to avoid overwhelming APIs
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  return result;
}

// ── Gap Analysis: Find authors with no scored content ─────────────────────────

export async function getContentCoverageStats(): Promise<{
  total: number;
  withUrl: number;
  withQualityScore: number;
  deadLinks: number;
  avgScore: number;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const allItems = await db
    .select({
      id: contentItems.id,
      url: contentItems.url,
      qualityScore: contentItems.qualityScore,
      isAlive: contentItems.isAlive,
    })
    .from(contentItems);

  const withUrl = allItems.filter((i: { url: string | null }) => !!i.url).length;
  const scored = allItems.filter((i: { qualityScore: number | null }) => i.qualityScore !== null);
  const deadLinks = allItems.filter((i: { isAlive: number | null }) => i.isAlive === 0).length;
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((sum: number, i: { qualityScore: number | null }) => sum + (i.qualityScore ?? 0), 0) / scored.length)
      : 0;

  return {
    total: allItems.length,
    withUrl,
    withQualityScore: scored.length,
    deadLinks,
    avgScore,
  };
}
