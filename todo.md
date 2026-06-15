# Authors & Books Library — Project TODO

Last cleaned: Jun 15, 2026

---

## Branding

- [ ] Set VITE_APP_LOGO in Management UI → Settings → General (manual step — paste CDN URL: https://d2xsxph8kpxj0f.cloudfront.net/310519663270229297/ehSrGoKN2NYhXg8UYLtWGw/Logo04256x256_4ba6138d.png)

---

## Manual Pipeline Runs (Admin Console Steps)

- [ ] Enable `neon-index-content-items` pipeline in Admin → Intelligence → Schedules (157 content items at 0% coverage)
- [ ] Enable `neon-index-rag-files` pipeline in Admin → Intelligence → Schedules (187 RAG files at 0% coverage)
- [ ] Run Admin Console → Magazine Feeds → "Sync All Feeds" then "Index All in Neon"
- [ ] Run Admin Console → Author Enrichment → "Enrich All Social Stats" (populates Substack post counts for 40 authors with substackUrl)
- [ ] Trigger all enrichment pipelines via orchestrator "Run All Pipelines Now"
- [ ] Verify Neon vector index populated (authors, books, articles namespaces)

---

## S3 CDN Migration

- [ ] Audit all avatar URLs — identify non-S3 sources (Wikipedia, Tavily, Replicate)
- [ ] Re-upload all non-S3 avatars to S3 CDN and update author_profiles.avatar_url
- [ ] Audit all book cover URLs — identify non-S3 sources
- [ ] Re-upload all non-S3 book covers to S3 CDN and update book_profiles.s3_cover_url
- [ ] Migrate book PDFs / files (pdfUrl → s3PdfUrl)
- [ ] Verify 100% of avatars and covers are on S3 CDN after migration

---

## Remaining Deferred Items

- [x] A1: Add Zod schemas for all JSON blob columns in authorProfiles (25 columns) — `shared/authorProfileSchemas.ts`
- [x] A5: Split drizzle/schema.ts into domain files — 25 tables moved into `drizzle/schema/{core,authors,books,content,enrichment,engagement,media,sync}.ts`; `schema.ts` is now a re-export barrel (zero importer changes; drizzle-kit verified discovering all 25 tables)
- [x] Q1: Standardize error handling — all fire-and-forget Neon re-index and near-dup check calls now use `logger.warn` instead of silent `.catch(() => {})` (9 sites across 5 files)
- [x] Semantic Interest Heatmap: UMAP projection implemented — `server/lib/semanticProjection.ts` (umap-js, L2-normalized cosine, seeded/deterministic); replaces the old PCA power-iteration in `semanticMap.router.ts`

---

## Completed (Jun 15, 2026 Session — Continued)

- [x] Deleted `client/src/lib/authorAliases.ts` — useAuthorAliases hook uses empty fallback; DB map is sole source
- [x] Deleted `client/src/lib/authorAvatars.ts` — all 8 callers refactored; AuthorCompare + Leaderboard use getAvatarMap query
- [x] Write vitest tests for Dropbox ingestion pipeline — 29 pure-function tests added (normalizeTitle, normalizeIsbn, normalizeFilename, similarityScore, sanitizeFilename); 45 tests total
- [x] Add infotips to Admin tab content — ReviewQueue stat cards (Chatbot Ready, High Quality, Pending Review) + Run AI Scan button; S3AuditTab section header
- [x] Orchestrator first-run guidance card — verified already implemented (no jobs → Clock icon + Run All Pipelines Now CTA)

---

## Completed (Jun 15, 2026 Session)

- [x] conversationGroups column added to author_profiles and book_profiles (migration 0047)
- [x] setConversationGroups + getConversationGroups tRPC procedures in authorProfiles + bookProfiles routers
- [x] Advisor model set to claude-opus-4-7 in authorChatbot.router.ts
- [x] P1: N+1 query in contentItems.list — verified already fixed (batch inArray query)
- [x] P2: DB index on contentItems.enrichedAt — added to schema.ts + migration 0047
- [x] H1: AuthorCard memoized with React.memo + search debounce changed to 300ms
- [x] H3: CommandPalette Cmd+K now checks !e.defaultPrevented
- [x] M1: AuthorCard has role="article" and aria-label for keyboard/screen reader accessibility
- [x] M2: AuthorModal staleTime changed from 30s to 5min
- [x] M3: SemanticSearchDropdown debounce changed from 500ms to 400ms
- [x] M4: Skeleton placeholders added to AuthorDetail bio section + BookDetail cover
- [x] M5: InterestHeatmap color scale legend added (9-10 Exceptional → 0-2 None)
- [x] M7: CommandPalette authorList + bookList memoized (lazy-initialized with useMemo)
- [x] A4: Embedding validation — finite number check before Neon vector upsert + query
- [x] S8: storage.ts sanitizes error messages (logs body internally, exposes only status code)
- [x] L1: No unused imports found in AuthorDetail.tsx (all icons verified used)
- [x] L3: ARIA attributes added to PageLoader spinner (role="status", aria-label, aria-hidden on spinner)
- [x] L4: ReadingPathPanel accentColor inline styles replaced with CSS custom properties (--rp-accent*)

---

## Completed (Apr 20, 2026 Session)

- [x] rewritetax.md created — comprehensive audit of 63 waste incidents across 8 categories (~31 sessions wasted)
- [x] best-practices.md created — 21 binding rules across 6 phases derived from all rewritetax.md incidents
- [x] CLAUDE.md updated — full best-practices.md + agent-mishaps rules embedded directly (Mandatory Session Protocol section, 197 lines)
- [x] todo.md cleaned up (Apr 19 → Apr 20, duplicates removed, accurate state)
- [x] recommendations.test.ts fixed — 7 tests updated to use authenticated context after S1 protectedProcedure change
- [x] vitest.config.ts updated — neonVector.test.ts excluded (causes OOM in forks pool)
- [x] All changes pushed to GitHub

---

## Completed (Apr 19, 2026 Session)

- [x] Full Pinecone → Neon pgvector migration (Apr 18-19, 2026)
- [x] `shouldIndexPinecone` DB column renamed to `shouldIndexNeon` (migration 0046)
- [x] `@pinecone-database/pinecone` package removed from package.json
- [x] `pinecone-rag` skill renamed to `neon-rag`
- [x] All test files updated (Pinecone → Neon function/describe names)
- [x] 32 Claude Opus audit findings fixed (S1–S7, A2, C1+M6, H2, Q2)
  - [x] S1: All data endpoints changed from publicProcedure to protectedProcedure
  - [x] S2: Rate limiting middleware added for LLM enrichment calls
  - [x] S3: SSRF guard (safeFetch) added for external URL fetching
  - [x] S4+S7: JWT_SECRET startup validation (warns instead of throws — platform-managed)
  - [x] S5: Raw SQL template literals replaced with Drizzle type-safe operators
  - [x] S6: sanitizeAuthorName added and wired into enrich/createAuthor procedures
  - [x] A2: 30-minute timeout wrapper around pipeline handler calls
  - [x] C1+M6: ReadingPathPanel upgraded with multi-step loading indicator + 15s timeout fallback
  - [x] H2: ErrorBoundary wrapping async sections in BookDetail
  - [x] Q2: Structured logger replacing console.log in server routers
- [x] Curated Reading Paths feature (readingPath.router.ts + ReadingPathPanel.tsx)
- [x] Two new Neon indexing pipelines: neon-index-content-items + neon-index-rag-files
- [x] verify-neon-coverage.mjs script added (pnpm coverage)
- [x] OOM build failure fixed (manualChunks + lazy imports in Vite config)
- [x] manus.md rewritten with full Neon architecture
- [x] CLAUDE.md updated (Legacy Pinecone Notes removed, AdminPineconeTab → AdminNeonTab)
- [x] All .agents/skills/ SKILL.md files updated for Neon migration
- [x] agent-mishaps SKILL.md updated with new mishaps from this session
- [x] 6 stale Pinecone files deleted
- [x] verify-pinecone-coverage.mjs rewritten as verify-neon-coverage.mjs
- [x] Refresh All Data button in AuthorCardActions.tsx (bio → links → avatar sequential)
- [x] Re-index All button with live progress in AdminNeonTab.tsx

---

## Completed (Apr 8–18, 2026 Sessions)

- [x] Created 5 app-specific Agent Skills in .agents/skills/
- [x] Rewrote CLAUDE.md and manus.md to reflect current architecture
- [x] Pinecone bulk indexing: 1,160 total vectors (183 authors + 163 books)
- [x] Substack post counts: 9 authors populated
- [x] Dropbox Configuration admin page (7 folder connections)
- [x] Smart Upload admin page (AI classification + review queue)
- [x] Chatbot chunk retrieval (top-6 from rag_files namespace)
- [x] bge-reranker-v2-m3 added to similarBooks, similarAuthors, thematicSearch
- [x] Post-enrichment re-indexing hooks in all 4 enrichment pipelines
- [x] Smart Upload auto-indexing on commit
- [x] Google Drive fully removed from architecture
- [x] RAG generation: 175 new RAG files generated (187/187 = 100% ready)
- [x] autoTagAll: 187/187 (100%) authors tagged
- [x] scoreAllAuthors: 187/187 (100%) authors scored against 8 user interests
- [x] author_aliases table + seed script (159 aliases) + useAuthorAliases hook
- [x] ESLint rules-of-hooks: 0 errors across all 100+ client source files
- [x] ESLint exhaustive-deps: 0 warnings remaining
- [x] Real-time author search bar (inline, debounced, match count badge)
- [x] Collapsible activity strips (Recently Enriched, Recently Tagged)
- [x] Neon pgvector migration: neonVector.service.ts, HNSW index, Gemini embeddings
- [x] Backup toast with per-subfolder file counts
- [x] Admin infotips on sidebar nav items
- [x] Dropbox folder browser (AdminDropboxFolderBrowser)
- [x] Run All Pipelines Now button in AdminIntelligenceDashboard
- [x] Near-duplicate detection (semanticDuplicate.service.ts, cosine >= 0.92)
- [x] Semantic Interest Heatmap admin tab (AdminSemanticMapTab)
- [x] Human Review Queue (humanReviewQueue.router.ts + AdminReviewQueueTab.tsx)
- [x] Enrichment Orchestrator (enrichmentOrchestrator.service.ts, 13 pipelines)
- [x] Content Intelligence service (URL health + LLM quality scoring)
- [x] Duplicate detection system (content_hash, duplicate_of_id, AdminDuplicatesTab)
- [x] S3 CDN migration UI (AdminS3AuditTab)
- [x] Dropbox inbox ingestion pipeline (dropboxIngest.service.ts, PDF → S3 → DB)
- [x] Atlantic magazine pipeline (atlantic_articles table, atlantic.router.ts)
- [x] Premium news enrichment (newsOutlets.ts, 8 outlets)
- [x] Library catalog APIs (Open Library, HathiTrust, DPLA)
- [x] Author/book card tabbed layout (Info/Books tabs, Details/Notes tabs)
- [x] Command palette (Cmd/Ctrl+K)
- [x] Book ISBN barcode display on BookDetail
- [x] LinkedIn follower count display on author cards
- [x] CNBC "In the News" badge (built; always 0 due to paid API requirement — see rewritetax.md B2)
- [x] 4 missing DB indexes (isbn, possessionStatus, format, bioCompleteness) — migration 0043
- [x] 5 deterministic verification scripts (verify-db-indexes, verify-neon-coverage, verify-dropbox-folders, audit-enrichment-gaps, verify-s3-coverage)
- [x] Dropbox Authors Folder path fixed (DROPBOX_AUTHORS_FOLDER env var)
- [x] Content gap fill: 18 missing avatars, 24 missing covers, 52 PDFs sourced and uploaded
- [x] ~1024 vitest tests passing, 0 TypeScript errors
