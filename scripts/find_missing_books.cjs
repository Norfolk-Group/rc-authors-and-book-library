"use strict";
require("dotenv/config");
const { Client } = require("pg");
const mysql = require("mysql2");

const neon = new Client({ connectionString: process.env.NEON_DATABASE_URL });
const pool = mysql.createPool(process.env.DATABASE_URL);

function mysqlQuery(sql, params) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function main() {
  await neon.connect();
  const r = await neon.query("SELECT id FROM vector_embeddings WHERE namespace = 'books'");
  const indexedIds = new Set(r.rows.map(row => row.id));
  
  const books = await mysqlQuery("SELECT id, bookTitle FROM book_profiles ORDER BY id", []);
  const missing = books.filter(b => !indexedIds.has("book-" + b.id));
  
  console.log("Total books in DB:", books.length);
  console.log("Books in Neon:", indexedIds.size);
  console.log("Missing:", missing.length);
  missing.forEach(b => console.log(" ", b.id, b.bookTitle && b.bookTitle.slice(0, 50)));
  
  await neon.end();
  pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
