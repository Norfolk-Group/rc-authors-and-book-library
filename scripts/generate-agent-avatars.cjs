#!/usr/bin/env node
/**
 * generate-agent-avatars.cjs  —  photorealistic avatars for Super Conversations agents
 *
 * Each agent (Book / Author / Book Writer) gets a male or female Italian persona
 * (name + gender are deterministic — see server/agents/identity.ts). This script
 * generates a photorealistic portrait per persona via Replicate (flux-schnell),
 * uploads it to Cloudflare R2 under `agent-avatars/<key>.jpg`, and rewrites
 * server/agents/agentAvatars.ts with the resulting URL map. Commit that file.
 *
 * Pure Node (CommonJS) — same constraints as the other scripts. It mirrors the
 * identity hash so the gender/name here match what the app computes at runtime.
 *
 * ── Required env (--commit) ───────────────────────────────────────────────────
 *   NEON_DATABASE_URL      enumerate which agents exist (author_<id> namespaces +
 *                          book-<id> categories in vector_embeddings)
 *   REPLICATE_API_TOKEN    image generation
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
 *
 * A dry run only needs NEON_DATABASE_URL (lists the agents + personas, writes nothing).
 *
 * ── Run ───────────────────────────────────────────────────────────────────────
 *   node scripts/generate-agent-avatars.cjs                 # dry run (plan only)
 *   node scripts/generate-agent-avatars.cjs --commit        # generate missing avatars
 *   node scripts/generate-agent-avatars.cjs --commit --force   # regenerate all
 *   Options: --limit N  ·  --only author-12
 *
 * Safe to re-run: existing URLs in agentAvatars.ts are kept (skipped) unless --force.
 */
"use strict";
require("dotenv/config");
const fs = require("fs");
const path = require("path");
const https = require("https");
const { Client } = require("pg");

// ── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const FORCE = args.includes("--force");
const getArg = (n) => { const i = args.indexOf(`--${n}`); return i !== -1 ? args[i + 1] : null; };
const LIMIT = getArg("limit") ? parseInt(getArg("limit"), 10) : null;
const ONLY = getArg("only");

const AVATARS_TS = path.join(__dirname, "..", "server", "agents", "agentAvatars.ts");
const KEY_PREFIX = "agent-avatars";

// ── Deterministic identity — mirrors server/agents/identity.ts ────────────────
const MALE_NAMES = [
  "Leonardo", "Marco", "Matteo", "Lorenzo", "Alessandro", "Francesco", "Giovanni",
  "Riccardo", "Stefano", "Davide", "Andrea", "Luca", "Giulio", "Pietro", "Tommaso",
  "Federico", "Antonio", "Vincenzo", "Emanuele", "Salvatore", "Niccolò", "Gabriele",
];
const FEMALE_NAMES = [
  "Sofia", "Giulia", "Aurora", "Alessia", "Chiara", "Francesca", "Martina", "Sara",
  "Valentina", "Elena", "Bianca", "Lucia", "Giorgia", "Beatrice", "Camilla", "Ludovica",
  "Alice", "Greta", "Eleonora", "Federica", "Isabella", "Marta",
];
const SURNAMES = [
  "Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci",
  "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Mancini", "Costa",
  "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro",
  "Mariani", "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone",
];
function fnv1a(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function identity(key) {
  const h = fnv1a(key);
  const gender = (h & 1) === 0 ? "female" : "male";
  const firsts = gender === "female" ? FEMALE_NAMES : MALE_NAMES;
  const first = firsts[(h >>> 1) % firsts.length];
  const last = SURNAMES[(h >>> 9) % SURNAMES.length];
  return { displayName: `${first} ${last}`, gender, seed: h % 1000000 };
}

// ── Prompt (bokeh-gold background per the design system) ──────────────────────
function portraitPrompt(gender) {
  const subject = gender === "female" ? "woman" : "man";
  return (
    `Photorealistic professional editorial headshot portrait of an Italian ${subject}, ` +
    `35-50 years old, warm and intelligent expression, looking toward camera, soft studio ` +
    `lighting, shallow depth of field, warm golden bokeh background with soft amber and cream ` +
    `circular light orbs, high detail, 85mm lens, natural skin texture, color photography. ` +
    `Single person, head and shoulders. No text, no watermark, no logo.`
  );
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function httpsJson(method, urlStr, headers, body) {
  const u = new URL(urlStr);
  const data = body ? JSON.stringify(body) : null;
  return new Promise((resolve, reject) => {
    const req = https.request(
      { method, hostname: u.hostname, path: u.pathname + u.search,
        headers: { ...headers, ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) } },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          try { resolve({ status: res.statusCode, json: buf ? JSON.parse(buf) : null }); }
          catch { reject(new Error(`Bad JSON (${res.statusCode}): ${buf.slice(0, 200)}`)); }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(120000, () => req.destroy(new Error("Request timeout")));
    if (data) req.write(data);
    req.end();
  });
}
function httpsBuffer(urlStr) {
  const u = new URL(urlStr);
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname: u.hostname, path: u.pathname + u.search }, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`Download failed: ${res.statusCode}`)); return; }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    // Bound a stalled CDN download so one bad image can't hang the whole batch.
    req.setTimeout(120000, () => req.destroy(new Error("Download timeout")));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Replicate flux-schnell ────────────────────────────────────────────────────
async function generateImage(prompt, seed) {
  const token = process.env.REPLICATE_API_TOKEN;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "wait" };
  let { status, json } = await httpsJson(
    "POST",
    "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
    headers,
    { input: { prompt, aspect_ratio: "1:1", output_format: "jpg", num_outputs: 1, seed } }
  );
  if (status >= 400) throw new Error(`Replicate ${status}: ${JSON.stringify(json).slice(0, 200)}`);
  // Poll if it didn't finish within the Prefer: wait window.
  let tries = 0;
  while (json && json.status && !["succeeded", "failed", "canceled"].includes(json.status) && tries < 30) {
    await sleep(2000);
    tries++;
    ({ json } = await httpsJson("GET", json.urls.get, { Authorization: `Bearer ${token}` }));
  }
  if (!json || json.status !== "succeeded") throw new Error(`Replicate did not succeed: ${json && json.status}`);
  const out = Array.isArray(json.output) ? json.output[0] : json.output;
  if (!out) throw new Error("Replicate returned no output URL");
  return out;
}

// ── R2 upload ─────────────────────────────────────────────────────────────────
function makeR2() {
  const { S3Client } = require("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}
async function uploadR2(s3, key, buffer) {
  const { PutObjectCommand } = require("@aws-sdk/client-s3");
  await s3.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET, Key: key, Body: buffer, ContentType: "image/jpeg",
  }));
  return `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}

// ── agentAvatars.ts read / write ────────────────────────────────────────────────
function readExisting() {
  const map = {};
  try {
    const src = fs.readFileSync(AVATARS_TS, "utf8");
    const re = /"([^"]+)":\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(src)) !== null) map[m[1]] = m[2];
  } catch { /* file may not exist yet */ }
  return map;
}
function writeAvatarsTs(map) {
  const keys = Object.keys(map).sort();
  const body = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(map[k])},`).join("\n");
  const content = `/**
 * agentAvatars.ts — registry of generated agent avatar URLs.
 *
 * Maps an agent key ("book-<id>" | "author-<id>" | "book-writer") to the public
 * R2 URL of its photorealistic avatar. Generated by
 * scripts/generate-agent-avatars.cjs and committed. The identity layer reads
 * this map; a key that is absent renders as a monogram in the UI.
 *
 * Do not hand-edit — regenerate with the script instead.
 */
export const AGENT_AVATARS: Record<string, string> = {
${body}
};
`;
  fs.writeFileSync(AVATARS_TS, content);
}

// ── Enumerate agents from Neon ───────────────────────────────────────────────────
async function enumerateKeys(neon) {
  const keys = new Set(["book-writer"]);
  const ns = await neon.query(`SELECT DISTINCT namespace FROM vector_embeddings WHERE namespace LIKE 'author\\_%'`);
  for (const row of ns.rows) {
    const id = parseInt(String(row.namespace).slice("author_".length), 10);
    if (!Number.isNaN(id)) keys.add(`author-${id}`);
  }
  const cats = await neon.query(`SELECT DISTINCT category FROM vector_embeddings WHERE category LIKE 'book-%'`);
  for (const row of cats.rows) {
    if (/^book-\d+$/.test(row.category)) keys.add(row.category);
  }
  return [...keys].sort();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n===== GENERATE AGENT AVATARS ${COMMIT ? "(COMMIT)" : "(DRY RUN)"}${FORCE ? " --force" : ""} =====\n`);
  if (!process.env.NEON_DATABASE_URL) { console.error("ERROR: NEON_DATABASE_URL is required."); process.exit(1); }
  if (COMMIT) {
    for (const v of ["REPLICATE_API_TOKEN", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"]) {
      if (!process.env[v]) { console.error(`ERROR: ${v} is required for --commit.`); process.exit(1); }
    }
  }

  const neon = new Client({ connectionString: process.env.NEON_DATABASE_URL });
  await neon.connect();
  let keys = await enumerateKeys(neon);
  await neon.end();
  if (ONLY) keys = keys.filter((k) => k === ONLY);
  console.log(`Agents found: ${keys.length}\n`);

  const existing = readExisting();
  const map = { ...existing };
  const s3 = COMMIT ? makeR2() : null;

  let done = 0, generated = 0, skipped = 0;
  const errors = [];

  for (const key of keys) {
    if (LIMIT !== null && done >= LIMIT) break;
    done++;
    const id = identity(key);
    const have = Boolean(existing[key]);
    if (have && !FORCE) {
      skipped++;
      console.log(`  · ${key} — ${id.displayName} (${id.gender}) — already has avatar, skipped`);
      continue;
    }
    if (!COMMIT) {
      console.log(`  ✓ ${key} — ${id.displayName} (${id.gender})${have ? " — would regenerate" : ""}`);
      continue;
    }
    try {
      const imageUrl = await generateImage(portraitPrompt(id.gender), id.seed);
      const buf = await httpsBuffer(imageUrl);
      const url = await uploadR2(s3, `${KEY_PREFIX}/${key}.jpg`, buf);
      map[key] = url;
      generated++;
      console.log(`  ✓ ${key} — ${id.displayName} (${id.gender}) → ${url}`);
      writeAvatarsTs(map); // write incrementally so an interrupted run keeps progress
    } catch (e) {
      errors.push(`${key}: ${e.message}`);
      console.log(`  ✗ ${key} — ${id.displayName}: ${e.message}`);
    }
  }

  if (COMMIT) writeAvatarsTs(map);

  console.log(`\n===== ${COMMIT ? "DONE" : "DRY RUN"} =====`);
  console.log(`Generated ... ${generated}`);
  console.log(`Skipped ..... ${skipped}`);
  if (errors.length) { console.log(`\nErrors (${errors.length}):`); errors.slice(0, 25).forEach((x) => console.log(`  - ${x}`)); }
  if (COMMIT) console.log(`\nWrote ${Object.keys(map).length} entries to server/agents/agentAvatars.ts — commit it.`);
  else console.log(`\nDry run — nothing generated. Re-run with --commit.`);
  process.exit(COMMIT && errors.length ? 1 : 0);
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
