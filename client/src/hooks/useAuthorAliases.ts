/**
 * useAuthorAliases.ts
 *
 * React hook that provides a DB-backed `canonicalName()` function.
 *
 * The hook fetches the full alias map from the server via tRPC
 * (trpc.authorAliases.getMap) and returns a `canonicalName()` function
 * that resolves raw author name variants to their canonical display names.
 *
 * While the server map is loading, the hook falls back to the hardcoded
 * AUTHOR_ALIASES from client/src/lib/authorAliases.ts so callers always
 * get a synchronous result.
 *
 * Usage:
 *   const { canonicalName, isLoading } = useAuthorAliases();
 *   const display = canonicalName("Matthew Dixon - Customer experience and loyalty");
 *   // → "Matthew Dixon"
 *
 * Migration path:
 *   1. Replace `import { canonicalName } from "@/lib/authorAliases"` with
 *      `const { canonicalName } = useAuthorAliases()` in each component.
 *   2. Once all callers are migrated, the hardcoded file can be removed.
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { AUTHOR_ALIASES } from "@/lib/authorAliases";

/**
 * Resolve a raw name using a given alias map.
 * Applies the same two-step logic as the server-side canonicalNameFromDb().
 */
function resolveCanonical(raw: string, aliasMap: Record<string, string>): string {
  if (!raw) return raw;
  // 1. Direct alias lookup
  if (aliasMap[raw]) return aliasMap[raw];
  // 2. Strip " - specialty" suffix and try again
  const dashIdx = raw.indexOf(" - ");
  if (dashIdx !== -1) {
    const base = raw.slice(0, dashIdx).trim();
    if (aliasMap[base]) return aliasMap[base];
    return base;
  }
  return raw;
}

export function useAuthorAliases() {
  // Fetch the server alias map — stale-while-revalidate, 5-minute cache
  const { data: serverMap, isLoading } = trpc.authorAliases.getMap.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
    refetchOnWindowFocus: false,
  });

  // Merge: server map takes precedence over hardcoded fallback
  const aliasMap = useMemo<Record<string, string>>(() => {
    if (serverMap && Object.keys(serverMap).length > 0) {
      return serverMap;
    }
    // Fallback to hardcoded map while server map is loading
    return AUTHOR_ALIASES;
  }, [serverMap]);

  const canonicalName = useMemo(
    () => (raw: string) => resolveCanonical(raw, aliasMap),
    [aliasMap]
  );

  return { canonicalName, aliasMap, isLoading };
}

/**
 * Non-hook version for use outside React components.
 * Uses only the hardcoded fallback (no DB lookup).
 * Prefer useAuthorAliases() in React components.
 */
export { resolveCanonical };
