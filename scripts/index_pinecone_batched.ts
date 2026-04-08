/**
 * Batched Pinecone indexing script
 * Indexes all authors and books in small batches with rate limiting
 * to avoid server crashes and gateway timeouts.
 */
import { getDb } from "../server/db";
import { authorProfiles, bookProfiles } from "../drizzle/schema";
import { indexAuthor, indexBook } from "../server/services/ragPipeline.service";

const BATCH_SIZE = 10;
const DELAY_MS = 2000; // 2 seconds between batches

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function indexAllAuthors() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const allAuthors = await db.select().from(authorProfiles);
  const RESUME_FROM = 136; // Resume from author index 136 (after Nir Eyal)
  const authors = allAuthors.slice(RESUME_FROM);
  console.log(`Found ${allAuthors.length} total authors, resuming from index ${RESUME_FROM} (${authors.length} remaining)`);
  
  let indexed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (let i = 0; i < authors.length; i += BATCH_SIZE) {
    const batch = authors.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing author batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(authors.length/BATCH_SIZE)} (${i+1}-${Math.min(i+BATCH_SIZE, authors.length)})`);
    
    for (const author of batch) {
      let bioText = author.bio ?? "";
      try {
        if (author.richBioJson) {
          const rich = typeof author.richBioJson === "string"
            ? JSON.parse(author.richBioJson as string)
            : author.richBioJson;
          if (rich?.bio && rich.bio.length > bioText.length) bioText = rich.bio;
          if (rich?.fullBio && rich.fullBio.length > bioText.length) bioText = rich.fullBio;
        }
      } catch { /* use plain bio */ }
      
      if (bioText.length < 50) {
        console.log(`  SKIP ${author.authorName} (bio too short: ${bioText.length} chars)`);
        skipped++;
        continue;
      }
      
      try {
        const vectors = await indexAuthor({
          authorId: String(author.id),
          authorName: author.authorName,
          bioText,
        });
        console.log(`  OK ${author.authorName} (${vectors} vectors)`);
        indexed++;
      } catch (err) {
        console.log(`  ERR ${author.authorName}: ${err}`);
        errors++;
      }
    }
    
    if (i + BATCH_SIZE < authors.length) {
      console.log(`  Waiting ${DELAY_MS}ms before next batch...`);
      await sleep(DELAY_MS);
    }
  }
  
  console.log(`\n=== AUTHORS DONE: ${indexed} indexed, ${skipped} skipped, ${errors} errors ===`);
  return { indexed, skipped, errors };
}

async function indexAllBooks() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const books = await db.select().from(bookProfiles);
  console.log(`Found ${books.length} books to index`);
  
  let indexed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (let i = 0; i < books.length; i += BATCH_SIZE) {
    const batch = books.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing book batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(books.length/BATCH_SIZE)} (${i+1}-${Math.min(i+BATCH_SIZE, books.length)})`);
    
    for (const book of batch) {
      let text = book.summary ?? "";
      try {
        if (book.richSummaryJson) {
          const rich = typeof book.richSummaryJson === "string"
            ? JSON.parse(book.richSummaryJson as string)
            : book.richSummaryJson;
          if (rich?.fullSummary && rich.fullSummary.length > text.length) text = rich.fullSummary;
          if (rich?.summary && rich.summary.length > text.length) text = rich.summary;
        }
      } catch { /* use plain summary */ }
      
      if (text.length < 50) {
        console.log(`  SKIP "${book.bookTitle}" (summary too short: ${text.length} chars)`);
        skipped++;
        continue;
      }
      
      try {
        const vectors = await indexBook({
          bookId: String(book.id),
          title: book.bookTitle,
          authorName: book.authorName ?? undefined,
          text,
        });
        console.log(`  OK "${book.bookTitle}" (${vectors} vectors)`);
        indexed++;
      } catch (err) {
        console.log(`  ERR "${book.bookTitle}": ${err}`);
        errors++;
      }
    }
    
    if (i + BATCH_SIZE < books.length) {
      console.log(`  Waiting ${DELAY_MS}ms before next batch...`);
      await sleep(DELAY_MS);
    }
  }
  
  console.log(`\n=== BOOKS DONE: ${indexed} indexed, ${skipped} skipped, ${errors} errors ===`);
  return { indexed, skipped, errors };
}

async function main() {
  console.log("=== PINECONE BATCHED INDEXING ===");
  console.log(`Batch size: ${BATCH_SIZE}, Delay: ${DELAY_MS}ms`);
  console.log(`Started at: ${new Date().toISOString()}`);
  
  try {
    console.log("\n--- INDEXING AUTHORS ---");
    const authorResults = await indexAllAuthors();
    
    console.log("\nWaiting 5 seconds before indexing books...");
    await sleep(5000);
    
    console.log("\n--- INDEXING BOOKS ---");
    const bookResults = await indexAllBooks();
    
    console.log("\n=== FINAL SUMMARY ===");
    console.log(`Authors: ${authorResults.indexed} indexed, ${authorResults.skipped} skipped, ${authorResults.errors} errors`);
    console.log(`Books: ${bookResults.indexed} indexed, ${bookResults.skipped} skipped, ${bookResults.errors} errors`);
    console.log(`Completed at: ${new Date().toISOString()}`);
    
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
