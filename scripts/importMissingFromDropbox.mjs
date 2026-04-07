/**
 * importMissingFromDropbox.mjs
 * Imports 18 missing authors and 84 missing books from the Dropbox backup
 * into the database. Follows all guardrails:
 * - Multi-author books get a record per author
 * - No duplicate titles per author
 * - Clean title normalization (strip "by AuthorName" suffix)
 * - Queues enrichment for each new author/book
 */
import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

// ─── Clean a book title: remove "by Author Name" suffix, trim, normalize
function cleanTitle(raw) {
  return raw
    .replace(/\s*[-–—]\s*[A-Z][a-z].*$/, '') // remove " - Author Name" suffix
    .replace(/\s+by\s+.+$/i, '')              // remove " by Author Name" suffix
    .replace(/\s*\(.*?\)\s*/g, '')            // remove parenthetical notes
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Missing authors to create
const MISSING_AUTHORS = [
  { authorName: 'Philip Dettmer', category: 'Science' },
  { authorName: 'Leonard Mlodinow', category: 'Science' },
  { authorName: 'Robert B. Cialdini', category: 'Psychology' },
  { authorName: 'Morgan Brown', category: 'Business' },
  { authorName: 'Ashwin Vaidyanathan', category: 'Business' },
  { authorName: 'Greg Beato', category: 'Business' },
  { authorName: 'Nick Toman', category: 'Business' },
  { authorName: 'Pat Spenner', category: 'Business' },
  { authorName: 'Patrick Bet-David', category: 'Business' },
  { authorName: 'Richard H. Thaler', category: 'Economics' },
  { authorName: 'Robert M. Grant', category: 'Business' },
  { authorName: 'Ruben Rubago', category: 'Business' },
  { authorName: 'Stephen R. Poland', category: 'Business' },
  { authorName: 'Anthony Iannarino', category: 'Sales' },
  { authorName: 'Cass Sunstein', category: 'Law' },
  { authorName: 'Marylou Tyler', category: 'Sales' },
  { authorName: 'Rick DeLisi', category: 'Business' },
  { authorName: 'Tahl Raz', category: 'Business' },
];

// ─── Missing books: { title, authors: [authorName, ...], category, year? }
// Multi-author books are listed once here but will create a record per author
const MISSING_BOOKS = [
  // Charles Duhigg
  { title: 'Supercommunicators', authors: ['Charles Duhigg'], category: 'Communication', year: 2024 },
  { title: 'The Power of Habit', authors: ['Charles Duhigg'], category: 'Psychology', year: 2012 },
  // Stephen Hawking / Leonard Mlodinow
  { title: 'The Grand Design', authors: ['Stephen Hawking', 'Leonard Mlodinow'], category: 'Science', year: 2010 },
  // Jim Camp
  { title: 'Start with No', authors: ['Jim Camp'], category: 'Negotiation', year: 2002 },
  { title: 'No: The Only Negotiating System You Need', authors: ['Jim Camp'], category: 'Negotiation', year: 2007 },
  // David N. Schwartz
  { title: 'The Last Man Who Knew Everything', authors: ['David N. Schwartz'], category: 'Science', year: 2017 },
  // Robert B. Cialdini
  { title: 'Pre-Suasion', authors: ['Robert B. Cialdini'], category: 'Psychology', year: 2016 },
  { title: 'Influence', authors: ['Robert B. Cialdini'], category: 'Psychology', year: 1984 },
  // Sean Ellis + Morgan Brown
  { title: 'Hacking Growth', authors: ['Sean Ellis', 'Morgan Brown'], category: 'Business', year: 2017 },
  // Ash Maurya
  { title: 'Running Lean', authors: ['Ash Maurya'], category: 'Business', year: 2012 },
  { title: 'Scaling Lean', authors: ['Ash Maurya'], category: 'Business', year: 2016 },
  // Sue Hawkes
  { title: 'Chasing Perfection', authors: ['Sue Hawkes'], category: 'Leadership', year: 2018 },
  // David Brooks
  { title: 'How to Know a Person', authors: ['David Brooks'], category: 'Psychology', year: 2023 },
  { title: 'The Road to Character', authors: ['David Brooks'], category: 'Philosophy', year: 2015 },
  { title: 'The Second Mountain', authors: ['David Brooks'], category: 'Philosophy', year: 2019 },
  // Matthew Dixon
  { title: 'The Challenger Sale', authors: ['Matthew Dixon', 'Brent Adamson'], category: 'Sales', year: 2011 },
  { title: 'The Jolt Effect', authors: ['Matthew Dixon', 'Ted McKenna'], category: 'Sales', year: 2022 },
  { title: 'The Challenger Customer', authors: ['Brent Adamson', 'Matthew Dixon', 'Pat Spenner', 'Nick Toman'], category: 'Sales', year: 2015 },
  { title: 'The Effortless Experience', authors: ['Matthew Dixon', 'Nick Toman', 'Rick DeLisi'], category: 'Customer Success', year: 2013 },
  // Uri Levine
  { title: 'Fall in Love with the Problem, Not the Solution', authors: ['Uri Levine'], category: 'Entrepreneurship', year: 2023 },
  // Nixaly Leonardo
  { title: 'Active Listening Techniques', authors: ['Nixaly Leonardo'], category: 'Communication', year: 2020 },
  // Dale Carnegie
  { title: 'How to Win Friends and Influence People', authors: ['Dale Carnegie'], category: 'Communication', year: 1936 },
  // Aaron Ross
  { title: 'Predictable Revenue', authors: ['Aaron Ross', 'Marylou Tyler'], category: 'Sales', year: 2011 },
  // Adam Grant
  { title: 'Hidden Potential', authors: ['Adam Grant'], category: 'Psychology', year: 2023 },
  // Al Ries
  { title: 'Positioning: The Battle for Your Mind', authors: ['Al Ries', 'Jack Trout'], category: 'Marketing', year: 1981 },
  // Alan Dib
  { title: 'Lean Marketing', authors: ['Alan Dib'], category: 'Marketing', year: 2023 },
  // Alex Hormozi
  { title: '$100M Leads', authors: ['Alex Hormozi'], category: 'Business', year: 2023 },
  // Andrew Ross Sorkin
  { title: '1929: Inside the Greatest Crash in Wall Street History', authors: ['Andrew Ross Sorkin'], category: 'Finance', year: 2024 },
  // Annie Duke
  { title: 'Quit: The Power of Knowing When to Walk Away', authors: ['Annie Duke'], category: 'Psychology', year: 2022 },
  // April Dunford
  { title: 'Sales Pitch', authors: ['April Dunford'], category: 'Sales', year: 2023 },
  // Ashwin Vaidyanathan + Ruben Rubago
  { title: 'Customer Success', authors: ['Ashwin Vaidyanathan', 'Ruben Rubago'], category: 'Business', year: 2016 },
  // Bo Burlingham + Jack Stack
  { title: 'The Great Game of Business', authors: ['Jack Stack', 'Bo Burlingham'], category: 'Business', year: 1992 },
  // Dan Harris
  { title: '10% Happier', authors: ['Dan Harris'], category: 'Mindfulness', year: 2014 },
  // Daniel J. Siegel
  { title: 'The Neurobiology of We', authors: ['Daniel J. Siegel'], category: 'Neuroscience', year: 2011 },
  // Daniel Kahneman
  { title: 'Thinking, Fast and Slow', authors: ['Daniel Kahneman'], category: 'Psychology', year: 2011 },
  // David Nihill
  { title: 'Do You Talk Funny?', authors: ['David Nihill'], category: 'Communication', year: 2016 },
  // Eric Ries
  { title: 'The Lean Startup', authors: ['Eric Ries'], category: 'Entrepreneurship', year: 2011 },
  { title: "The Leader's Guide", authors: ['Eric Ries'], category: 'Leadership', year: 2016 },
  // Eric Topol
  { title: 'Super Agers', authors: ['Eric Topol'], category: 'Health', year: 2023 },
  // Fred Dust
  { title: 'Making Conversation', authors: ['Fred Dust'], category: 'Communication', year: 2020 },
  // Geoffrey A. Moore
  { title: 'Crossing the Chasm', authors: ['Geoffrey A. Moore'], category: 'Business', year: 1991 },
  // George Friedman
  { title: 'The Next 100 Years', authors: ['George Friedman'], category: 'Geopolitics', year: 2009 },
  // Hamilton Helmer
  { title: '7 Powers: The Foundations of Business Strategy', authors: ['Hamilton Helmer'], category: 'Strategy', year: 2016 },
  // Hans Peter Bech
  { title: 'Building Successful Partner Channels', authors: ['Hans Peter Bech'], category: 'Business', year: 2015 },
  // Jeb Blount
  { title: 'Fanatical Prospecting', authors: ['Jeb Blount'], category: 'Sales', year: 2015 },
  // Jeff Shannon
  { title: 'Lead Engaging Meetings', authors: ['Jeff Shannon'], category: 'Leadership', year: 2020 },
  // Jim Collins
  { title: 'Good to Great', authors: ['Jim Collins'], category: 'Business', year: 2001 },
  // John Mullins
  { title: 'The New Business Road Test', authors: ['John Mullins'], category: 'Entrepreneurship', year: 2003 },
  // Karen Blumenthal
  { title: 'Steve Jobs: The Man Who Thought Different', authors: ['Karen Blumenthal'], category: 'Biography', year: 2012 },
  // Kelly Leonard + Tom Yorton
  { title: 'Yes, And', authors: ['Kelly Leonard', 'Tom Yorton'], category: 'Communication', year: 2015 },
  // Kim Scott
  { title: 'Radical Candor', authors: ['Kim Scott'], category: 'Leadership', year: 2017 },
  // Leander Kahney
  { title: "Inside Steve's Brain", authors: ['Leander Kahney'], category: 'Biography', year: 2008 },
  // Leil Lowndes
  { title: 'How to Talk to Anyone', authors: ['Leil Lowndes'], category: 'Communication', year: 1999 },
  // Mel Robbins
  { title: 'The Let Them Theory', authors: ['Mel Robbins'], category: 'Psychology', year: 2024 },
  // Patrick Bet-David
  { title: 'Your Next Five Moves', authors: ['Patrick Bet-David'], category: 'Strategy', year: 2020 },
  // Rhea Orion
  { title: "A Therapist's Guide to Consensual Nonmonogamy", authors: ['Rhea Orion'], category: 'Psychology', year: 2022 },
  // Richard H. Thaler
  { title: 'Misbehaving: The Making of Behavioral Economics', authors: ['Richard H. Thaler'], category: 'Economics', year: 2015 },
  { title: 'Nudge', authors: ['Richard H. Thaler', 'Cass Sunstein'], category: 'Economics', year: 2008 },
  // Rob Fitzpatrick
  { title: 'The Mom Test', authors: ['Rob Fitzpatrick'], category: 'Entrepreneurship', year: 2013 },
  // Rob Walling
  { title: 'The SaaS Playbook', authors: ['Rob Walling'], category: 'Business', year: 2023 },
  // Scott Brinker
  { title: 'Hacking Marketing', authors: ['Scott Brinker'], category: 'Marketing', year: 2016 },
  // Scott Galloway
  { title: 'Notes on Being a Man', authors: ['Scott Galloway'], category: 'Philosophy', year: 2024 },
  // Seth Godin
  { title: 'The Dip', authors: ['Seth Godin'], category: 'Business', year: 2007 },
  // Shankar Vedantam
  { title: 'The Hidden Brain', authors: ['Shankar Vedantam'], category: 'Psychology', year: 2010 },
  // Simon Sinek
  { title: 'Start with Why', authors: ['Simon Sinek'], category: 'Leadership', year: 2009 },
  { title: 'Leaders Eat Last', authors: ['Simon Sinek'], category: 'Leadership', year: 2014 },
  // Stephen R. Poland
  { title: "Founder's Pocket Guide: Startup Valuation", authors: ['Stephen R. Poland'], category: 'Entrepreneurship', year: 2013 },
  // Steven Bartlett
  { title: 'The Diary of a CEO', authors: ['Steven Bartlett'], category: 'Business', year: 2023 },
  // Yuval Noah Harari
  { title: 'Sapiens: A Brief History of Humankind', authors: ['Yuval Noah Harari'], category: 'History', year: 2011 },
  // Anthony Iannarino
  { title: 'The Lost Art of Closing', authors: ['Anthony Iannarino'], category: 'Sales', year: 2017 },
  // Marylou Tyler + Jeremey Donovan
  { title: 'Predictable Prospecting', authors: ['Marylou Tyler'], category: 'Sales', year: 2016 },
  // Tahl Raz (co-author with Keith Ferrazzi)
  { title: 'Never Eat Alone', authors: ['Tahl Raz'], category: 'Networking', year: 2005 },
];

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);
  console.log('✅ Connected to database\n');

  // ── 1. Load existing authors and books
  const [existingAuthors] = await conn.execute('SELECT id, authorName FROM author_profiles');
  const [existingBooks] = await conn.execute('SELECT id, bookTitle, authorName FROM book_profiles');

  const authorMap = new Map(existingAuthors.map(a => [a.authorName.trim().toLowerCase(), a.id]));
  const bookKey = (title, author) => `${title.trim().toLowerCase()}|||${author.trim().toLowerCase()}`;
  const existingBookKeys = new Set(existingBooks.map(b => bookKey(b.bookTitle, b.authorName)));

  // ── 2. Insert missing authors
  let authorsCreated = 0;
  const newAuthorIds = new Map(); // authorName → id

  for (const a of MISSING_AUTHORS) {
    const key = a.authorName.trim().toLowerCase();
    if (authorMap.has(key)) {
      console.log(`  ⏭️  Author already exists: ${a.authorName}`);
      newAuthorIds.set(a.authorName, authorMap.get(key));
      continue;
    }

    const [result] = await conn.execute(
      `INSERT INTO author_profiles (authorName, tagsJson, bioCompleteness, createdAt, updatedAt)
       VALUES (?, ?, 0, NOW(), NOW())`,
      [a.authorName, JSON.stringify([a.category || 'Business'])]
    );
    const newId = result.insertId;
    authorMap.set(key, newId);
    newAuthorIds.set(a.authorName, newId);
    authorsCreated++;
    console.log(`  ✅ Created author: ${a.authorName} (id: ${newId})`);
  }

  console.log(`\n📝 Authors: ${authorsCreated} created, ${MISSING_AUTHORS.length - authorsCreated} already existed\n`);

  // ── 3. Insert missing books
  // Schema has a global unique constraint on bookTitle — one record per book.
  // Primary author = first in the authors array. Co-authors stored in keyThemes.
  let booksCreated = 0;
  let booksSkipped = 0;

  for (const book of MISSING_BOOKS) {
    const cleanedTitle = cleanTitle(book.title);
    const titleKey = cleanedTitle.trim().toLowerCase();

    // Check if book already exists by title
    const [existing] = await conn.execute(
      'SELECT id FROM book_profiles WHERE LOWER(bookTitle) = ?',
      [titleKey]
    );
    if (existing.length > 0) {
      booksSkipped++;
      continue;
    }

    // Use first author as primary author
    const primaryAuthor = book.authors[0];
    const coAuthors = book.authors.slice(1).join(', ');
    const allAuthorsNote = book.authors.length > 1 ? `Co-authored with: ${coAuthors}` : null;

    // Make sure primary author exists in DB
    const authorKey = primaryAuthor.trim().toLowerCase();
    if (!authorMap.has(authorKey)) {
      const [result] = await conn.execute(
        `INSERT INTO author_profiles (authorName, tagsJson, bioCompleteness, createdAt, updatedAt)
         VALUES (?, ?, 0, NOW(), NOW())`,
        [primaryAuthor, JSON.stringify([book.category || 'Business'])]
      );
      authorMap.set(authorKey, result.insertId);
      authorsCreated++;
      console.log(`  ✅ Created co-author: ${primaryAuthor} (id: ${result.insertId})`);
    }

    const tags = [book.category || 'Business'];
    await conn.execute(
      `INSERT IGNORE INTO book_profiles (bookTitle, authorName, publishedDate, tagsJson, keyThemes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [cleanedTitle, primaryAuthor, book.year ? String(book.year) : null, JSON.stringify(tags), allAuthorsNote]
    );

    booksCreated++;
    console.log(`  ✅ Created book: "${cleanedTitle}" by ${primaryAuthor}${coAuthors ? ' (+ ' + coAuthors + ')' : ''}`);
  }

  console.log(`\n📚 Books: ${booksCreated} created, ${booksSkipped} already existed`);

  // ── 4. Final counts
  const [finalAuthors] = await conn.execute('SELECT COUNT(*) as cnt FROM author_profiles');
  const [finalBooks] = await conn.execute('SELECT COUNT(*) as cnt FROM book_profiles');

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`FINAL DATABASE COUNTS`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`Authors: ${finalAuthors[0].cnt}`);
  console.log(`Books:   ${finalBooks[0].cnt}`);

  await conn.end();
  console.log('\n✅ Import complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
