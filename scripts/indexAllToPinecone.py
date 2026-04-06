#!/usr/bin/env python3
"""
Full Pinecone indexing pipeline for the NCG Library.
Uses Python for memory-efficient processing of 3072-dim vectors.

Indexes:
  1. Book summaries (138 books)
  2. Author bios (89 authors)
  3. Content item descriptions (157 items)
  4. RAG files (10 ready)

Uses Gemini gemini-embedding-001 (3072-dim) for embeddings.
"""
import os
import sys
import time
import json
import re
import mysql.connector
from pinecone import Pinecone, ServerlessSpec
import google.generativeai as genai

# ── Config ────────────────────────────────────────────────────────────────────
PINECONE_INDEX_NAME = "library-rag"
EMBEDDING_DIMENSION = 3072
EMBEDDING_MODEL = "models/gemini-embedding-001"
PROCESS_BATCH = 5   # records per DB fetch
UPSERT_BATCH = 50   # vectors per Pinecone upsert

# ── Clients ───────────────────────────────────────────────────────────────────
pc = Pinecone(api_key=os.environ["PINECONE_API_KEY"])
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

# Parse DATABASE_URL for MySQL connection
db_url = os.environ["DATABASE_URL"]
# Format: mysql://user:pass@host:port/dbname?ssl=...
match = re.match(r'mysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)', db_url)
if not match:
    print("ERROR: Could not parse DATABASE_URL")
    sys.exit(1)

db_user, db_pass, db_host, db_port, db_name = match.groups()
# URL-decode the password
from urllib.parse import unquote
db_pass = unquote(db_pass)

conn = mysql.connector.connect(
    host=db_host,
    port=int(db_port),
    user=db_user,
    password=db_pass,
    database=db_name,
    ssl_disabled=False,
    ssl_verify_cert=False,
)
cursor = conn.cursor(dictionary=True)

# ── Helpers ───────────────────────────────────────────────────────────────────
def embed_text(text):
    """Embed text using Gemini gemini-embedding-001, returns 3072-dim list."""
    result = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=text[:8192],
    )
    return result['embedding']

def chunk_text(text, chunk_size=2000, overlap=200):
    """Split text into overlapping chunks."""
    cleaned = re.sub(r'\s+', ' ', text).strip()
    if len(cleaned) <= chunk_size:
        return [cleaned]
    chunks = []
    start = 0
    while start < len(cleaned):
        end = min(start + chunk_size, len(cleaned))
        break_point = end
        if end < len(cleaned):
            last_period = cleaned.rfind('. ', start, end)
            last_newline = cleaned.rfind('\n', start, end)
            boundary = max(last_period, last_newline)
            if boundary > start + chunk_size // 2:
                break_point = boundary + 1
        chunk = cleaned[start:break_point].strip()
        if len(chunk) > 50:
            chunks.append(chunk)
        # Always advance by at least (chunk_size - overlap) to prevent infinite loop
        next_start = break_point - overlap
        if next_start <= start:
            next_start = start + max(1, chunk_size - overlap)
        start = next_start
    return chunks

def make_vector_id(content_type, source_id, chunk_index):
    safe = re.sub(r'[^a-zA-Z0-9\-_]', '-', str(source_id))[:60]
    return f"{content_type}-{safe}-chunk{chunk_index}"

def process_record(index, namespace, record_id, content_type, text, metadata):
    """Embed text chunks and upsert to Pinecone. Returns vector count.
    
    Metadata schema matches server VectorMetadata:
      contentType, sourceId, title, authorName?, source?, url?,
      chunkIndex?, chunkTotal?, text (the chunk text for retrieval)
    """
    chunks = chunk_text(text)
    vectors = []
    total = 0
    for i, chunk in enumerate(chunks):
        embedding = embed_text(chunk)
        # Use 'text' field (not 'chunkText') to match server VectorMetadata schema
        meta = {**metadata, 'chunkIndex': i, 'chunkTotal': len(chunks), 'text': chunk}
        vectors.append({
            'id': make_vector_id(content_type, record_id, i),
            'values': embedding,
            'metadata': meta,
        })
        if len(vectors) >= UPSERT_BATCH:
            index.upsert(vectors=vectors, namespace=namespace)
            total += len(vectors)
            vectors = []
        if i < len(chunks) - 1:
            time.sleep(0.08)
    if vectors:
        index.upsert(vectors=vectors, namespace=namespace)
        total += len(vectors)
    return total

# ── Step 1: Ensure index exists ───────────────────────────────────────────────
print("\n📌  Step 1: Ensuring Pinecone index exists...")
existing = [idx.name for idx in pc.list_indexes()]
if PINECONE_INDEX_NAME not in existing:
    print(f"  Creating index \"{PINECONE_INDEX_NAME}\" (dim={EMBEDDING_DIMENSION}, metric=cosine)...")
    pc.create_index(
        name=PINECONE_INDEX_NAME,
        dimension=EMBEDDING_DIMENSION,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
    )
    # Wait for it to be ready
    while not pc.describe_index(PINECONE_INDEX_NAME).status.get('ready', False):
        time.sleep(2)
    print(f"  ✅ Index created and ready (dim={EMBEDDING_DIMENSION}).")
else:
    print(f"  ✅ Index \"{PINECONE_INDEX_NAME}\" already exists.")

index = pc.Index(PINECONE_INDEX_NAME)

# ── Step 2: Index books ───────────────────────────────────────────────────────
print("\n📚  Step 2: Indexing books...")
cursor.execute("SELECT id FROM book_profiles WHERE summary IS NOT NULL AND LENGTH(summary) > 50 ORDER BY id")
book_ids = [row['id'] for row in cursor.fetchall()]
print(f"  Found {len(book_ids)} books to index.")

books_indexed, books_skipped, book_vectors = 0, 0, 0
for i in range(0, len(book_ids), PROCESS_BATCH):
    batch_ids = book_ids[i:i+PROCESS_BATCH]
    placeholders = ','.join(['%s'] * len(batch_ids))
    cursor.execute(
        f"SELECT id, bookTitle, authorName, summary, richSummaryJson FROM book_profiles WHERE id IN ({placeholders}) ORDER BY id",
        batch_ids
    )
    for book in cursor.fetchall():
        text = book['summary'] or ''
        try:
            if book['richSummaryJson']:
                rich = book['richSummaryJson'] if isinstance(book['richSummaryJson'], dict) else json.loads(book['richSummaryJson'])
                if rich.get('fullSummary') and len(rich['fullSummary']) > len(text):
                    text = rich['fullSummary']
                elif rich.get('summary') and len(rich['summary']) > len(text):
                    text = rich['summary']
        except Exception:
            pass
        if len(text) < 50:
            books_skipped += 1
            continue
        try:
            count = process_record(index, 'books', str(book['id']), 'book', text, {
                'contentType': 'book',
                'sourceId': str(book['id']),
                'title': book['bookTitle'],
                'authorName': book['authorName'] or '',
                'source': 'library',
            })
            book_vectors += count
            books_indexed += 1
        except Exception as e:
            print(f"  ⚠️  Book \"{book['bookTitle']}\": {str(e)[:60]}")
            books_skipped += 1
    progress = min(i + PROCESS_BATCH, len(book_ids))
    if progress % 20 == 0 or progress >= len(book_ids):
        print(f"  [{progress}/{len(book_ids)}] books processed...")

print(f"  ✅ Books: {books_indexed} indexed, {books_skipped} skipped, {book_vectors} vectors")

# ── Step 3: Index authors ─────────────────────────────────────────────────────
print("\n👤  Step 3: Indexing authors...")
cursor.execute("SELECT id FROM author_profiles WHERE bio IS NOT NULL AND LENGTH(bio) > 50 ORDER BY id")
author_ids = [row['id'] for row in cursor.fetchall()]
print(f"  Found {len(author_ids)} authors to index.")

authors_indexed, authors_skipped, author_vectors = 0, 0, 0
for i in range(0, len(author_ids), PROCESS_BATCH):
    batch_ids = author_ids[i:i+PROCESS_BATCH]
    placeholders = ','.join(['%s'] * len(batch_ids))
    cursor.execute(
        f"SELECT id, authorName, bio, richBioJson FROM author_profiles WHERE id IN ({placeholders}) ORDER BY id",
        batch_ids
    )
    for author in cursor.fetchall():
        bio_text = author['bio'] or ''
        try:
            if author['richBioJson']:
                rich = author['richBioJson'] if isinstance(author['richBioJson'], dict) else json.loads(author['richBioJson'])
                if rich.get('fullBio') and len(rich['fullBio']) > len(bio_text):
                    bio_text = rich['fullBio']
        except Exception:
            pass
        if len(bio_text) < 50:
            authors_skipped += 1
            continue
        try:
            count = process_record(index, 'authors', str(author['id']), 'author', bio_text, {
                'contentType': 'author',
                'sourceId': str(author['id']),
                'title': author['authorName'],
                'authorName': author['authorName'],
                'source': 'library',
            })
            author_vectors += count
            authors_indexed += 1
        except Exception as e:
            print(f"  ⚠️  Author \"{author['authorName']}\": {str(e)[:60]}")
            authors_skipped += 1
    progress = min(i + PROCESS_BATCH, len(author_ids))
    if progress % 20 == 0 or progress >= len(author_ids):
        print(f"  [{progress}/{len(author_ids)}] authors processed...")

print(f"  ✅ Authors: {authors_indexed} indexed, {authors_skipped} skipped, {author_vectors} vectors")

# ── Step 4: Index content items ───────────────────────────────────────────────
print("\n📄  Step 4: Indexing content items...")
cursor.execute("SELECT id FROM content_items WHERE description IS NOT NULL AND LENGTH(description) > 50 ORDER BY id LIMIT 500")
item_ids = [row['id'] for row in cursor.fetchall()]
print(f"  Found {len(item_ids)} content items to index.")

items_indexed, items_skipped, item_vectors = 0, 0, 0
for i in range(0, len(item_ids), PROCESS_BATCH):
    batch_ids = item_ids[i:i+PROCESS_BATCH]
    placeholders = ','.join(['%s'] * len(batch_ids))
    cursor.execute(
        f"SELECT id, title, contentType, url, description FROM content_items WHERE id IN ({placeholders}) ORDER BY id",
        batch_ids
    )
    for item in cursor.fetchall():
        text = item['description'] or ''
        if len(text) < 50:
            items_skipped += 1
            continue
        try:
            count = process_record(index, 'content_items', str(item['id']), 'content_item', text, {
                'contentType': 'content_item',
                'sourceId': str(item['id']),
                'title': item['title'] or '',
                'source': item['contentType'] or 'unknown',
                'url': item['url'] or '',
            })
            item_vectors += count
            items_indexed += 1
        except Exception as e:
            print(f"  ⚠️  Item \"{item['title']}\": {str(e)[:60]}")
            items_skipped += 1
    progress = min(i + PROCESS_BATCH, len(item_ids))
    if progress % 25 == 0 or progress >= len(item_ids):
        print(f"  [{progress}/{len(item_ids)}] content items processed...")

print(f"  ✅ Content items: {items_indexed} indexed, {items_skipped} skipped, {item_vectors} vectors")

# ── Step 5: Index RAG files ───────────────────────────────────────────────────
print("\n🗂️   Step 5: Indexing RAG files...")
cursor.execute("SELECT id, authorName, ragFileUrl, ragVersion FROM author_rag_profiles WHERE ragStatus = 'ready' AND ragFileUrl IS NOT NULL ORDER BY id")
rag_profiles = cursor.fetchall()
print(f"  Found {len(rag_profiles)} ready RAG files.")

import urllib.request
rags_indexed, rags_skipped, rag_vectors = 0, 0, 0
for profile in rag_profiles:
    try:
        with urllib.request.urlopen(profile['ragFileUrl'], timeout=30) as resp:
            rag_content = resp.read().decode('utf-8')
        if len(rag_content) < 100:
            rags_skipped += 1
            continue
        count = process_record(index, 'rag_files', profile['authorName'], 'rag_file', rag_content, {
            'contentType': 'rag_file',
            'sourceId': profile['authorName'],
            'title': profile['authorName'],
            'authorName': profile['authorName'],
            'source': f"rag_v{profile['ragVersion'] or 1}",
        })
        rag_vectors += count
        rags_indexed += 1
        print(f"  ✅ RAG: {profile['authorName']} ({count} vectors)")
    except Exception as e:
        print(f"  ⚠️  RAG \"{profile['authorName']}\": {str(e)[:60]}")
        rags_skipped += 1

print(f"  ✅ RAG files: {rags_indexed} indexed, {rags_skipped} skipped, {rag_vectors} vectors")

# ── Final stats ───────────────────────────────────────────────────────────────
total_vectors = book_vectors + author_vectors + item_vectors + rag_vectors
print("\n=== PINECONE INDEXING COMPLETE ===")
print(f"  Books:         {books_indexed} indexed ({book_vectors} vectors)")
print(f"  Authors:       {authors_indexed} indexed ({author_vectors} vectors)")
print(f"  Content items: {items_indexed} indexed ({item_vectors} vectors)")
print(f"  RAG files:     {rags_indexed} indexed ({rag_vectors} vectors)")
print(f"  TOTAL VECTORS: {total_vectors}")

try:
    stats = index.describe_index_stats()
    print("\nPinecone index stats:")
    print(f"  Total vector count: {stats.get('total_vector_count', 'N/A')}")
    for ns, info in (stats.get('namespaces') or {}).items():
        print(f"  Namespace \"{ns}\": {info.get('vector_count', 'N/A')} vectors")
except Exception as e:
    print(f"Could not fetch index stats: {e}")

cursor.close()
conn.close()
print("\n✅  Done!")
