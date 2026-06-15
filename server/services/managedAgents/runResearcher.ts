/**
 * runResearcher.ts — one-shot avatar research via the researcher managed agent.
 *
 * Unlike the conversational agent (multi-turn, persistent sessionId), the researcher
 * is a task-completion workload:
 *   1. Open a new session for the author
 *   2. Send a single research instruction
 *   3. Agent calls web_search / web_fetch (server tools, autonomous)
 *   4. Agent calls analyze_author_appearance (host-side custom tool)
 *   5. Host runs Gemini/Claude vision analysis, captures the AuthorDescription
 *   6. Turn completes — return the captured description
 *
 * The host captures the result through the custom tool handler closure, avoiding
 * any dependency on parsing the agent's final reply text.
 */
import { ensureResearcherAgent } from "./provision";
import { runConversationTurn } from "./runSession";
import { buildAuthorDescription } from "../../lib/authorAvatars/authorResearcher";
import type { AuthorDescription, AuthorResearchData } from "../../lib/authorAvatars/types.js";
import type { CustomToolHandler } from "./runSession";
import { logger } from "../../lib/logger";

/** Timeout for the full researcher turn (web search is slow). */
const RESEARCHER_TIMEOUT_MS = 120_000;

/**
 * Run the researcher agent to gather author photos and produce an AuthorDescription.
 * Returns null if provisioning fails, the agent times out, or vision analysis fails.
 */
export async function runAuthorResearcherTurn(authorName: string): Promise<AuthorDescription | null> {
  let agent: Awaited<ReturnType<typeof ensureResearcherAgent>>;
  try {
    agent = await ensureResearcherAgent();
  } catch (err) {
    logger.warn(`[runResearcher] Provisioning failed for "${authorName}":`, err);
    return null;
  }

  let capturedDescription: AuthorDescription | null = null;

  const analyzeHandler: CustomToolHandler = async (input) => {
    const photoUrls = Array.isArray(input.photoUrls)
      ? (input.photoUrls as string[]).filter((u) => typeof u === "string" && u.startsWith("http"))
      : [];
    const biographicalText = typeof input.biographicalText === "string" ? input.biographicalText : "";
    const sources = Array.isArray(input.sources) ? (input.sources as string[]) : [];

    const research: AuthorResearchData = {
      authorName,
      wikiBio: biographicalText || undefined,
      tavilyPhotoUrls: photoUrls,
      apifyPhotoUrls: [],
      allPhotoUrls: photoUrls.slice(0, 5),
      sources: sources.length > 0 ? sources : ["managed-agent-research"],
    };

    logger.debug(
      `[runResearcher] analyze_author_appearance called for "${authorName}": ` +
      `${photoUrls.length} photos, bio ${biographicalText.length} chars`
    );

    const description = await buildAuthorDescription(research);
    if (description) capturedDescription = description;

    return description
      ? `Analysis complete. AuthorDescription produced for ${authorName}.`
      : `Vision analysis failed — no description produced for ${authorName}.`;
  };

  try {
    await runConversationTurn({
      agentId: agent.agentId,
      agentVersion: agent.agentVersion,
      environmentId: agent.environmentId,
      message: `Research the author "${authorName}". Gather biographical text and high-quality photo URLs from Wikipedia and other sources, then call analyze_author_appearance with your findings.`,
      customToolHandlers: { analyze_author_appearance: analyzeHandler },
      timeoutMs: RESEARCHER_TIMEOUT_MS,
    });
  } catch (err) {
    logger.warn(`[runResearcher] Research turn failed for "${authorName}":`, err);
    // Return whatever was captured before the failure (may be null).
  }

  return capturedDescription;
}
