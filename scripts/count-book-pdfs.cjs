#!/usr/bin/env node
/**
 * count-book-pdfs.cjs
 *
 * Read-only audit: how many of the books in `book_profiles` actually have a
 * PDF file recorded in `content_files`, and which are missing one.
 *
 * The link is: book_profiles.bookTitle  ──(normalized title match)──►
 *              content_items (contentType='book')  ──(contentItemId)──►
 *              content_files (fileType='pdf')
 *
 * This script ONLY reads. It never writes, updates, or deletes anything.
 *
 * ── How to run (Windows PowerShell) ──────────────────────────────────────────
 *   1. Clone/pull the repo and install deps once:
 *        pnpm install         (mysql2 is the only dependency this needs)
 *   2. Put your TiDB connection string in the environment for this shell:
 *        $env:DATABASE_URL = "mysql://user:pass@host:4000/dbname"
 *      (copy it from Railway → your service → Variables → DATABASE_URL)
 *   3. Run:
 *        node scripts/count-book-pdfs.cjs
 *
 *   Optional: write the full missing-list to a file:
 *        node scripts/count-book-pdfs.cjs > pdf-audit.txt
 *
 * The connection string is read from the environment only — it is never
 * printed and never committed. Do NOT paste it as a command-line argument
 * (it would land in your shell history).
 */

const mysql = require("mysql2/promise");

function normalizeTitle(t) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, " ") // collapse punctuation to spaces
    .trim();
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "ERROR: DATABASE_URL is not set.\n" +
        'In PowerShell run:  $env:DATABASE_URL = "mysql://..."  then re-run this script.'
    );
    process.exit(1);
  }

  // TiDB Cloud Serverless requires TLS (same as server/db.ts).
  const conn = await mysql.createConnection({
    uri: url,
    ssl: { minVersion: "TLSv1.2" },
  });

  try {
    // ── Raw totals ────────────────────────────────────────────────────────────
    const [[{ bookCount }]] = await conn.query(
      "SELECT COUNT(*) AS bookCount FROM book_profiles"
    );
    const [[{ bookItemCount }]] = await conn.query(
      "SELECT COUNT(*) AS bookItemCount FROM content_items WHERE contentType = 'book'"
    );
    const [[{ pdfFileCount }]] = await conn.query(
      "SELECT COUNT(*) AS pdfFileCount FROM content_files WHERE fileType = 'pdf'"
    );

    // ── Books and their content_item titles ────────────────────────────────────
    const [books] = await conn.query(
      "SELECT id, bookTitle, authorName FROM book_profiles ORDER BY authorName, bookTitle"
    );

    // content_items of type book, with a flag for whether they have >=1 PDF file
    const [bookItems] = await conn.query(`
      SELECT ci.id, ci.title,
             SUM(CASE WHEN cf.fileType = 'pdf' THEN 1 ELSE 0 END) AS pdfCount
      FROM content_items ci
      LEFT JOIN content_files cf ON cf.contentItemId = ci.id
      WHERE ci.contentType = 'book'
      GROUP BY ci.id, ci.title
    `);

    // Build a normalized-title → hasPdf lookup from content_items
    const titleToPdf = new Map();
    for (const item of bookItems) {
      const key = normalizeTitle(item.title);
      const has = Number(item.pdfCount) > 0;
      // If any matching content_item has a PDF, treat the title as covered
      titleToPdf.set(key, (titleToPdf.get(key) || false) || has);
    }

    const withPdf = [];
    const missingPdf = [];
    for (const b of books) {
      const key = normalizeTitle(b.bookTitle);
      if (titleToPdf.get(key)) withPdf.push(b);
      else missingPdf.push(b);
    }

    // ── Orphan PDFs: content_files PDFs whose content_item title matches no book ─
    const bookTitleKeys = new Set(books.map((b) => normalizeTitle(b.bookTitle)));
    let orphanPdfs = 0;
    for (const item of bookItems) {
      if (Number(item.pdfCount) > 0 && !bookTitleKeys.has(normalizeTitle(item.title))) {
        orphanPdfs += Number(item.pdfCount);
      }
    }

    // ── Report ──────────────────────────────────────────────────────────────
    console.log("\n===== BOOK PDF COVERAGE AUDIT =====\n");
    console.log(`Books in book_profiles ............... ${bookCount}`);
    console.log(`content_items (contentType='book') ... ${bookItemCount}`);
    console.log(`PDF files in content_files ........... ${pdfFileCount}`);
    console.log("");
    console.log(`Books WITH a PDF ..................... ${withPdf.length}`);
    console.log(`Books MISSING a PDF .................. ${missingPdf.length}`);
    const pct = bookCount ? ((withPdf.length / bookCount) * 100).toFixed(1) : "0.0";
    console.log(`Coverage ............................. ${pct}%`);
    console.log(`Orphan PDFs (no matching book) ....... ${orphanPdfs}`);

    if (missingPdf.length) {
      console.log("\n----- BOOKS MISSING A PDF -----");
      for (const b of missingPdf) {
        console.log(`  • ${b.bookTitle}${b.authorName ? `  —  ${b.authorName}` : ""}`);
      }
    }
    console.log("\n===================================\n");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("Audit failed:", err.message);
  process.exit(1);
});
