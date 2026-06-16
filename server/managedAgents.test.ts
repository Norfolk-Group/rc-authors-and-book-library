/**
 * managedAgents.test.ts
 *
 * Unit tests for the pure, side-effect-free parts of the managed agent configs.
 * The live session flow (provision/runSession) requires a real Anthropic key +
 * Managed Agents beta and is verified by a live smoke test, not here.
 */
import { describe, it, expect } from "vitest";
import {
  AUTHOR_AGENT_KEY,
  AUTHOR_AGENT_SYSTEM,
  AUTHOR_AGENT_TOOLS,
  buildAuthorSystemContext,
} from "./services/managedAgents/authorAgent";
import {
  RESEARCHER_AGENT_KEY,
  RESEARCHER_AGENT_SYSTEM,
  RESEARCHER_AGENT_TOOLS,
} from "./services/managedAgents/researcherAgent";

describe("author agent config", () => {
  it("declares the retrieve_author_knowledge custom tool with required params", () => {
    const tool = (AUTHOR_AGENT_TOOLS ?? []).find(
      (t) => (t as { name?: string }).name === "retrieve_author_knowledge"
    ) as { type: string; input_schema: { required: string[] } } | undefined;
    expect(tool).toBeDefined();
    expect(tool!.type).toBe("custom");
    expect(tool!.input_schema.required).toEqual(expect.arrayContaining(["query", "authorName"]));
  });

  it("system prompt enforces context-first grounding and anti-fabrication", () => {
    expect(AUTHOR_AGENT_SYSTEM).toMatch(/retrieve_author_knowledge/);
    expect(AUTHOR_AGENT_SYSTEM.toLowerCase()).toMatch(/do not (invent|answer from memory)/);
  });

  it("uses a stable agent key", () => {
    expect(AUTHOR_AGENT_KEY).toBe("author-conversational-agent");
  });
});

describe("buildAuthorSystemContext", () => {
  it("names the author and pins the tool's authorName argument", () => {
    const ctx = buildAuthorSystemContext("Adam Grant", "An organizational psychologist.");
    expect(ctx).toContain("Adam Grant");
    expect(ctx).toContain('authorName="Adam Grant"');
    expect(ctx).toContain("organizational psychologist");
  });

  it("omits the bio line when no bio is provided", () => {
    const ctx = buildAuthorSystemContext("Malcolm Gladwell", null);
    expect(ctx).toContain("Malcolm Gladwell");
    expect(ctx).not.toContain("brief reference");
  });

  it("truncates very long bios", () => {
    const ctx = buildAuthorSystemContext("X", "a".repeat(2000));
    expect(ctx.length).toBeLessThan(1200);
  });
});

describe("researcher agent config", () => {
  it("uses a stable agent key distinct from the conversational agent", () => {
    expect(RESEARCHER_AGENT_KEY).toBe("author-researcher-agent");
    expect(RESEARCHER_AGENT_KEY).not.toBe(AUTHOR_AGENT_KEY);
  });

  it("declares the agent_toolset_20260401 with web_search and web_fetch enabled", () => {
    const toolset = (RESEARCHER_AGENT_TOOLS ?? []).find(
      (t) => (t as { type?: string }).type === "agent_toolset_20260401"
    ) as { type: string; configs?: Array<{ name: string; enabled?: boolean }> } | undefined;
    expect(toolset).toBeDefined();
    const names = (toolset!.configs ?? []).map((c) => c.name);
    expect(names).toContain("web_search");
    expect(names).toContain("web_fetch");
  });

  it("declares the analyze_author_appearance custom tool with required params", () => {
    const tool = (RESEARCHER_AGENT_TOOLS ?? []).find(
      (t) => (t as { name?: string }).name === "analyze_author_appearance"
    ) as { type: string; input_schema: { required: string[] } } | undefined;
    expect(tool).toBeDefined();
    expect(tool!.type).toBe("custom");
    expect(tool!.input_schema.required).toContain("authorName");
    expect(tool!.input_schema.required).toContain("photoUrls");
  });

  it("system prompt enforces research-before-tool and completion rules", () => {
    expect(RESEARCHER_AGENT_SYSTEM).toMatch(/analyze_author_appearance/);
    expect(RESEARCHER_AGENT_SYSTEM.toLowerCase()).toMatch(/web_search|web_fetch/);
    expect(RESEARCHER_AGENT_SYSTEM.toLowerCase()).toMatch(/exactly once/);
  });
});
