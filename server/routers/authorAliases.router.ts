/**
 * authorAliases.router.ts
 *
 * Full CRUD for the `author_aliases` table.
 * Replaces the hardcoded client/src/lib/authorAliases.ts lookup.
 *
 * Procedures:
 *   - getAll        : return all aliases (public, cached)
 *   - getMap        : return Record<rawName, canonical> (public, for client hook)
 *   - upsert        : create or update a single alias (admin)
 *   - bulkUpsert    : batch create/update aliases (admin)
 *   - delete        : remove an alias by id (admin)
 *   - resolveNames  : resolve an array of raw names → canonical names (public)
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { authorAliases } from "../../drizzle/schema";
import { eq, asc, like, or, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

// ── Server-side utility ────────────────────────────────────────────────────

/**
 * Resolve a raw author name to its canonical display name using the DB.
 * Falls back to the input string if no alias is found.
 *
 * This is the server-side equivalent of the client-side canonicalName() function.
 * Use this in server procedures instead of importing from authorAliases.ts.
 */
export async function canonicalNameFromDb(raw: string): Promise<string> {
  if (!raw) return raw;
  const db = await getDb();
  if (!db) return raw; // DB unavailable — fall back to raw name

  // 1. Direct alias lookup
  const direct = await db
    .select({ canonical: authorAliases.canonical })
    .from(authorAliases)
    .where(eq(authorAliases.rawName, raw))
    .limit(1);
  if (direct.length > 0) return direct[0].canonical;

  // 2. Strip " - specialty" suffix and try again
  const dashIdx = raw.indexOf(" - ");
  if (dashIdx !== -1) {
    const base = raw.slice(0, dashIdx).trim();
    const baseResult = await db
      .select({ canonical: authorAliases.canonical })
      .from(authorAliases)
      .where(eq(authorAliases.rawName, base))
      .limit(1);
    if (baseResult.length > 0) return baseResult[0].canonical;
    return base; // return clean base name even without an explicit alias
  }
  return raw;
}

/**
 * Bulk resolve an array of raw names to canonical names.
 * More efficient than calling canonicalNameFromDb() in a loop.
 */
export async function canonicalNamesFromDb(
  rawNames: string[]
): Promise<Record<string, string>> {
  if (rawNames.length === 0) return {};
  const db = await getDb();
  if (!db) {
    // DB unavailable — return identity map
    const fallback: Record<string, string> = {};
    for (const r of rawNames) fallback[r] = r;
    return fallback;
  }

  const rows = await db
    .select({ rawName: authorAliases.rawName, canonical: authorAliases.canonical })
    .from(authorAliases);

  const aliasMap: Record<string, string> = {};
  for (const row of rows) {
    aliasMap[row.rawName] = row.canonical;
  }

  const result: Record<string, string> = {};
  for (const raw of rawNames) {
    if (!raw) { result[raw] = raw; continue; }
    if (aliasMap[raw]) { result[raw] = aliasMap[raw]; continue; }
    const dashIdx = raw.indexOf(" - ");
    if (dashIdx !== -1) {
      const base = raw.slice(0, dashIdx).trim();
      result[raw] = aliasMap[base] ?? base;
    } else {
      result[raw] = raw;
    }
  }
  return result;
}

// ── Router ─────────────────────────────────────────────────────────────────

export const authorAliasesRouter = router({
  /**
   * Return all aliases sorted by canonical then rawName.
   * Public — used by Admin UI to list all aliases.
   */
  getAll: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(500).default(200),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { aliases: [], total: 0 };
      const { search, limit = 200, offset = 0 } = input ?? {};
      const whereClause = search
        ? or(
            like(authorAliases.rawName, `%${search}%`),
            like(authorAliases.canonical, `%${search}%`)
          )
        : undefined;

      const rows = await db
        .select()
        .from(authorAliases)
        .where(whereClause)
        .orderBy(asc(authorAliases.canonical), asc(authorAliases.rawName))
        .limit(limit)
        .offset(offset);

      const total = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(authorAliases)
        .where(whereClause);

      return { aliases: rows, total: total[0]?.count ?? 0 };
    }),

  /**
   * Return the full alias map as a plain Record<rawName, canonical>.
   * Public — consumed by the client-side useAuthorAliases() hook.
   */
  getMap: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return {} as Record<string, string>;
    const rows = await db
      .select({ rawName: authorAliases.rawName, canonical: authorAliases.canonical })
      .from(authorAliases);
    const map: Record<string, string> = {};
    for (const row of rows) {
      map[row.rawName] = row.canonical;
    }
    return map;
  }),

  /**
   * Create or update a single alias.
   * Protected — admin only.
   */
  upsert: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(), // if provided, update; otherwise create
        rawName: z.string().min(1).max(512),
        canonical: z.string().min(1).max(256),
        note: z.string().max(512).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      if (input.id) {
        // Update
        await db
          .update(authorAliases)
          .set({
            rawName: input.rawName,
            canonical: input.canonical,
            note: input.note ?? null,
          })
          .where(eq(authorAliases.id, input.id));
        logger.info(`[authorAliases] Updated alias id=${input.id} by user=${ctx.user?.id}`);
        return { success: true, action: "updated" as const };
      } else {
        // Create
        const [result] = await db
          .insert(authorAliases)
          .ignore()
          .values({
            rawName: input.rawName,
            canonical: input.canonical,
            note: input.note ?? null,
          });
        logger.info(`[authorAliases] Created alias rawName="${input.rawName}" by user=${ctx.user?.id}`);
        return { success: true, action: "created" as const, insertId: result.insertId };
      }
    }),

  /**
   * Bulk upsert aliases (for re-seeding or import).
   * Protected — admin only.
   */
  bulkUpsert: protectedProcedure
    .input(
      z.object({
        aliases: z.array(
          z.object({
            rawName: z.string().min(1).max(512),
            canonical: z.string().min(1).max(256),
            note: z.string().max(512).optional(),
          })
        ).max(1000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      let inserted = 0;
      let updated = 0;
      for (const alias of input.aliases) {
        const existing = await db
          .select({ id: authorAliases.id })
          .from(authorAliases)
          .where(eq(authorAliases.rawName, alias.rawName))
          .limit(1);
        if (existing.length > 0) {
          await db
            .update(authorAliases)
            .set({ canonical: alias.canonical, note: alias.note ?? null })
            .where(eq(authorAliases.id, existing[0].id));
          updated++;
        } else {
          await db.insert(authorAliases).values({
            rawName: alias.rawName,
            canonical: alias.canonical,
            note: alias.note ?? null,
          });
          inserted++;
        }
      }
      logger.info(`[authorAliases] Bulk upsert: ${inserted} inserted, ${updated} updated by user=${ctx.user?.id}`);
      return { success: true, inserted, updated };
    }),

  /**
   * Delete an alias by id.
   * Protected — admin only.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(authorAliases).where(eq(authorAliases.id, input.id));
      logger.info(`[authorAliases] Deleted alias id=${input.id} by user=${ctx.user?.id}`);
      return { success: true };
    }),

  /**
   * Resolve an array of raw names to canonical names.
   * Public — used by client components that need server-side resolution.
   */
  resolveNames: publicProcedure
    .input(z.object({ rawNames: z.array(z.string()).max(500) }))
    .query(async ({ input }) => {
      return canonicalNamesFromDb(input.rawNames);
    }),
});
