/**
 * Lazy Anthropic client for the Managed Agents beta surface
 * (client.beta.agents / sessions / environments). Constructed on first use so a
 * missing key fails at call time (caught by the caller), never at import.
 */
import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "../../_core/env";

let client: Anthropic | null = null;

export function getManagedAgentsClient(): Anthropic {
  if (!ENV.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  if (!client) client = new Anthropic({ apiKey: ENV.anthropicApiKey });
  return client;
}
