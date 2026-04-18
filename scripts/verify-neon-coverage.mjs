#!/usr/bin/env node
/**
 * verify-neon-coverage.mjs
 *
 * Reports vector embedding coverage in the Neon pgvector `vector_embeddings` table.
 * Cross-references each namespace against the MySQL source tables to identify gaps.
 *
 * Namespaces checked:
 *   authors       → author_profiles (requires bio text)
 *   books         → book_profiles (requires richSummary or description)
 *   content_items → content_items (requires description)
 *   articles      → magazine_articles (requires content)
 *   rag_files     → author_rag_profiles (RAG knowledge documents)
 *
 * Usage:
 *   node scripts/verify-neon-coverage.mjs
 *   node scripts/verify-neon-coverage.mjs --json           # machine-readable JSON
 *   node scripts/verify-neon-coverage.mjs --gaps-only      # show only uncovered items
 *   node scripts/verify-neon-coverage.mjs --namespace authors   # single namespace
 *
 * Exit codes:
 *   0  All namespaces >= 80% covered (or --json mode)
 *   1  One or more namespaces below 80% coverage
 *   2  Connection error or missing env vars
 *
 * Requires:
 *   NEON_DATABASE_URL  — Neon Postgres connection string
 *   DATABASE_URL       — MySQL connection string (TiDB / PlanetScale / Neon MySQL)
 */

import pg from "pg";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pg;

// ── CLI flags ─────────────────────────────────────────────────────────────────
const args       = process.argv.slice(2);
const JSON_MODE  = args.includes("--json");
const GAPS_ONLY  = args.includes("--gaps-only");
const NS_FILTER  = (() => { const i = args.indexOf("--namespace"); return i >= 0 ? args[i + 1] : null; })();
const WARN_PCT   = 80;  // coverage % below which we warn

// ── Env validation ────────────────────────────────────────────────────────────
const NEON_URL  = process.env.NEON_DATABASE_URL;
const MYSQL_URL = process.env.DATABASE_URL;

if (!NEON_URL) {
  console.error("❌  NEON_DATABASE_URL is not set");
  process.exit(2);
}
if (!MYSQL_URL) {
  console.error("❌  DATABASE_URL is not set");
  process.exit(2);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(covered, total) {
  if (total === 0) return "—";
  return `${((covered / total) * 100).toFixed(1)}%`;
}

function bar(covered, total, width = 24) {
  if (total === 0) return "─".repeat(width);
  const filled = Math.round((covered / total) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function icon(covered, total) {
  if (total === 0) return "⚪";
  const p = (covered / total) * 100;
  if (p >= 90) return "🟢";
  if (p >= 60) return "🟡";
  return "🔴";
}

function formatAge(isoString) {
  if (!isoString) return "—";
  const ms    = Date.now() - new Date(isoString).getTime();
  const mins  = Math.floor(ms / 60_000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function parseMysqlUrl(url) {
  // Supports: mysql://user:pass@host:port/db  or  mysql2://...
  const cleaned = url.replace(/^mysql2?:\/\//, "http://");
  const u = new URL(cleaned);
  return {
    host:     u.hostname,
    port:     parseInt(u.port || "3306", 10),
    user:     u.username,
    password: u.password,
    database: u.pathname.replace(/^\//, ""),
    ssl:      { rejectUnauthorized: false },
  };
}

// ── Neon queries ──────────────────────────────────────────────────────────────
async function getNeonStats(client) {
  const res = await client.query(`
    SELECT
      namespace,
      COUNT(DISTINCT source_id)::int  AS unique_sources,
      COUNT(*)::int                   AS total_vectors,
      MIN(created_at)::text           AS oldest_vector,
      MAX(updated_at)::text           AS newest_vector
    FROM vector_embeddings
    GROUP BY namespace
    ORDER BY namespace
  `);
  const byNs = {};
  for (const row of res.rows) {
    byNs[row.namespace] = {
      uniqueSources: row.unique_sources,
      totalVectors:  row.total_vectors,
      oldestVector:  row.oldest_vector,
      newestVector:  row.newest_vector,
    };
  }
  return byNs;
}

// Fetch source_ids already in Neon for a namespace (for gap detection)
async function getNeonSourceIds(client, namespace) {
  const res = await client.query(
    `SELECT DISTINCT source_id FROM vector_embeddings WHERE namespace = $1`,
    [namespace]
  );
  return new Set(res.rows.map(r => r.source_id));
}

// ── MySQL queries ─────────────────────────────────────────────────────────────
async function getMysqlSourceCounts(conn) {
  const [[{ authorsWithBio }]] = await conn.execute(
    `SELECT COUNT(*) AS authorsWithBio FROM author_profiles
     WHERE bio IS NOT NULL AND TRIM(bio) != ''`
  );
  const [[{ authorsTotal }]] = await conn.execute(
    `SELECT COUNT(*) AS authorsTotal FROM author_profiles`
  );
  const [[{ booksWithText }]] = await conn.execute(
    `SELECT COUNT(*) AS booksWithText FROM book_profiles
     WHERE (summary IS NOT NULL AND TRIM(summary) != '')
        OR (richSummaryJson IS NOT NULL AND TRIM(richSummaryJson) != '')`
  );
  const [[{ booksTotal }]] = await conn.execute(
    `SELECT COUNT(*) AS booksTotal FROM book_profiles`
  );
  const [[{ contentWithText }]] = await conn.execute(
    `SELECT COUNT(*) AS contentWithText FROM content_items
     WHERE description IS NOT NULL AND TRIM(description) != ''`
  );
  const [[{ contentTotal }]] = await conn.execute(
    `SELECT COUNT(*) AS contentTotal FROM content_items`
  );

  let articlesWithText = 0, articlesTotal = 0;
  try {
    const [[{ awt }]] = await conn.execute(
      `SELECT COUNT(*) AS awt FROM magazine_articles
       WHERE content IS NOT NULL AND TRIM(content) != ''`
    );
    const [[{ at_ }]] = await conn.execute(
      `SELECT COUNT(*) AS at_ FROM magazine_articles`
    );
    articlesWithText = parseInt(awt, 10);
    articlesTotal    = parseInt(at_, 10);
  } catch { /* table may not exist */ }

  const [[{ ragTotal }]] = await conn.execute(
    `SELECT COUNT(*) AS ragTotal FROM author_rag_profiles`
  );

  return {
    authorsWithBio:   parseInt(authorsWithBio, 10),
    authorsTotal:     parseInt(authorsTotal, 10),
    booksWithText:    parseInt(booksWithText, 10),
    booksTotal:       parseInt(booksTotal, 10),
    contentWithText:  parseInt(contentWithText, 10),
    contentTotal:     parseInt(contentTotal, 10),
    articlesWithText,
    articlesTotal,
    ragTotal:         parseInt(ragTotal, 10),
  };
}

// Gap samples: authors not yet in Neon
async function getAuthorGaps(conn, neonIds, limit = 25) {
  const [rows] = await conn.execute(
    `SELECT id, authorName FROM author_profiles
     WHERE bio IS NOT NULL AND TRIM(bio) != ''
     ORDER BY authorName`
  );
  return rows
    .filter(r => !neonIds.has(String(r.id)))
    .slice(0, limit)
    .map(r => ({ id: r.id, name: r.authorName }));
}

// Gap samples: books not yet in Neon
async function getBookGaps(conn, neonIds, limit = 25) {
  const [rows] = await conn.execute(
    `SELECT id, bookTitle AS title, authorName FROM book_profiles
     WHERE (summary IS NOT NULL AND TRIM(summary) != '')
        OR (richSummaryJson IS NOT NULL AND TRIM(richSummaryJson) != '')
     ORDER BY bookTitle`
  );
  return rows
    .filter(r => !neonIds.has(String(r.id)))
    .slice(0, limit)
    .map(r => ({ id: r.id, name: `${r.title} — ${r.authorName ?? "?"}` }));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Connect
  const neonClient = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });
  await neonClient.connect();

  const mysqlConn = await mysql.createConnection(parseMysqlUrl(MYSQL_URL));

  try {
    const [neonByNs, src] = await Promise.all([
      getNeonStats(neonClient),
      getMysqlSourceCounts(mysqlConn),
    ]);

    // Build namespace definitions
    const allNamespaces = [
      {
        namespace:   "authors",
        label:       "Authors",
        sourceTable: "author_profiles",
        indexable:   src.authorsWithBio,
        total:       src.authorsTotal,
        description: "Authors with bio text",
      },
      {
        namespace:   "books",
        label:       "Books",
        sourceTable: "book_profiles",
        indexable:   src.booksWithText,
        total:       src.booksTotal,
        description: "Books with summary or description",
      },
      {
        namespace:   "content_items",
        label:       "Content Items",
        sourceTable: "content_items",
        indexable:   src.contentWithText,
        total:       src.contentTotal,
        description: "Content items with description",
      },
      {
        namespace:   "articles",
        label:       "Articles",
        sourceTable: "magazine_articles",
        indexable:   src.articlesWithText,
        total:       src.articlesTotal,
        description: "Magazine articles with content",
      },
      {
        namespace:   "rag_files",
        label:       "RAG Files",
        sourceTable: "author_rag_profiles",
        indexable:   src.ragTotal,
        total:       src.ragTotal,
        description: "Author RAG knowledge documents",
      },
    ].filter(ns => !NS_FILTER || ns.namespace === NS_FILTER);

    // Attach Neon stats
    for (const ns of allNamespaces) {
      const n = neonByNs[ns.namespace] ?? { uniqueSources: 0, totalVectors: 0, oldestVector: null, newestVector: null };
      ns.covered      = n.uniqueSources;
      ns.totalVectors = n.totalVectors;
      ns.oldestVector = n.oldestVector;
      ns.newestVector = n.newestVector;
      ns.gap          = Math.max(0, ns.indexable - ns.covered);
      ns.coveragePct  = ns.indexable > 0 ? (ns.covered / ns.indexable) * 100 : 0;
    }

    // Fetch gap samples for authors and books (if needed)
    if (!JSON_MODE) {
      const authorNs = allNamespaces.find(n => n.namespace === "authors");
      const bookNs   = allNamespaces.find(n => n.namespace === "books");

      if (authorNs && authorNs.gap > 0) {
        const neonIds = await getNeonSourceIds(neonClient, "authors");
        authorNs.gapSamples = await getAuthorGaps(mysqlConn, neonIds);
        authorNs.totalGap   = authorNs.gap;
      }
      if (bookNs && bookNs.gap > 0) {
        const neonIds = await getNeonSourceIds(neonClient, "books");
        bookNs.gapSamples = await getBookGaps(mysqlConn, neonIds);
        bookNs.totalGap   = bookNs.gap;
      }
    }

    // Grand total
    const grandTotal = Object.values(neonByNs).reduce((s, n) => s + n.totalVectors, 0);
    const allNsInNeon = Object.keys(neonByNs);

    // ── JSON output ───────────────────────────────────────────────────────────
    if (JSON_MODE) {
      console.log(JSON.stringify({
        generatedAt:        new Date().toISOString(),
        totalVectors:       grandTotal,
        allNamespacesInNeon: allNsInNeon,
        namespaces: allNamespaces.map(ns => ({
          namespace:    ns.namespace,
          label:        ns.label,
          indexable:    ns.indexable,
          totalInDB:    ns.total,
          covered:      ns.covered,
          gap:          ns.gap,
          coveragePct:  parseFloat(ns.coveragePct.toFixed(1)),
          totalVectors: ns.totalVectors,
          oldestVector: ns.oldestVector,
          newestVector: ns.newestVector,
          status:       ns.coveragePct >= 90 ? "green" : ns.coveragePct >= 60 ? "yellow" : "red",
        })),
      }, null, 2));
      return;
    }

    // ── Human-readable output ─────────────────────────────────────────────────
    const hr = "─".repeat(72);
    console.log(`\n${hr}`);
    console.log("  Neon pgvector Coverage Report");
    console.log(`  Generated : ${new Date().toLocaleString()}`);
    console.log(`  Total vectors in index : ${grandTotal.toLocaleString()}`);
    if (NS_FILTER) console.log(`  Namespace filter : ${NS_FILTER}`);
    console.log(hr);

    for (const ns of allNamespaces) {
      if (GAPS_ONLY && ns.gap === 0) continue;

      const statusIcon = icon(ns.covered, ns.indexable);
      console.log(`\n${statusIcon}  ${ns.label.padEnd(16)} (${ns.namespace})`);
      console.log(`     ${ns.description}`);
      console.log(`     Source table  : ${ns.sourceTable}`);
      console.log(`     Indexable     : ${ns.indexable.toLocaleString()} rows with text  (${ns.total.toLocaleString()} total in table)`);
      console.log(`     Covered       : ${ns.covered.toLocaleString()} unique source IDs in Neon`);
      console.log(`     Gap           : ${ns.gap.toLocaleString()} not yet indexed`);
      console.log(`     Coverage      : [${bar(ns.covered, ns.indexable)}] ${pct(ns.covered, ns.indexable)}`);
      console.log(`     Vector chunks : ${ns.totalVectors.toLocaleString()}`);
      if (ns.newestVector) {
        const ts = ns.newestVector.slice(0, 19).replace("T", " ");
        console.log(`     Last updated  : ${ts}  (${formatAge(ns.newestVector)})`);
      }
      if (ns.oldestVector) {
        const ts = ns.oldestVector.slice(0, 19).replace("T", " ");
        console.log(`     Oldest vector : ${ts}  (${formatAge(ns.oldestVector)})`);
      }

      if (ns.gapSamples && ns.gapSamples.length > 0) {
        console.log(`\n     Gap samples (first ${ns.gapSamples.length} of ${ns.totalGap?.toLocaleString() ?? ns.gap.toLocaleString()}):`);
        for (const s of ns.gapSamples) {
          console.log(`       • [${String(s.id).padStart(5)}] ${s.name}`);
        }
        if (ns.gap > ns.gapSamples.length) {
          console.log(`       … and ${(ns.gap - ns.gapSamples.length).toLocaleString()} more`);
        }
      }
    }

    // Extra namespaces in Neon not in our known list
    const knownNs  = new Set(allNamespaces.map(n => n.namespace));
    const extraNs  = allNsInNeon.filter(n => !knownNs.has(n));
    if (extraNs.length > 0) {
      console.log(`\n⚪  Extra namespaces in Neon (not cross-checked against MySQL):`);
      for (const ns of extraNs) {
        const info = neonByNs[ns];
        console.log(`     • ${ns.padEnd(20)} ${info.totalVectors.toLocaleString()} vectors, ${info.uniqueSources.toLocaleString()} unique sources`);
      }
    }

    console.log(`\n${hr}`);

    // Summary + exit code
    const belowThreshold = allNamespaces.filter(
      ns => ns.indexable > 0 && ns.coveragePct < WARN_PCT
    );

    if (belowThreshold.length === 0) {
      console.log(`  ✅  All namespaces are ≥ ${WARN_PCT}% covered.\n`);
    } else {
      console.log(`  ⚠️   ${belowThreshold.length} namespace(s) below ${WARN_PCT}% coverage threshold:`);
      for (const ns of belowThreshold) {
        console.log(`       • ${ns.label.padEnd(16)} ${pct(ns.covered, ns.indexable).padStart(6)}  (${ns.gap.toLocaleString()} items missing)`);
      }
      console.log(`\n  To re-index, trigger the enrichment pipeline from the Admin Console`);
      console.log(`  (Intelligence Dashboard → Run All Pipelines) or run:\n`);
      console.log(`     node scripts/run_all_pipelines.ts\n`);
      console.log(hr + "\n");
      process.exit(1);
    }

    console.log(hr + "\n");
  } finally {
    await neonClient.end().catch(() => {});
    await mysqlConn.end().catch(() => {});
  }
}

main().catch(err => {
  console.error("❌  verify-neon-coverage failed:", err.message);
  process.exit(2);
});
