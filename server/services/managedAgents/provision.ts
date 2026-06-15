/**
 * provision.ts — idempotent creation of managed agents.
 *
 * Managed Agents must be created ONCE and reused by ID (creating one per request
 * is the documented #1 anti-pattern). This resolves (and caches in the
 * `managed_agents` table) the Anthropic agent + environment IDs, re-provisioning
 * only when the config (model/system/tools) changes — detected via a config hash.
 *
 * Agents defined here:
 *   - Virgilio           (AUTHOR_AGENT_KEY)              — author conversational agent (Opus)
 *   - Researcher         (RESEARCHER_AGENT_KEY)           — avatar research task agent (Sonnet)
 *   - Super Conversations (SUPER_CONVERSATIONS_AGENT_KEY) — book ghostwriter (Sonnet)
 */
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { managedAgents } from "../../../drizzle/schema";
import { getManagedAgentsClient } from "./client";
import { getOpusModel, getSonnetModel } from "../../lib/modelResolver";
import {
  AUTHOR_AGENT_KEY,
  AUTHOR_AGENT_SYSTEM,
  AUTHOR_AGENT_TOOLS,
} from "./authorAgent";
import {
  RESEARCHER_AGENT_KEY,
  RESEARCHER_AGENT_SYSTEM,
  RESEARCHER_AGENT_TOOLS,
} from "./researcherAgent";
import {
  SUPER_CONVERSATIONS_AGENT_KEY,
  SUPER_CONVERSATIONS_AGENT_SYSTEM,
  SUPER_CONVERSATIONS_AGENT_TOOLS,
} from "./superConversationsAgent";
import {
  BOOK_AGENT_KEY,
  BOOK_AGENT_SYSTEM,
  BOOK_AGENT_TOOLS,
} from "./bookAgent";
import { logger } from "../../lib/logger";

/** Display name of the conversational agent. */
export const BOT_NAME = "Virgilio";

export interface ProvisionedAgent {
  agentId: string;
  agentVersion?: number;
  environmentId: string;
}

function configHash(model: string, system: string, tools: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ model, system, tools }))
    .digest("hex");
}

/**
 * Ensure the author conversational agent exists and return its IDs.
 * Idempotent: reuses the stored agent/environment when the config is unchanged,
 * updates the agent (new version) when the config drifts.
 */
export async function ensureAuthorAgent(): Promise<ProvisionedAgent> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const client = getManagedAgentsClient();

  const model = await getOpusModel();
  const system = AUTHOR_AGENT_SYSTEM;
  const tools = AUTHOR_AGENT_TOOLS;
  const hash = configHash(model, system, tools);

  const [row] = await db
    .select()
    .from(managedAgents)
    .where(eq(managedAgents.agentKey, AUTHOR_AGENT_KEY))
    .limit(1);

  if (row?.agentId && row.environmentId && row.configHash === hash) {
    return {
      agentId: row.agentId,
      agentVersion: row.agentVersion ? Number(row.agentVersion) : undefined,
      environmentId: row.environmentId,
    };
  }

  // Environment: reuse stored one, else create a cloud environment.
  const environmentId =
    row?.environmentId ??
    (
      await client.beta.environments.create({
        name: `rc-library-${AUTHOR_AGENT_KEY}`,
        config: { type: "cloud", networking: { type: "unrestricted" } },
      })
    ).id;

  const agentName = `${BOT_NAME} — Author Conversational Agent`;

  // Agent: update in place if it exists (new version), else create.
  let agentId = row?.agentId;
  let version: number;
  if (agentId) {
    // agents.update needs the current version (optimistic lock).
    const currentVersion = row?.agentVersion
      ? Number(row.agentVersion)
      : (await client.beta.agents.retrieve(agentId)).version;
    const updated = await client.beta.agents.update(agentId, {
      version: currentVersion,
      name: agentName,
      model,
      system,
      tools,
    });
    version = updated.version;
  } else {
    const created = await client.beta.agents.create({
      name: agentName,
      model,
      system,
      tools,
    });
    agentId = created.id;
    version = created.version;
  }

  const values = {
    agentId,
    agentVersion: String(version),
    environmentId,
    model,
    configHash: hash,
  };
  if (row) {
    await db.update(managedAgents).set(values).where(eq(managedAgents.agentKey, AUTHOR_AGENT_KEY));
  } else {
    await db.insert(managedAgents).values({ agentKey: AUTHOR_AGENT_KEY, ...values });
  }

  logger.info(`[managedAgents] Provisioned "${BOT_NAME}" agent ${agentId} v${version} (env ${environmentId})`);
  return { agentId, agentVersion: version, environmentId };
}

/**
 * Ensure the author researcher agent exists and return its IDs.
 * Same idempotent pattern as ensureAuthorAgent — reuses stored IDs when
 * the config hash is unchanged; creates or updates otherwise.
 * Uses Sonnet (task-completion, not conversation).
 */
export async function ensureResearcherAgent(): Promise<ProvisionedAgent> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const client = getManagedAgentsClient();

  const model = await getSonnetModel();
  const system = RESEARCHER_AGENT_SYSTEM;
  const tools = RESEARCHER_AGENT_TOOLS;
  const hash = configHash(model, system, tools);

  const [row] = await db
    .select()
    .from(managedAgents)
    .where(eq(managedAgents.agentKey, RESEARCHER_AGENT_KEY))
    .limit(1);

  if (row?.agentId && row.environmentId && row.configHash === hash) {
    return {
      agentId: row.agentId,
      agentVersion: row.agentVersion ? Number(row.agentVersion) : undefined,
      environmentId: row.environmentId,
    };
  }

  // Reuse or create a cloud environment.
  const environmentId =
    row?.environmentId ??
    (
      await client.beta.environments.create({
        name: `rc-library-${RESEARCHER_AGENT_KEY}`,
        config: { type: "cloud", networking: { type: "unrestricted" } },
      })
    ).id;

  const agentName = "Author Researcher Agent";

  let agentId = row?.agentId;
  let version: number;
  if (agentId) {
    const currentVersion = row?.agentVersion
      ? Number(row.agentVersion)
      : (await client.beta.agents.retrieve(agentId)).version;
    const updated = await client.beta.agents.update(agentId, {
      version: currentVersion,
      name: agentName,
      model,
      system,
      tools,
    });
    version = updated.version;
  } else {
    const created = await client.beta.agents.create({ name: agentName, model, system, tools });
    agentId = created.id;
    version = created.version;
  }

  const values = {
    agentId,
    agentVersion: String(version),
    environmentId,
    model,
    configHash: hash,
  };
  if (row) {
    await db.update(managedAgents).set(values).where(eq(managedAgents.agentKey, RESEARCHER_AGENT_KEY));
  } else {
    await db.insert(managedAgents).values({ agentKey: RESEARCHER_AGENT_KEY, ...values });
  }

  logger.info(`[managedAgents] Provisioned researcher agent ${agentId} v${version} (env ${environmentId})`);
  return { agentId, agentVersion: version, environmentId };
}

/**
 * Ensure the Super Conversations ghostwriter agent exists and return its IDs.
 * Pure writing agent — no custom tools; uses Sonnet for quality + speed.
 */
export async function ensureSuperConversationsAgent(): Promise<ProvisionedAgent> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const client = getManagedAgentsClient();

  const model = await getSonnetModel();
  const system = SUPER_CONVERSATIONS_AGENT_SYSTEM;
  const tools = SUPER_CONVERSATIONS_AGENT_TOOLS;
  const hash = configHash(model, system, tools);

  const [row] = await db
    .select()
    .from(managedAgents)
    .where(eq(managedAgents.agentKey, SUPER_CONVERSATIONS_AGENT_KEY))
    .limit(1);

  if (row?.agentId && row.environmentId && row.configHash === hash) {
    return {
      agentId: row.agentId,
      agentVersion: row.agentVersion ? Number(row.agentVersion) : undefined,
      environmentId: row.environmentId,
    };
  }

  const environmentId =
    row?.environmentId ??
    (
      await client.beta.environments.create({
        name: `rc-library-${SUPER_CONVERSATIONS_AGENT_KEY}`,
        config: { type: "cloud", networking: { type: "unrestricted" } },
      })
    ).id;

  const agentName = "Super Conversations — Ghostwriter";

  let agentId = row?.agentId;
  let version: number;
  if (agentId) {
    const currentVersion = row?.agentVersion
      ? Number(row.agentVersion)
      : (await client.beta.agents.retrieve(agentId)).version;
    const updated = await client.beta.agents.update(agentId, {
      version: currentVersion,
      name: agentName,
      model,
      system,
      tools,
    });
    version = updated.version;
  } else {
    const created = await client.beta.agents.create({ name: agentName, model, system, tools });
    agentId = created.id;
    version = created.version;
  }

  const values = {
    agentId,
    agentVersion: String(version),
    environmentId,
    model,
    configHash: hash,
  };
  if (row) {
    await db.update(managedAgents).set(values).where(eq(managedAgents.agentKey, SUPER_CONVERSATIONS_AGENT_KEY));
  } else {
    await db.insert(managedAgents).values({ agentKey: SUPER_CONVERSATIONS_AGENT_KEY, ...values });
  }

  logger.info(`[managedAgents] Provisioned Super Conversations ghostwriter ${agentId} v${version} (env ${environmentId})`);
  return { agentId, agentVersion: version, environmentId };
}

/**
 * Ensure the book conversational agent exists and return its IDs.
 * Full parity with ensureAuthorAgent — one agent, N book sessions.
 * Uses Opus (same as author agent — depth of embodiment matters equally).
 */
export async function ensureBookAgent(): Promise<ProvisionedAgent> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const client = getManagedAgentsClient();

  const model = await getOpusModel();
  const system = BOOK_AGENT_SYSTEM;
  const tools = BOOK_AGENT_TOOLS;
  const hash = configHash(model, system, tools);

  const [row] = await db
    .select()
    .from(managedAgents)
    .where(eq(managedAgents.agentKey, BOOK_AGENT_KEY))
    .limit(1);

  if (row?.agentId && row.environmentId && row.configHash === hash) {
    return {
      agentId: row.agentId,
      agentVersion: row.agentVersion ? Number(row.agentVersion) : undefined,
      environmentId: row.environmentId,
    };
  }

  const environmentId =
    row?.environmentId ??
    (
      await client.beta.environments.create({
        name: `rc-library-${BOOK_AGENT_KEY}`,
        config: { type: "cloud", networking: { type: "unrestricted" } },
      })
    ).id;

  const agentName = "Book Knowledge Agent";

  let agentId = row?.agentId;
  let version: number;
  if (agentId) {
    const currentVersion = row?.agentVersion
      ? Number(row.agentVersion)
      : (await client.beta.agents.retrieve(agentId)).version;
    const updated = await client.beta.agents.update(agentId, {
      version: currentVersion,
      name: agentName,
      model,
      system,
      tools,
    });
    version = updated.version;
  } else {
    const created = await client.beta.agents.create({ name: agentName, model, system, tools });
    agentId = created.id;
    version = created.version;
  }

  const values = {
    agentId,
    agentVersion: String(version),
    environmentId,
    model,
    configHash: hash,
  };
  if (row) {
    await db.update(managedAgents).set(values).where(eq(managedAgents.agentKey, BOOK_AGENT_KEY));
  } else {
    await db.insert(managedAgents).values({ agentKey: BOOK_AGENT_KEY, ...values });
  }

  logger.info(`[managedAgents] Provisioned book agent ${agentId} v${version} (env ${environmentId})`);
  return { agentId, agentVersion: version, environmentId };
}
