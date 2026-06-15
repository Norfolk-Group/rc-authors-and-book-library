/**
 * managedAgents.test.ts
 *
 * Unit tests for the pure, side-effect-free parts of the author conversational
 * agent config. The live session flow (provision/runSession) requires a real
 * Anthropic key + Managed Agents beta and is verified by a live smoke test, not
 * here.
 */
import { describe, it, expect } from "vitest";
import {
  AUTHOR_AGENT_KEY,
  AUTHOR_AGENT_SYSTEM,
  AUTHOR_AGENT_TOOLS,
  buildAuthorSystemContext,
} from "./services/managedAgents/authorAgent";

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
