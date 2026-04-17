/**
 * reindex_pg.cjs
 *
 * Pure Node.js (CommonJS, no tsx) script to index books and articles into
 * Neon pgvector using pg + Gemini REST API directly.
 * Avoids tsx/TypeScript compilation to stay within sandbox memory limits.
 *
 * Usage:
 *   node scripts/reindex_pg.cjs --type books --offset 0 --limit 20
 *   node scripts/reindex_pg.cjs --type articles --offset 0 --limit 20
 *   node scripts/reindex_pg.cjs --type authors --offset 0 --limit 40
 */

"use strict";
require("dotenv/config");
const { Client } = require("pg");
const https = require("https");

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : def;
};
const TYPE = getArg("type", "books");
const OFFSET = parseInt(getArg("offset", "0"), 10);
const LIMIT = parseInt(getArg("limit", "20"), 10);

const NEON_URL = process.env.NEON_DATABASE_URL;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MYSQL_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

// ── Helpers ──────────────────────────────────────────────────────────────────

function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(buf));
          } catch (e) {
            reject(new Error("JSON parse error: " + buf.slice(0, 200)));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error("Request timeout"));
    });
    req.write(data);
    req.end();
  });
}

async function embedText(text) {
  const truncated = text.slice(0, 8192);
  const result = await httpsPost(
    "generativelanguage.googleapis.com",
    `/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_KEY}`,
    {
      model: "models/gemini-embedding-001",
      content: { parts: [{ text: truncated }] },
      outputDimensionality: 1536,
    }
  );
  if (result.error) throw new Error(JSON.stringify(result.error));
  const values = result.embedding?.values;
  if (!values || values.length === 0)
    throw new Error("Empty embedding returned");
  return values;
}

async function upsertVector(neonClient, id, namespace, meta, embedding) {
  const vectorStr = `[${embedding.join(",")}]`;
  await neonClient.query(
    `INSERT INTO vector_embeddings
       (id, namespace, content_type, source_id, title, author_name, source, text, embedding)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)
     ON CONFLICT (id) DO UPDATE
       SET namespace = EXCLUDED.namespace,
           title = EXCLUDED.title,
           author_name = EXCLUDED.author_name,
           text = EXCLUDED.text,
           embedding = EXCLUDED.embedding,
           updated_at = NOW()`,
    [
      id,
      namespace,
      meta.type ?? namespace,
      meta.bookId ?? meta.authorId ?? meta.articleId ?? id,
      meta.title ?? null,
      meta.authorName ?? null,
      meta.publication ?? namespace,
      meta.text ?? meta.title ?? id,
      vectorStr,
    ]
  );
}

// ── MySQL query helpers ───────────────────────────────────────────────────────

function mysqlQuery(pool, sql, params) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== Neon Re-index (pg): ${TYPE} offset=${OFFSET} limit=${LIMIT} ===\n`);

  // Connect to Neon
  const neon = new Client({ connectionString: NEON_URL });
  await neon.connect();

  // Connect to MySQL
  const mysql = require("mysql2");
  const pool = mysql.createPool(MYSQL_URL);

  let indexed = 0,
    skipped = 0,
    vectors = 0;

  if (TYPE === "books") {
    const rows = await mysqlQuery(
      pool,
      `SELECT id, bookTitle, authorName, summary, richSummaryJson
       FROM book_profiles
       ORDER BY id
       LIMIT ? OFFSET ?`,
      [LIMIT, OFFSET]
    );

    for (const b of rows) {
      let text = b.summary ?? "";
      try {
        if (b.richSummaryJson) {
          const r =
            typeof b.richSummaryJson === "string"
              ? JSON.parse(b.richSummaryJson)
              : b.richSummaryJson;
          if (r?.fullSummary && r.fullSummary.length > text.length)
            text = r.fullSummary;
          if (r?.summary && r.summary.length > text.length) text = r.summary;
        }
      } catch {}
      if (text.length < 50) {
        skipped++;
        continue;
      }
      try {
        const embedding = await embedText(text);
        const id = `book-${b.id}`;
        await upsertVector(neon, id, "books", {
          bookId: String(b.id),
          title: b.bookTitle,
          authorName: b.authorName,
          type: "book",
          text: text.slice(0, 2000),
        }, embedding);
        vectors++;
        indexed++;
        console.log(`  ✓ ${b.bookTitle?.slice(0, 60)}`);
      } catch (e) {
        skipped++;
        console.warn(`  ✗ ${b.bookTitle?.slice(0, 60)}: ${e.message}`);
      }
    }
  } else if (TYPE === "articles") {
    const rows = await mysqlQuery(
      pool,
      `SELECT id, title, authorName, summaryText, fullText, publicationName
       FROM magazine_articles
       ORDER BY id
       LIMIT ? OFFSET ?`,
      [LIMIT, OFFSET]
    );

    for (const a of rows) {
      const text = a.fullText ?? a.summaryText ?? a.title ?? "";
      if (text.length < 50) {
        skipped++;
        continue;
      }
      try {
        const embedding = await embedText(text);
        const id = `article-${a.id}`;
        await upsertVector(neon, id, "articles", {
          articleId: String(a.id),
          title: a.title,
          authorName: a.authorName,
          publication: a.publicationName,
          type: "article",
          text: text.slice(0, 2000),
        }, embedding);
        vectors++;
        indexed++;
        console.log(`  ✓ ${a.title?.slice(0, 60)} [article]`);
      } catch (e) {
        skipped++;
        console.warn(`  ✗ ${a.title?.slice(0, 60)}: ${e.message}`);
      }
    }
  } else if (TYPE === "authors") {
    const rows = await mysqlQuery(
      pool,
      `SELECT id, authorName, bio, richBioJson
       FROM author_profiles
       ORDER BY id
       LIMIT ? OFFSET ?`,
      [LIMIT, OFFSET]
    );

    for (const a of rows) {
      let bio = a.bio ?? "";
      try {
        if (a.richBioJson) {
          const r =
            typeof a.richBioJson === "string"
              ? JSON.parse(a.richBioJson)
              : a.richBioJson;
          const rb = r?.fullBio ?? r?.bio ?? "";
          if (rb.length > bio.length) bio = rb;
        }
      } catch {}
      if (bio.length < 50) {
        skipped++;
        continue;
      }
      try {
        const embedding = await embedText(bio);
        const id = `author-${a.id}`;
        await upsertVector(neon, id, "authors", {
          authorId: String(a.id),
          authorName: a.authorName,
          title: a.authorName,
          type: "author",
          text: bio.slice(0, 2000),
        }, embedding);
        vectors++;
        indexed++;
        console.log(`  ✓ ${a.authorName}`);
      } catch (e) {
        skipped++;
        console.warn(`  ✗ ${a.authorName}: ${e.message}`);

      }
    }
  }

  console.log(`\nDone: ${indexed} indexed, ${skipped} skipped, ${vectors} vectors`);
  await neon.end();
  pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
