# Authors & Books Library — Project TODO

Last cleaned: Apr 20, 2026

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

## Code Cleanup

- [ ] Delete `client/src/lib/authorAliases.ts` (superseded by DB; still imported in 10+ places — refactor callers first)
- [ ] Delete `client/src/lib/authorAvatars.ts` (superseded by DB; still imported in 10+ places — refactor callers first)
- [ ] Write vitest tests for Dropbox ingestion pipeline (remaining gap)

---

## Audit Fixes — Remaining Items (from Apr 18 2026 Audit)

- [ ] P1: Fix N+1 query in contentItems.list — use JOIN instead of separate authorContentLinks query
- [ ] P2: Add DB indexes on includedInLibrary, contentType, enrichedAt columns
- [ ] H1: Memoize AuthorCard grid + debounce search input 300ms
- [ ] H3: Fix CommandPalette Cmd+K to check event.defaultPrevented
- [ ] M1: Add keyboard navigation (tabIndex, onKeyDown) to author/book card grids
- [ ] M2: Set staleTime: 5min on AuthorModal + BookModal queries
- [ ] M3: Add 400ms debounce to SemanticSearchDropdown input
- [ ] M4: Add Skeleton placeholders to AuthorDetail + BookDetail loading states
- [ ] M5: Add axis labels + legend + tooltip to InterestHeatmap
- [ ] M7: Lazy-initialize CommandPalette only on first Cmd+K press
- [ ] A1: Add Zod schemas for all JSON blob columns in authorProfiles
- [ ] A4: Validate embedding values are finite numbers before Neon vector concatenation
- [ ] A5: Split drizzle/schema.ts into domain files (authors, books, content, enrichment)
- [ ] Q1: Standardize error handling — critical ops throw, reads return typed Result
- [ ] S8: Sanitize error messages in storage.ts — strip response body from client-facing errors
- [ ] L1: Remove unused imports in AuthorDetail.tsx
- [ ] L2: Replace magic strings for tab types with typed constants
- [ ] L3: Add ARIA attributes to PageLoader spinner
- [ ] L4: Replace inline accentColor styles with CSS custom properties in ReadingPathPanel
- [ ] L5: Add onError toast callbacks to all mutations in AuthorCardActions
- [ ] Add infotips to Admin tab content: buttons, stat cards, configuration fields
- [ ] Add orchestrator first-run guidance card (shows when no jobs have run yet)

---

## Deferred / Low Priority

- [ ] Semantic Interest Heatmap: cluster authors/books by vector similarity with UMAP (P3)

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
