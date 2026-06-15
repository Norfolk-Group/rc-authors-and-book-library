#!/usr/bin/env node
/**
 * ask-agent.cjs — query a Book/Author agent's Neon knowledge base.
 *
 * This is the retrieval foundation for the chat: embed a question with Gemini
 * (same model/dims as the indexer), cosine-search the author's pgvector
 * namespace, and show the passages that come back — optionally with a grounded
 * answer from Claude. Pure Node (CommonJS, no tsx) — same constraints as
 * index-book-content.cjs / reindex_pg.cjs.
 *
 * It proves the index is queryable and lets us judge retrieval quality BEFORE
 * investing in the tRPC procedure + chat UI.
 *
 * ── Required env ──────────────────────────────────────────────────────────────
 *   NEON_DATABASE_URL   Neon pgvector (read)                 — always
 *   GEMINI_API_KEY      query embedding                      — always
 *   DATABASE_URL        MySQL (author name -> id lookup)     — only when using --author
 *   ANTHROPIC_API_KEY   grounded answer generation           — only with --answer
 *
 * ── Run (Windows PowerShell, from the repo root) ──────────────────────────────
 *   # retrieval only (no extra keys beyond NEON + GEMINI):
 *   node scripts/ask-agent.cjs --author "Adam Grant" --q "How do you build hidden potential in a team?"
 *
 *   # narrow to one book, or to the owner's notes:
 *   node scripts/ask-agent.cjs --author "Adam Grant" --book-id 5 --q "..."
 *   node scripts/ask-agent.cjs --author "Charles Duhigg" --notes-only --q "..."
 *
 *   # also generate a grounded answer (needs ANTHROPIC_API_KEY):
 *   node scripts/ask-agent.cjs --author "Adam Grant" --q "..." --answer
 *
 *   # skip the MySQL lookup by passing the id directly:
 *   node scripts/ask-agent.cjs --author-id 30001 --q "..."
 *
 * Options: --k N (top-k, default 8) · --model <claude-model> (default claude-sonnet-4-6)
 */

"use strict";
require("dotenv/config");
const https = require("https");
const { Client } = require("pg");

// ── Args ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : def;
};
const AUTHOR = getArg("author", null);
const AUTHOR_ID = getArg("author-id", null) ? parseInt(getArg("author-id"), 10) : null;
const BOOK_ID = getArg("book-id", null) ? parseInt(getArg("book-id"), 10) : null;
const QUESTION = getArg("q", null);
const TOP_K = getArg("k", null) ? parseInt(getArg("k"), 10) : 8;
const NOTES_ONLY = args.includes("--notes-only");
const BOOK_ONLY = args.includes("--book-only");
const ANSWER = args.includes("--answer");
const MODEL = getArg("model", "claude-sonnet-4-6");

// ── HTTPS JSON helper ──────────────────────────────────────────────────────────
function httpsPost(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), ...headers } },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => { try { resolve(JSON.parse(buf)); } catch { reject(new Error("JSON parse error: " + buf.slice(0, 300))); } });
      }
    );
    req.on("error", reject);
    req.setTimeout(60000, () => req.destroy(new Error("Request timeout")));
    req.write(data);
    req.end();
  });
}

// ── Gemini query embedding (1536-dim) — matches the indexer exactly ──────────────
async function embedQuery(text) {
  const result = await httpsPost(
    "generativelanguage.googleapis.com",
    `/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
    { model: "models/gemini-embedding-001", content: { parts: [{ text: text.slice(0, 8192) }] }, outputDimensionality: 1536 }
  );
  if (result.error) throw new Error(JSON.stringify(result.error));
  const values = result.embedding && result.embedding.values;
  if (!values || values.length === 0) throw new Error("Empty embedding returned");
  return values;
}

// ── Claude grounded answer (optional) ────────────────────────────────────────────
async function generateAnswer(question, passages, agentLabel) {
  const context = passages
    .map((p, i) => `[${i + 1}] (${p.content_type}${p.title ? ` — ${p.title}` : ""})\n${p.text}`)
    .join("\n\n---\n\n");
  const system =
    `You are answering as a knowledge agent for ${agentLabel}. Answer ONLY from the ` +
    `numbered context passages below. Cite the passages you use like [1], [2]. If the ` +
    `context does not contain the answer, say so plainly — do not invent. Distinguish the ` +
    `book's own content from the owner's notes (content_type "owner_notes") when relevant.`;
  const result = await httpsPost(
    "api.anthropic.com",
    "/v1/messages",
    {
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: `Context:\n\n${context}\n\nQuestion: ${question}` }],
    },
    { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }
  );
  if (result.error) throw new Error(JSON.stringify(result.error));
  return (result.content || []).map((b) => b.text || "").join("").trim();
}

// ── MySQL author resolve (only when --author given) ──────────────────────────────
async function resolveAuthorId(authorName) {
  const mysql = require("mysql2/promise");
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    let [rows] = await conn.query(`SELECT id, authorName FROM author_profiles WHERE authorName = ? LIMIT 1`, [authorName]);
    if (!rows.length) {
      const tokens = authorName.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2) {
        const like = `${tokens[0]}%${tokens[tokens.length - 1]}`;
        [rows] = await conn.query(`SELECT id, authorName FROM author_profiles WHERE authorName LIKE ? LIMIT 2`, [like]);
      }
    }
    if (!rows.length) throw new Error(`No author_profiles row matched "${authorName}"`);
    return rows[0];
  } finally {
    await conn.end();
  }
}

async function main() {
  if (!QUESTION) { console.error('ERROR: --q "your question" is required.'); process.exit(1); }
  if (!process.env.NEON_DATABASE_URL) { console.error("ERROR: NEON_DATABASE_URL is required."); process.exit(1); }
  if (!process.env.GEMINI_API_KEY) { console.error("ERROR: GEMINI_API_KEY is required."); process.exit(1); }
  if (!AUTHOR && AUTHOR_ID === null) { console.error("ERROR: pass --author \"Name\" or --author-id N."); process.exit(1); }
  if (AUTHOR_ID === null && AUTHOR && !process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is required to resolve --author by name. Set it, or pass --author-id to skip the MySQL lookup.");
    process.exit(1);
  }

  // Resolve the agent.
  let authorId = AUTHOR_ID;
  let agentLabel = AUTHOR_ID !== null ? `author#${AUTHOR_ID}` : AUTHOR;
  if (authorId === null) {
    const a = await resolveAuthorId(AUTHOR);
    authorId = a.id;
    agentLabel = a.authorName;
  }
  const namespace = `author_${authorId}`;

  console.log(`\n===== ASK AGENT: ${agentLabel} (namespace ${namespace}) =====`);
  console.log(`Q: ${QUESTION}\n`);

  // Embed the question, then cosine-search the namespace (optional filters).
  const embedding = await embedQuery(QUESTION);
  const vec = `[${embedding.join(",")}]`;

  const neon = new Client({ connectionString: process.env.NEON_DATABASE_URL });
  await neon.connect();
  let rows;
  try {
    const where = ["namespace = $2"];
    const params = [vec, namespace];
    if (BOOK_ID !== null) { params.push(`book-${BOOK_ID}`); where.push(`category = $${params.length}`); }
    if (NOTES_ONLY) { params.push("owner_notes"); where.push(`content_type = $${params.length}`); }
    if (BOOK_ONLY) { params.push("book"); where.push(`content_type = $${params.length}`); }
    params.push(TOP_K);
    const sql =
      `SELECT content_type, source_id, title, url, chunk_index, text,
              (1 - (embedding <=> $1::vector))::float8 AS score
       FROM vector_embeddings
       WHERE ${where.join(" AND ")}
       ORDER BY embedding <=> $1::vector
       LIMIT $${params.length}`;
    ({ rows } = await neon.query(sql, params));
  } finally {
    await neon.end();
  }

  if (!rows.length) {
    console.log("No matching passages. Is this author indexed yet? (Check the Neon namespace.)");
    process.exit(0);
  }

  console.log(`Top ${rows.length} passages:\n`);
  rows.forEach((r, i) => {
    const snippet = r.text.replace(/\s+/g, " ").slice(0, 240);
    console.log(`[${i + 1}] score=${r.score.toFixed(3)}  ${r.content_type}${r.title ? ` — ${r.title}` : ""}  (chunk ${r.chunk_index})`);
    console.log(`    ${snippet}${r.text.length > 240 ? "…" : ""}\n`);
  });

  if (ANSWER) {
    if (!process.env.ANTHROPIC_API_KEY) { console.error("\n(--answer skipped: ANTHROPIC_API_KEY not set)"); process.exit(0); }
    console.log("───── grounded answer ─────\n");
    const answer = await generateAnswer(QUESTION, rows, agentLabel);
    console.log(answer + "\n");
  }
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
