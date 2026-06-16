/**
 * runSession.ts — drive one conversational turn of a Managed Agents session.
 *
 * Implements the documented client patterns:
 *   - stream-first, then send the kickoff (so no early events are missed)
 *   - host-side custom tools: on `agent.custom_tool_use` we run the handler with
 *     OUR credentials and reply with `user.custom_tool_result` (the secret/DB
 *     access never enters the agent container)
 *   - correct idle gate: break on terminal idle (stop_reason ≠ requires_action)
 *     or terminated; keep reading while the agent is mid-work
 *   - hard wall-clock timeout via an AbortController
 *
 * Sessions are stateful server-side: pass the returned `sessionId` back on the
 * next turn to continue the same conversation (true multi-turn memory).
 */
import { getManagedAgentsClient } from "./client";
import { logger } from "../../lib/logger";

export type CustomToolHandler = (input: Record<string, unknown>) => Promise<string>;

export interface ConversationTurnOptions {
  agentId: string;
  agentVersion?: number;
  environmentId: string;
  /** Resume an existing session for multi-turn memory; omit to start a new one. */
  sessionId?: string;
  /** The user's message for this turn. */
  message: string;
  /**
   * Operator context established once when a NEW session is created (sent as a
   * `system.message` before the first user message) — e.g. which author this
   * session embodies. Ignored when resuming an existing session.
   */
  systemContext?: string;
  /** Host-side handlers keyed by custom tool name. */
  customToolHandlers?: Record<string, CustomToolHandler>;
  /** Optional title when creating a new session. */
  title?: string;
  timeoutMs?: number;
}

export interface ConversationTurnResult {
  sessionId: string;
  reply: string;
  /** Names of custom tools the agent invoked this turn (for observability). */
  toolCalls: string[];
}

const DEFAULT_TIMEOUT_MS = 90_000;

/** Pull plain text out of an agent.message event's content blocks. */
function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((b) => (b && typeof b === "object" && (b as { type?: string }).type === "text" ? (b as { text?: string }).text ?? "" : ""))
    .join("");
}

export async function runConversationTurn(opts: ConversationTurnOptions): Promise<ConversationTurnResult> {
  const client = getManagedAgentsClient();
  const handlers = opts.customToolHandlers ?? {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    // 1. Create or resume the session.
    let sessionId = opts.sessionId;
    const isNewSession = !sessionId;
    if (!sessionId) {
      const session = await client.beta.sessions.create({
        agent: opts.agentVersion
          ? { type: "agent", id: opts.agentId, version: opts.agentVersion }
          : opts.agentId,
        environment_id: opts.environmentId,
        ...(opts.title ? { title: opts.title } : {}),
      });
      sessionId = session.id;
    }

    // 2. Stream-first, then send the kickoff. On a new session, establish the
    //    operator context (e.g. which author to embody) before the user turn.
    const stream = await client.beta.sessions.events.stream(sessionId, undefined, {
      signal: controller.signal,
    });
    if (isNewSession && opts.systemContext) {
      await client.beta.sessions.events.send(sessionId, {
        events: [{ type: "system.message", content: [{ type: "text", text: opts.systemContext }] }],
      });
    }
    await client.beta.sessions.events.send(sessionId, {
      events: [{ type: "user.message", content: [{ type: "text", text: opts.message }] }],
    });

    let reply = "";
    const toolCalls: string[] = [];

    // 3. Drain to a terminal state.
    for await (const event of stream) {
      const e = event as unknown as { type: string; [k: string]: unknown };

      if (e.type === "agent.message") {
        reply += extractText(e.content);
      } else if (e.type === "agent.custom_tool_use") {
        const name = String(e.name ?? "");
        const useId = String(e.id ?? "");
        toolCalls.push(name);
        const handler = handlers[name];
        let result: string;
        let isError = false;
        if (!handler) {
          result = `No host-side handler registered for tool "${name}".`;
          isError = true;
        } else {
          try {
            result = await handler((e.input as Record<string, unknown>) ?? {});
          } catch (err) {
            result = `Tool "${name}" failed: ${err instanceof Error ? err.message : "unknown error"}`;
            isError = true;
          }
        }
        await client.beta.sessions.events.send(sessionId, {
          events: [
            {
              type: "user.custom_tool_result",
              custom_tool_use_id: useId,
              content: [{ type: "text", text: result }],
              is_error: isError,
            },
          ],
        });
      } else if (e.type === "session.status_terminated") {
        break;
      } else if (e.type === "session.status_idle") {
        const stop = (e.stop_reason as { type?: string } | undefined)?.type;
        if (stop !== "requires_action") break; // end_turn / retries_exhausted → done
      }
    }

    return { sessionId, reply: reply.trim(), toolCalls };
  } catch (err) {
    if (controller.signal.aborted) {
      logger.warn("[managedAgents] conversation turn timed out");
      throw new Error("The agent took too long to respond. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
