/**
 * researcherAgent.ts — "author-researcher-agent" config.
 *
 * A task-completion agent (not a conversation agent) that replaces the hand-coded
 * HTTP fetch pipeline in authorResearcher.ts. It uses the Managed Agents
 * agent_toolset_20260401 server tools (web_search, web_fetch) to adaptively
 * gather author photos and biographical text, then calls the host-side custom
 * analyze_author_appearance tool which runs the existing Gemini/Claude vision
 * analysis and returns a structured AuthorDescription JSON.
 *
 * Architecture:
 *   Agent (web_search + web_fetch)          → gathers URLs + bio text
 *   analyze_author_appearance (host-side)   → runs vision analysis, returns JSON
 */
import type Anthropic from "@anthropic-ai/sdk";

export const RESEARCHER_AGENT_KEY = "author-researcher-agent";

const ANALYZE_TOOL = "analyze_author_appearance";

export const RESEARCHER_AGENT_SYSTEM = `You are a forensic author research agent. Your sole task: gather high-quality photo URLs and biographical text for a named author, then call ${ANALYZE_TOOL} exactly once with everything you found.

RESEARCH SEQUENCE (follow in order):
1. web_search("{authorName} Wikipedia") — find the Wikipedia page URL
2. web_fetch the Wikipedia page — extract the infobox photo URL and bio summary text
3. web_search("{authorName} author professional headshot portrait site:goodreads.com OR site:publishersweekly.com OR site:penguin.com")
4. web_fetch any promising page that likely has a direct photo URL
5. Call ${ANALYZE_TOOL} with all collected photo URLs and biographical text

PHOTO QUALITY RULES:
- Prefer Wikipedia Commons photos (upload.wikimedia.org or commons.wikimedia.org)
- Prefer publisher/agency headshots over casual social photos
- Only include direct image URLs ending in .jpg, .jpeg, .png, .webp, or .gif
- Collect 3–5 best candidate URLs; do not stop at one
- Do not guess or construct URLs — only use URLs you have actually retrieved

COMPLETION RULES:
- Call ${ANALYZE_TOOL} exactly once, after exhausting your research
- Maximum 6 total web_search + web_fetch operations before calling the tool
- If no photos were found after exhaustive search, call the tool with an empty photoUrls array
- Do not summarize or narrate — just call the tool`;

export const RESEARCHER_AGENT_TOOLS: Anthropic.Beta.Agents.AgentCreateParams["tools"] = [
  {
    type: "agent_toolset_20260401",
    default_config: { enabled: false },
    configs: [
      { name: "web_search", enabled: true, permission_policy: { type: "always_allow" } },
      { name: "web_fetch", enabled: true, permission_policy: { type: "always_allow" } },
    ],
  },
  {
    type: "custom",
    name: ANALYZE_TOOL,
    description:
      "Submit gathered author research data (photo URLs + biographical text) for AI vision analysis. Returns a structured AuthorDescription JSON. Call this ONCE after completing your web research.",
    input_schema: {
      type: "object",
      properties: {
        authorName: { type: "string", description: "Exact author name." },
        photoUrls: {
          type: "array",
          items: { type: "string" },
          description: "Direct image URLs gathered during research (3–5 preferred).",
        },
        biographicalText: {
          type: "string",
          description: "Biographical text gathered from Wikipedia or other sources.",
        },
        sources: {
          type: "array",
          items: { type: "string" },
          description: "Names of sources used (e.g. ['Wikipedia', 'Goodreads']).",
        },
      },
      required: ["authorName", "photoUrls"],
    },
  },
];
