---
name: neon-pgvector
description: >
  Vector search, RAG chatbot context retrieval, and semantic recommendations for the RC Library app.
  As of April 18, 2026, the vector database is Neon pgvector (migrated from Pinecone).
  Use when adding new vector search features, debugging search results, extending the chatbot,
  or re-indexing content after enrichment.

  WARNING: This skill was formerly named "pinecone-rag". Pinecone has been fully
  removed. All references to pinecone.service.ts are stale. Use neonVector.service.ts instead.
---

# Neon pgvector -- RC Library App

## Overview

The RC Library uses **Neon Postgres with pgvector** for semantic search, RAG chatbot context
retrieval, and content recommendations. Vectors are 1536-dimensional cosine embeddings generated
by Gemini `gemini-embedding-001` with `outputDimensionality: 1536`.

## Key Files

```
server/services/neonVector.service.ts        <- Vector DB client (upsert, query, stats)
server/services/incrementalIndex.service.ts  <- indexAuthorIncremental, indexBookIncremental
server/services/ragPipeline.service.ts       <- embedBatch, indexRagFile, indexContentItem
server/routers/vectorSearch.router.ts        <- tRPC procedures for search + index management
server/routers/recommendations.router.ts     <- similarBooks, similarAuthors, thematicSearch
server/routers/authorChatbot.router.ts       <- RAG chatbot context retrieval + LLM chat
scripts/reindex_pg.cjs                       <- Pure-Node bulk re-indexing script
```

## Neon Table Schema

```sql
CREATE TABLE vector_embeddings (
  id          TEXT PRIMARY KEY,
  namespace   TEXT NOT NULL,
  embedding   vector(1536),
  metadata    JSONB,
  title       TEXT,
  text        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ON vector_embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX ON vector_embeddings (namespace);
```

## Embedding

Always use `embedBatch()` from `ragPipeline.service.ts`. Never call the Gemini API directly.

```ts
import { embedBatch } from "../services/ragPipeline.service";
const vectors = await embedBatch(["text one", "text two"]);
// Returns number[][] -- one 1536-dim vector per input string
```

**Model:** `models/gemini-embedding-001` with `outputDimensionality: 1536`

**Critical:** Do NOT use `text-embedding-004` -- it returns 404 on the Gemini v1beta endpoint.
Do NOT omit `outputDimensionality` -- the default produces 3072 dims which exceed the HNSW limit.

## Upsert Vectors

```ts
import { upsertVectors } from "../services/neonVector.service";
import type { UpsertVectorInput } from "../services/neonVector.service";

const records: UpsertVectorInput[] = [{
  id: `author-${authorId}`,
  values: embeddingVector,
  metadata: {
    contentType: "author",
    sourceId: String(authorId),
    title: authorName,
    authorName,
    text: bioText,
  },
  namespace: "authors",
}];
await upsertVectors(records);
```

The `upsertVectors` function uses `INSERT ... ON CONFLICT (id) DO UPDATE` -- safe to call
repeatedly (idempotent).

## Query Vectors

```ts
import { queryVectors } from "../services/neonVector.service";

const results = await queryVectors({
  namespace: "books",
  queryText: "leadership and resilience",
  topK: 20,
  filter: { contentType: "book" },
});
// Returns QueryResult[] sorted by cosine score descending
```

## Reranking

Pinecone's `bge-reranker-v2-m3` reranker is no longer available. The three search procedures
(`similarBooks`, `similarAuthors`, `thematicSearch`) now sort by cosine score directly.
This is the correct fallback -- cosine similarity is already a strong signal.

If you need a reranker in the future, consider Cohere Rerank or a local cross-encoder model.

## RAG Chatbot Context Retrieval

The chatbot uses chunk retrieval, NOT full-file injection. The `ragChatContext` procedure in
`recommendations.router.ts` queries the `rag_files` namespace with the user's message and
returns the top 6 chunks.

```ts
// In authorChatbot.router.ts -- already wired:
const ragCtx = await caller.recommendations.ragChatContext({
  authorId: input.authorId,
  query: input.message,
  topK: 6,
});
// ragCtx.chunks is an array of { text, score } objects
// Inject into system prompt as a "Knowledge Chunks" section
```

## Incremental Indexing (skip-if-already-indexed)

Use `indexAuthorIncremental` / `indexBookIncremental` for bulk operations -- they skip rows
that already have a Neon vector, preventing duplicate work.

```ts
import { indexAuthorIncremental, indexBookIncremental } from "../services/incrementalIndex.service";
await indexAuthorIncremental(authorId); // skips if already indexed
await indexBookIncremental(bookId);     // skips if already indexed
```

## Post-Enrichment Re-indexing (automatic)

Neon vectors are automatically refreshed whenever:
- `runBioEnrichment` or `runRichBioEnrichment` updates an author bio
- `runRichSummaryEnrichment` updates a book summary
- Admin manually enriches an author via the single-author enrich procedure
- A book profile is updated via `handleUpdateBook`
- A Smart Upload is committed (if `neonNamespace` is set and `shouldIndexNeon: true`)

**Do not** call indexing functions from client-side code. Always trigger from server-side tRPC procedures.

## Bulk Re-indexing from Command Line

Use the pure-Node script (no tsx, no OOM):

```bash
# Index all authors (batches of 20)
for OFFSET in 0 20 40 60 80 100 120 140 160 180 200; do
  node scripts/reindex_pg.cjs authors $OFFSET 20
done

# Index all books (batches of 20)
for OFFSET in 0 20 40 60 80 100 120 140 160 180; do
  node scripts/reindex_pg.cjs books $OFFSET 20
done
```

The script uses `pg` (not `@neondatabase/serverless`) and the Gemini REST API directly to
avoid the OOM issues that tsx + Neon serverless driver cause in the sandbox.

## Current Vector Counts (Apr 18, 2026)

| Namespace | Vectors | Content |
|---|---|---|
| `authors` | 183 | Author bios and richBioJson |
| `books` | 165 | Book summaries and richSummaryJson |
| `lb_pitchdeck` | 28 | Library pitch deck RAG chunks |
| `lb_documents` | 8 | Library document RAG chunks |
| `lb_website` | 7 | Library website RAG chunks |
| `lb_app_data` | 4 | Library app data RAG chunks |
| **Total** | **395** | |

## Common Pitfalls

- **Wrong embedding model**: Use `gemini-embedding-001` with `outputDimensionality: 1536`.
  `text-embedding-004` returns 404. Omitting `outputDimensionality` produces 3072 dims.
- **Stale vectors**: enrichment pipelines now auto-re-index, but manually editing `bio` or
  `summary` directly in the DB (not via tRPC) will leave vectors stale. Always use tRPC procedures.
- **Empty text field**: vectors without a `text` metadata field will fail any reranker that
  needs document text. Always include `text` in `VectorMetadata`.
- **OOM in vitest**: `@neondatabase/serverless` is too large for vitest worker heap. Mock the
  Neon client in tests. Run live integration tests as standalone Node scripts.
- **JWT auth from shell**: The server's `JWT_SECRET` is injected by the Manus platform and
  differs from the shell environment. Cannot generate valid admin tokens from shell scripts.
  Use direct DB + REST API scripts instead of calling tRPC procedures from shell.

## Migration History (Pinecone to Neon, Apr 18, 2026)

| Change | Detail |
|---|---|
| Service file | `pinecone.service.ts` replaced by `neonVector.service.ts` (same public API) |
| Schema column | `smart_uploads.pineconeNamespace` renamed to `neonNamespace` (migration 0045) |
| Pipeline keys | `pinecone-index-authors/books` renamed to `neon-index-authors/books` |
| Reranker | Pinecone `bge-reranker-v2-m3` replaced by cosine-score sort |
| Embedding dims | 3072 (default gemini-embedding-001) reduced to 1536 (outputDimensionality param) |
| Vector count | 1,160 (Pinecone) reduced to 395 (Neon, after re-index) |
