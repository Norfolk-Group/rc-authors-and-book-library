/**
 * Validates that ANTHROPIC_API_KEY is set and accepted by the Anthropic API.
 * Sends a minimal message to claude-3-haiku-20240307 (cheapest/fastest available model).
 */
import { describe, it, expect } from "vitest";
import Anthropic from "@anthropic-ai/sdk";

describe("ANTHROPIC_API_KEY validation", () => {
  it("should have ANTHROPIC_API_KEY set", () => {
    expect(process.env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY env var must be set").toBeTruthy();
  });

  it("should successfully call the Anthropic API with the provided key", async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply with only the word: OK" }],
    });

    expect(response.content).toBeDefined();
    expect(response.content.length).toBeGreaterThan(0);
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    expect(text.length).toBeGreaterThan(0);
    console.log(`[anthropic-key.test] API response: "${text.trim()}"`);
  }, 30_000);
});
