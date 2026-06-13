---
name: library-architecture
description: Overall architecture reference for the RC Library app. Use when onboarding to the codebase, understanding data flow between components, adding new features, or making architectural decisions. Covers stack, database schema, tRPC router conventions, key design patterns, deterministic verification tools, known broken features, and what NOT to do. Last updated June 13, 2026.
---

# RC Library App — Architecture Reference

> **IMPORTANT CHANGES AS OF JUNE 13, 2026:**
> - Platform migrated from **Manus → Railway**. Live URL: **https://library.superconversations.ai**
> - Auth changed from Manus OAuth → **Cloudflare Access** (Zero Trust, email OTP). `server/lib/cfAccess.ts` handles JWT validation.
> - File storage changed from Manus Forge S3 → **Cloudflare R2** (S3-compatible). `server/storage.ts` detects R2 via env vars and falls back to Forge.
> - New env vars: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`
> - Node.js in Railway deployment: **22.22.3** (Vite 7 would work here, but keep 6.x for stability)
> - flowbite-react pinned to `0.12.17` with oxc-parser stubbed via pnpm override (works on Railway)
> - LLM enrichment prompts now enforce English (added "Always respond in English" to all system prompts in `richBio.ts` and `richSummary.ts`)

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, shadcn/ui, Radix UI, Wouter (routing) |
| Backend | Express 4, tRPC 11, Superjson |
| Database | MySQL / TiDB Cloud (Drizzle ORM v0.44) — 45 migrations applied |
| Vector DB | **Neon pgvector** (`vector_embeddings` table, 1536-dim HNSW cosine index, 395 vectors) |
| File storage | **Cloudflare R2** (primary) / Manus Forge S3 (fallback) — `server/storage.ts` |
| Cloud sync | Dropbox API (OAuth, auto token refresh) — **Google Drive removed Apr 2026** |
| AI / LLM | Anthropic Claude (Opus for architecture, Sonnet for enrichment), Gemini (embeddings) |
| Auth | **Cloudflare Access** (Zero Trust, email OTP, RS256 JWT) — `server/lib/cfAccess.ts` |
| Build | Vite 6.4.1 (pinned), esbuild, TypeScript 5.9 |
| Deployment | **Railway** (Nixpacks + Dockerfile) — auto-deploys from `main` branch |
| Testing | Vitest — ~1020 tests passing |
| Icons | Phosphor Icons (`@phosphor-icons/react`), Lucide |
| Animation | Framer Motion |
| Logging | `server/lib/logger.ts` — structured logger (debug suppressed in prod) |

---

## Key Directories

```
client/src/
  pages/              ← Page-level React components
  components/
    admin/            ← All admin tab components (AdminXxxTab.tsx)
    library/          ← Library UI (AuthorsTabContent, BooksTabContent, AuthorCard, BookCard)
    ui/               ← shadcn/ui primitives
  lib/trpc.ts         ← tRPC client binding
  hooks/
    useLibraryData.ts ← Main data hook (filteredAuthors, filteredBooks, query state)
    useAuthorAliases.ts ← DB-backed alias map with hardcoded fallback
  App.tsx             ← Routes

server/
  routers/            ← tRPC feature routers (one file per domain)
  services/           ← Business logic services
    neonVector.service.ts       ← Neon pgvector client
    incrementalIndex.service.ts ← indexAuthorIncremental, indexBookIncremental
    ragPipeline.service.ts      ← RAG file generation + embedding
    enrichmentOrchestrator.service.ts ← Background job engine (13 pipelines)
  _core/              ← Framework plumbing (auth, context, LLM helpers) — DO NOT EDIT
    context.ts        ← Session resolution: tries Manus cookie first, falls back to CF Access
    env.ts            ← ENV constants (use instead of process.env)
  lib/
    cfAccess.ts       ← Cloudflare Access JWT validation (RS256, JWKS, 5-min owner cache)
    logger.ts         ← Structured logger
    parallelBatch.ts  ← Generic parallel batch executor
    llmCatalogue.ts   ← Multi-vendor LLM catalogue (13 vendors, 47 models)
  db.ts               ← Drizzle + TiDB TLS pool
  storage.ts          ← R2/Forge helpers (storagePut, storageGet)
  dropbox.service.ts  ← Dropbox API client + DROPBOX_FOLDERS constant
  enrichment/
    richBio.ts        ← Double-pass LLM bio enrichment (English enforced)
    richSummary.ts    ← Double-pass LLM summary enrichment (English enforced)

drizzle/
  schema.ts           ← All table definitions + indexes (25 tables)
  migrations/         ← Auto-generated migration files (0000–0045, 0045 = latest)

scripts/
  reindex_pg.cjs      ← Pure-Node Neon re-indexing (no tsx — avoids OOM)
  verify-r2.mjs       ← Verify R2 credentials (PutObject + public GET)
  verify-neon-coverage.mjs ← Neon vector coverage report
  verify-db-indexes.mjs    ← Verify all 42 DB indexes exist (read-only)
  verify-dropbox-folders.mjs ← Verify Dropbox folder accessibility
  audit-enrichment-gaps.mjs  ← Audit enrichment gaps
  verify-s3-coverage.mjs     ← Audit S3 mirror coverage

shared/
  types.ts            ← Shared TypeScript types (client + server)
  const.ts            ← Shared constants
```

---

## Cloudflare Access Auth

Auth is handled at two layers:

1. **Edge layer** — Cloudflare Access sits in front of the custom domain (`library.superconversations.ai`). Unauthenticated requests are redirected to the CF Access login page (email OTP or Google). On success, CF injects a `CF_Authorization` cookie containing an RS256-signed JWT.

2. **Application layer** — `server/lib/cfAccess.ts` validates the CF Access JWT via JWKS (pinned to `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD`). `server/_core/context.ts` first tries to resolve a Manus session (for backward compatibility), then falls back to `resolveCfAccessOwner()` from `cfAccess.ts`.

**Key rules:**
- The raw `*.up.railway.app` URL bypasses Cloudflare Access — **always use `library.superconversations.ai`**
- `CF_ACCESS_TEAM_DOMAIN` = your Zero Trust team domain (e.g. `norfolk.cloudflareaccess.com`)
- `CF_ACCESS_AUD` = the AUD tag from the CF Access application settings
- The owner cache in `cfAccess.ts` is 5 minutes in-process — avoids two DB round-trips per request
- Log only `(err as Error).message` from jose errors — never log raw `err` (jose attaches decoded JWT payload to errors)

---

## Cloudflare R2 Storage

`server/storage.ts` exports `storagePut(key, buffer, contentType)` and `storageGet(key)`.

R2 is active when all five vars are set: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`. If any is missing, falls back to Manus Forge proxy.

**Key rules:**
- Always check `isR2Configured()` before assuming R2 is active
- `R2_PUBLIC_URL` must be included in the configured check — if it's missing, uploads succeed but the public URL build throws, orphaning the object
- S3 key conventions: `author-avatars/<hex>.jpg`, `book-covers/<hex>.<ext>`, `smart-uploads/<ts>-<name>`
- Never store file bytes in DB columns — store only the S3 key and CDN URL

---

## Database Schema (Core Tables)

| Table | Purpose |
|---|---|
| `author_profiles` | 183 authors — bio, richBioJson, avatarUrl, s3AvatarUrl, socialStatsJson |
| `book_profiles` | 163 books — title, summary, richSummaryJson, coverImageUrl, s3CoverUrl |
| `content_files` | File attachments — `s3Key`, `s3Url`, `fileType (pdf/mp3/...)`, `contentItemId` FK |
| `content_items` | Articles, videos, podcasts, newsletters per author |
| `author_rag_profiles` | RAG pipeline state per author |
| `smart_uploads` | Staging table for Smart Upload jobs (`neonNamespace` column) |
| `dropbox_folder_configs` | Admin-managed Dropbox folder connections |
| `human_review_queue` | Items flagged for human review (near-duplicates) |
| `enrichment_schedules` | Cron-like enrichment pipeline schedules |
| `author_aliases` | DB-backed author name normalization (rawName → canonical) |
| `users` | Session users (id, email, role: admin\|user) |

**Note:** `book_profiles` does NOT have an `s3PdfUrl` column (documented in old CLAUDE.md but never added to schema). PDFs are stored in `content_files WHERE fileType='pdf'`, linked via `contentItemId` → `content_items` → author+title match.

---

## PDF / File Upload Scope

When building any file upload or batch migration feature, the accepted file types are:
- ✅ PDF (`.pdf`)
- ✅ DOCX (`.docx`)
- ✅ Images (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`)
- ❌ Audio (no `.mp3`, `.m4a`, `.wav`, etc.)
- ❌ Video (no `.mp4`, `.mov`, `.avi`, etc.)
- ❌ EPUB (no `.epub`)

---

## Neon pgvector

**Connection:** `NEON_DATABASE_URL` (Postgres, not MySQL)
**Driver:** `@neondatabase/serverless` (WebSocket) for server code; `pg` for scripts
**Table:** `vector_embeddings (id TEXT PK, namespace TEXT, embedding vector(1536), metadata JSONB, title TEXT, text TEXT)`
**Index:** HNSW cosine on `embedding`, B-tree on `namespace`
**Embedding model:** `models/gemini-embedding-001` with `outputDimensionality: 1536`

| Namespace | Vectors | Content |
|---|---|---|
| `authors` | 183 | Author bio + richBioJson |
| `books` | 165 | Book summary + richSummaryJson |
| `lb_pitchdeck` | 28 | Library pitch deck RAG chunks |
| `lb_documents` | 8 | Library document RAG chunks |
| `lb_website` | 7 | Library website RAG chunks |
| `lb_app_data` | 4 | Library app data RAG chunks |

**Do NOT use `text-embedding-004`** — 404 on v1beta endpoint.
**Do NOT use `gemini-embedding-001` without `outputDimensionality: 1536`** — produces 3072 dims (exceeds HNSW limit).

Fire-and-forget re-index after any bio/summary DB update:
```ts
indexAuthorIncremental(id).catch(e => logger.warn("Neon re-index failed", e));
```

---

## tRPC Router Conventions

```ts
// server/routers/myFeature.router.ts
import { router, protectedProcedure, adminProcedure } from "../_core/trpc";
import { z } from "zod";

export const myFeatureRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => { ... }),
  create: adminProcedure.input(z.object({ name: z.string() })).mutation(async ({ input }) => { ... }),
});
```

- `publicProcedure` — no auth required
- `protectedProcedure` — requires login (any role)
- `adminProcedure` — requires `ctx.user.role === "admin"`

Keep each router under ~150 lines.

---

## Enrichment Pipelines — Language Rule

All LLM enrichment prompts in `server/enrichment/` **must include "Always respond in English."** in their system prompt. Added June 13, 2026 to `richBio.ts` and `richSummary.ts`. If adding new enrichment prompts, include this instruction.

The root cause: Perplexity/Wikipedia can return Spanish content for Spanish-named authors. Without the constraint, the LLM mirrors the input language.

To re-enrich already-affected records: Admin → Intelligence Dashboard → trigger `enrich-rich-bios` and `enrich-rich-summaries` pipelines.

---

## Deployment (Railway)

- Auto-deploys from `main` branch on push
- Uses Nixpacks (ignores Dockerfile unless explicitly configured)
- **Critical:** All packages used at server runtime must be in `dependencies`, not `devDependencies`. Nixpacks prunes devDependencies. Vite, @vitejs/plugin-react, @tailwindcss/vite, vite-plugin-manus-runtime, @builder.io/vite-plugin-jsx-loc are in `dependencies` for this reason.
- Port: Railway pre-allocates `$PORT`. Bind directly with `server.listen(parseInt(process.env.PORT || "3000", 10))`. Never use `findAvailablePort()` — TOCTOU race will bump the server off the pre-allocated port.
- Node.js version: 22.22.3

---

## Vite Build — No manualChunks

`vite.config.ts` does NOT use `manualChunks`. Hand-grouping vendor libs (react, misc, radix, charts) created mutual circular chunk dependencies that left `React.forwardRef` undefined at runtime (white screen in production). Rollup's automatic chunking is correct and produces 0 mutual cycles. Do not add `manualChunks` back.

---

## TiDB TLS

`server/db.ts` uses an explicit mysql2 pool with `ssl: { minVersion: "TLSv1.2" }`. TiDB Cloud Serverless requires TLS — a bare URI connection string leaves SSL off and silently connects but returns no data.

```ts
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: { minVersion: "TLSv1.2" },
});
_db = drizzle(pool);
```

---

## Environment Variables

All managed in Railway Variables (never in git). Use `ENV` from `server/_core/env.ts` — never `process.env` directly in application code.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `NEON_DATABASE_URL` | Neon Postgres (pgvector) |
| `JWT_SECRET` | Session cookie signing |
| `ANTHROPIC_API_KEY` | Claude (enrichment, classification) |
| `GEMINI_API_KEY` | Gemini embeddings (1536-dim) |
| `R2_ACCOUNT_ID` | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `R2_BUCKET` | R2 bucket name |
| `R2_PUBLIC_URL` | R2 public CDN URL (required for storagePut return value) |
| `CF_ACCESS_TEAM_DOMAIN` | Cloudflare Access team domain |
| `CF_ACCESS_AUD` | Cloudflare Access AUD tag |
| `DROPBOX_ACCESS_TOKEN` | Short-lived Dropbox token (auto-refreshed) |
| `DROPBOX_REFRESH_TOKEN` | Long-lived Dropbox refresh token |
| `DROPBOX_APP_KEY` / `DROPBOX_APP_SECRET` | Dropbox OAuth app credentials |
| `PERPLEXITY_API_KEY` | Perplexity Sonar (bio enrichment + web research) |
| `EXA_API_KEY` | Exa neural web search |
| `REPLICATE_API_TOKEN` | Replicate flux-schnell avatars |
| `TAVILY_API_KEY` | Tavily image search |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |

---

## What NOT to Do

- **Never use Google Drive** — removed Apr 2026. All cloud storage is Dropbox + R2/Forge.
- **Never access `process.env` directly** — use `ENV` from `server/_core/env.ts`.
- **Never edit `server/_core/`** — framework plumbing. Exception: `context.ts` and `index.ts` had authorized edits for CF Access and port binding.
- **Never use `text-embedding-004`** — 404 on Gemini v1beta endpoint.
- **Never use `gemini-embedding-001` without `outputDimensionality: 1536`** — 3072 dims exceeds HNSW limit.
- **Never hardcode Dropbox paths** — use `DROPBOX_FOLDERS` from `dropbox.service.ts`.
- **Never store file bytes in DB columns** — use `storagePut` and store the URL.
- **Never call LLM from client-side code** — all AI calls through tRPC.
- **Never skip Neon re-index after bio/summary updates** — use fire-and-forget pattern.
- **Never run tsx-based scripts for bulk indexing** — OOMs in sandbox. Use `.cjs` + `pg` + Gemini REST.
- **Never add `manualChunks` to vite.config.ts** — causes circular chunk deps → React.forwardRef undefined.
- **Never use `findAvailablePort()`** — TOCTOU race bumps server off Railway's pre-allocated $PORT.
- **Never log raw jose errors** — jose attaches decoded JWT payload. Log only `(err as Error).message`.
- **Never skip `R2_PUBLIC_URL` in the R2 configured check** — upload succeeds but URL build throws, orphaning the object.
- **Never add hard startup validations on platform-managed secrets** — use `console.warn` only.

---

## Broken / Non-Functional Features

| Feature | Status | Notes |
|---|---|---|
| CNBC RapidAPI | **Removed Jun 2026** | Required paid RapidAPI plan; always 403 |
| `businessProfileJson` | **Yahoo Finance only** | CNBC removed; column now holds Yahoo Finance data |
| `vectorSearch.indexEverything` | **Stub** | Returns a message; does nothing |
| `authorAliases.ts` (client lib) | **Superseded** | DB-backed aliases are source of truth; still imported in 10+ places |
| `authorAvatars.ts` (client lib) | **Superseded** | DB-backed `s3AvatarUrl` is source of truth; still imported in 10+ places |
| PDF vector indexing | **Not built** | No PDF parse library installed; `content_files` rows incomplete |
