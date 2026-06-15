import { int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * managed_agents — registry of provisioned Claude Managed Agents.
 *
 * Managed Agents must be created once (a versioned, persisted Anthropic object)
 * and referenced by ID on every session — never re-created per request. This
 * table is the durable store of "which Anthropic agent/environment IDs back
 * each logical agent in this app", so provisioning is idempotent across deploys
 * and restarts.
 */
export const managedAgents = mysqlTable("managed_agents", {
  id: int("id").autoincrement().primaryKey(),
  /** Stable logical key, e.g. "author-conversational-agent". Unique. */
  agentKey: varchar("agentKey", { length: 128 }).notNull().unique(),
  /** Anthropic agent id (agent_…). */
  agentId: varchar("agentId", { length: 128 }).notNull(),
  /** Pinned agent version returned at create/update time. */
  agentVersion: varchar("agentVersion", { length: 64 }),
  /** Anthropic environment id (env_…) the agent's sessions run in. */
  environmentId: varchar("environmentId", { length: 128 }),
  /** Model the agent was provisioned with (for drift detection vs the resolver). */
  model: varchar("model", { length: 128 }),
  /** SHA-256 of the provisioning config — lets us detect when a re-provision is needed. */
  configHash: varchar("configHash", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ManagedAgent = typeof managedAgents.$inferSelect;
export type InsertManagedAgent = typeof managedAgents.$inferInsert;
