/**
 * runtime.ts — the Super Conversations agent runtime.
 *
 * A small, self-hosted agentic loop built on the official Anthropic SDK
 * (`@anthropic-ai/sdk`, Claude API + tool use). We host the loop ourselves
 * because every agent's only tools are queries against *our* Neon pgvector and
 * calls to *our* other agents — there is no need for an Anthropic-hosted
 * container (Managed Agents), and self-hosting keeps the retrieval tools running
 * with our own credentials inside this server.
 *
 * An "agent" here = a persona system prompt + a set of tools. `runAgent` drives
 * the messages.create → tool_use → tool_result loop until the model stops
 * calling tools, then returns the final text. Thinking blocks are preserved
 * across rounds (required by the API while a turn is mid-tool-use).
 *
 * Model: claude-opus-4-8 with adaptive thinking (per the claude-api guidance for
 * non-trivial, multi-step reasoning).
 */
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../lib/logger";

export const AGENT_MODEL = "claude-opus-4-8";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export interface AgentTool {
  name: string;
  description: string;
  /** JSON Schema object ({ type: "object", properties: {...}, required: [...] }). */
  inputSchema: Anthropic.Tool.InputSchema;
  handler: (input: unknown) => Promise<string>;
}

export interface AgentTurn {
  role: "user" | "assistant";
  content: string;
}

export interface RunAgentOptions {
  system: string;
  tools?: AgentTool[];
  messages: AgentTurn[];
  maxTokens?: number;
  /** Hard ceiling on tool-use rounds, to bound cost and prevent runaway loops. */
  maxToolRounds?: number;
}

export interface RunAgentResult {
  text: string;
  toolCalls: number;
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function runAgent(opts: RunAgentOptions): Promise<RunAgentResult> {
  const c = client();
  const tools = opts.tools ?? [];
  const toolDefs: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  const messages: Anthropic.MessageParam[] = opts.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const maxRounds = opts.maxToolRounds ?? 6;
  let toolCalls = 0;

  for (let round = 0; round <= maxRounds; round++) {
    const resp = await c.messages.create({
      model: AGENT_MODEL,
      max_tokens: opts.maxTokens ?? 4096,
      thinking: { type: "adaptive" },
      system: opts.system,
      messages,
      ...(toolDefs.length ? { tools: toolDefs } : {}),
    });

    if (resp.stop_reason === "tool_use") {
      // Preserve the full assistant turn (incl. thinking blocks) before answering tools.
      messages.push({ role: "assistant", content: resp.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type !== "tool_use") continue;
        toolCalls++;
        const tool = toolMap.get(block.name);
        let output: string;
        try {
          output = tool
            ? await tool.handler(block.input)
            : `Error: unknown tool "${block.name}".`;
        } catch (err) {
          logger.warn(`[agents] tool "${block.name}" failed:`, err);
          output = `Tool error: ${err instanceof Error ? err.message : "unknown error"}`;
        }
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: output });
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    return { text: textOf(resp.content), toolCalls };
  }

  logger.warn(`[agents] hit maxToolRounds (${maxRounds}) without a final answer`);
  return {
    text: "(I wasn't able to finish within the allowed number of retrieval steps.)",
    toolCalls,
  };
}
