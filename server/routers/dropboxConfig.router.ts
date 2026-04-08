/**
 * Dropbox Folder Configuration Router
 *
 * Provides tRPC procedures for managing Dropbox folder connections:
 * - List all configured folders
 * - Create / update / delete folder configs
 * - Toggle enabled/disabled
 * - Validate a path against the live Dropbox API
 * - Validate all paths in bulk
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { dropboxFolderConfigs } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
import { getDropboxAccessToken } from "../dropbox.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function validateDropboxPath(path: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const token = await getDropboxAccessToken();
    const res = await fetch("https://api.dropboxapi.com/2/files/get_metadata", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    });
    const data = (await res.json()) as { ".tag"?: string; error?: { ".tag": string } };
    if (data[".tag"] === "folder" || data[".tag"] === "file") {
      return { valid: true };
    }
    const tag = data.error?.[".tag"] ?? "unknown";
    return { valid: false, error: `Dropbox error: ${tag}` };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

export const dropboxConfigRouter = router({
  /** List all folder configs ordered by sortOrder */
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return db
      .select()
      .from(dropboxFolderConfigs)
      .orderBy(asc(dropboxFolderConfigs.sortOrder));
  }),

  /** Create a new folder config */
  create: protectedProcedure
    .input(
      z.object({
        folderKey: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, underscores"),
        label: z.string().min(1).max(128),
        description: z.string().optional(),
        dropboxPath: z.string().min(1).max(1024),
        dropboxWebUrl: z.string().url().optional().or(z.literal("")),
        category: z.enum(["backup", "inbox", "source", "design", "other"]),
        enabled: z.boolean().default(true),
        sortOrder: z.number().int().default(0),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.insert(dropboxFolderConfigs).values({
        folderKey: input.folderKey,
        label: input.label,
        description: input.description ?? null,
        dropboxPath: input.dropboxPath,
        dropboxWebUrl: input.dropboxWebUrl || null,
        category: input.category,
        enabled: input.enabled,
        validationStatus: "unchecked",
        sortOrder: input.sortOrder,
      });
      return { success: true };
    }),

  /** Update an existing folder config */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        label: z.string().min(1).max(128).optional(),
        description: z.string().optional(),
        dropboxPath: z.string().min(1).max(1024).optional(),
        dropboxWebUrl: z.string().url().optional().or(z.literal("")).optional(),
        category: z.enum(["backup", "inbox", "source", "design", "other"]).optional(),
        enabled: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...fields } = input;
      const updateData: Record<string, unknown> = {};
      if (fields.label !== undefined) updateData.label = fields.label;
      if (fields.description !== undefined) updateData.description = fields.description;
      if (fields.dropboxPath !== undefined) {
        updateData.dropboxPath = fields.dropboxPath;
        updateData.validationStatus = "unchecked"; // reset on path change
        updateData.validationError = null;
      }
      if (fields.dropboxWebUrl !== undefined) updateData.dropboxWebUrl = fields.dropboxWebUrl || null;
      if (fields.category !== undefined) updateData.category = fields.category;
      if (fields.enabled !== undefined) updateData.enabled = fields.enabled;
      if (fields.sortOrder !== undefined) updateData.sortOrder = fields.sortOrder;
      await db.update(dropboxFolderConfigs).set(updateData).where(eq(dropboxFolderConfigs.id, id));
      return { success: true };
    }),

  /** Toggle enabled/disabled for a folder config */
  toggleEnabled: protectedProcedure
    .input(z.object({ id: z.number().int(), enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(dropboxFolderConfigs)
        .set({ enabled: input.enabled })
        .where(eq(dropboxFolderConfigs.id, input.id));
      return { success: true };
    }),

  /** Delete a folder config */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db.delete(dropboxFolderConfigs).where(eq(dropboxFolderConfigs.id, input.id));
      return { success: true };
    }),

  /** Validate a single folder path against the live Dropbox API */
  validatePath: protectedProcedure
    .input(z.object({ id: z.number().int(), path: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const result = await validateDropboxPath(input.path);
      await db
        .update(dropboxFolderConfigs)
        .set({
          validationStatus: result.valid ? "valid" : "invalid",
          validationError: result.error ?? null,
          lastValidatedAt: new Date(),
        })
        .where(eq(dropboxFolderConfigs.id, input.id));
      return result;
    }),

  /** Validate all enabled folder paths in bulk */
  validateAll: protectedProcedure.mutation(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const configs = await db.select().from(dropboxFolderConfigs);
    const results: Array<{ id: number; folderKey: string; label: string; valid: boolean; error?: string }> = [];
    for (const config of configs) {
      const result = await validateDropboxPath(config.dropboxPath);
      await db
        .update(dropboxFolderConfigs)
        .set({
          validationStatus: result.valid ? "valid" : "invalid",
          validationError: result.error ?? null,
          lastValidatedAt: new Date(),
        })
        .where(eq(dropboxFolderConfigs.id, config.id));
      results.push({ id: config.id, folderKey: config.folderKey, label: config.label, ...result });
    }
    return { results, total: results.length, valid: results.filter((r) => r.valid).length, invalid: results.filter((r) => !r.valid).length };
  }),
});
