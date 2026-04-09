/**
 * Tests for the authorAliases tRPC router.
 *
 * Because the router depends on a live MySQL database, these tests mock
 * the `getDb()` helper and verify the router's behaviour in isolation.
 *
 * Covered:
 *   - getMap: returns a Record<rawName, canonical>
 *   - getAll: returns paginated aliases with optional search
 *   - upsert (create): inserts a new alias
 *   - upsert (update): updates an existing alias
 *   - delete: removes an alias by id
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Helpers ────────────────────────────────────────────────────────────────────

function createAdminCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function createPublicCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ── Mock the DB module ─────────────────────────────────────────────────────────
// We mock at the module level so that getDb() returns a controlled stub.
vi.mock("./db", async (importOriginal) => {
  const original = await importOriginal<typeof import("./db")>();
  return {
    ...original,
    getDb: vi.fn(),
  };
});

import { getDb } from "./db";

// ── Sample data ────────────────────────────────────────────────────────────────
const SAMPLE_ALIASES = [
  { id: 1, rawName: "Adam Grant - Org Psych", canonical: "Adam Grant", note: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 2, rawName: "Stephen Covey", canonical: "Stephen R. Covey", note: "Middle initial", createdAt: new Date(), updatedAt: new Date() },
  { id: 3, rawName: "Robert Cialdini", canonical: "Robert B. Cialdini", note: null, createdAt: new Date(), updatedAt: new Date() },
];

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("authorAliases.getMap", () => {
  beforeEach(() => {
    vi.mocked(getDb).mockResolvedValue({
      select: () => ({
        from: () => Promise.resolve(SAMPLE_ALIASES),
      }),
    } as unknown as Awaited<ReturnType<typeof getDb>>);
  });

  it("returns a Record<rawName, canonical>", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const map = await caller.authorAliases.getMap();
    expect(map).toEqual({
      "Adam Grant - Org Psych": "Adam Grant",
      "Stephen Covey": "Stephen R. Covey",
      "Robert Cialdini": "Robert B. Cialdini",
    });
  });

  it("returns empty object when DB is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    const caller = appRouter.createCaller(createPublicCtx());
    const map = await caller.authorAliases.getMap();
    expect(map).toEqual({});
  });
});

describe("authorAliases.getAll", () => {
  beforeEach(() => {
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                offset: () => Promise.resolve(SAMPLE_ALIASES),
              }),
            }),
          }),
        }),
      }),
    };
    // Second call for COUNT
    let callCount = 0;
    vi.mocked(getDb).mockResolvedValue({
      select: (...args: unknown[]) => {
        callCount++;
        if (callCount % 2 === 0) {
          // COUNT query
          return {
            from: () => ({
              where: () => Promise.resolve([{ count: SAMPLE_ALIASES.length }]),
            }),
          };
        }
        return mockDb.select(...args);
      },
    } as unknown as Awaited<ReturnType<typeof getDb>>);
  });

  it("returns aliases array and total count", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.authorAliases.getAll({ limit: 200 });
    expect(result.aliases).toHaveLength(SAMPLE_ALIASES.length);
    expect(typeof result.total).toBe("number");
  });

  it("returns empty result when DB is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    const caller = appRouter.createCaller(createPublicCtx());
    const result = await caller.authorAliases.getAll();
    expect(result).toEqual({ aliases: [], total: 0 });
  });
});

describe("authorAliases.upsert (create)", () => {
  it("inserts a new alias and returns action=created", async () => {
    const insertResult = { insertId: 42 };
    vi.mocked(getDb).mockResolvedValue({
      insert: () => ({
        ignore: () => ({
          values: () => Promise.resolve([insertResult]),
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof getDb>>);

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.authorAliases.upsert({
      rawName: "New Raw Name",
      canonical: "New Canonical",
    });
    expect(result.success).toBe(true);
    expect(result.action).toBe("created");
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(
      caller.authorAliases.upsert({ rawName: "Test", canonical: "Test" })
    ).rejects.toThrow();
  });
});

describe("authorAliases.upsert (update)", () => {
  it("updates an existing alias and returns action=updated", async () => {
    vi.mocked(getDb).mockResolvedValue({
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof getDb>>);

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.authorAliases.upsert({
      id: 1,
      rawName: "Updated Raw",
      canonical: "Updated Canonical",
    });
    expect(result.success).toBe(true);
    expect(result.action).toBe("updated");
  });
});

describe("authorAliases.delete", () => {
  it("deletes an alias by id", async () => {
    vi.mocked(getDb).mockResolvedValue({
      delete: () => ({
        where: () => Promise.resolve(),
      }),
    } as unknown as Awaited<ReturnType<typeof getDb>>);

    const caller = appRouter.createCaller(createAdminCtx());
    const result = await caller.authorAliases.delete({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(createPublicCtx());
    await expect(caller.authorAliases.delete({ id: 1 })).rejects.toThrow();
  });
});
