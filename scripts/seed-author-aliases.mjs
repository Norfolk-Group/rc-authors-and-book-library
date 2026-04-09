/**
 * seed-author-aliases.mjs
 *
 * One-time migration: seeds all author alias entries from the hardcoded
 * client/src/lib/authorAliases.ts into the `author_aliases` DB table.
 *
 * Usage: node scripts/seed-author-aliases.mjs
 *
 * Safe to re-run — uses INSERT IGNORE so existing rows are skipped.
 * NOTE: Does NOT load .env — relies on DATABASE_URL already being in the environment.
 */

import mysql from "mysql2/promise";

// ── All alias entries extracted from client/src/lib/authorAliases.ts ─────────
// 171 entries total
const ALIASES = [
  ["Charles Duhigg - Habits, Productivity & Communication", "Charles Duhigg"],
  ["Charles Duhigg - Habits, productivity, and willpower", "Charles Duhigg"],
  ["Eric Topol - Longevity and precision medicine", "Eric Topol"],
  ["Eric Topol - Digital health, AI, and longevity", "Eric Topol"],
  ["Hans Peter Bech - Channel Sales - business development, B2B marketing, and international sales strategy", "Hans Peter Bech"],
  ["Hans Peter Bech - B2B channel strategy and global expansion", "Hans Peter Bech"],
  ["Matthew Dixon - Sales strategy and customer psychology experts", "Matthew Dixon"],
  ["Matthew Dixon - Customer experience and loyalty", "Matthew Dixon"],
  ["Nixaly Leonardo - Active listening and communication", "Nixaly Leonardo"],
  ["Nixaly Leonardo - Therapeutic communication and emotional intelligence", "Nixaly Leonardo"],
  ["Philipp Dettmer - Science communication and visual learning", "Philipp Dettmer"],
  ["Philipp Dettmer - Health", "Philipp Dettmer"],
  ["Scott Brinker - Marketing technology strategy and analysis", "Scott Brinker"],
  ["Scott Brinker - Marketing technology and agile marketing", "Scott Brinker"],
  ["Sean Ellis - Growth hacking and startup scaling", "Sean Ellis"],
  ["Sean Ellis - Growth hacking and product-led growth", "Sean Ellis"],
  ["Stephen Hawking - Theoretical physics and cosmology", "Stephen Hawking"],
  ["Stephen Hawking - Cosmology, black holes, theoretical physics", "Stephen Hawking"],
  ["Sue Hawkes - Leadership development and self-empowerment", "Sue Hawkes"],
  ["Sue Hawkes - Leadership and organizational performance", "Sue Hawkes"],
  ["David Brooks - political commentary, social psychology, and cultural analysis - communication", "David Brooks"],
  ["Emma Leigh Weber - Empathic communication and active listening", "Emma Leigh Weber"],
  ["Emma Leigh Weber \u2013 Empathic communication and active listening", "Emma Leigh Weber"],
  ["Stephen Covey", "Stephen R. Covey"],
  ["Robert Cialdini", "Robert B. Cialdini"],
  ["Geoffrey Moore", "Geoffrey A. Moore"],
  ["Geoffrey A. Moore", "Geoffrey A. Moore"],
  ["Bren\u00e9 Brown", "Brene Brown"],
  ["Steven Hawking", "Stephen Hawking"],
  ["Ashvin Vaidyanathan & Ruben Rabago", "Ashvin Vaidyanathan"],
  ["Chip Heath & Dan Heath", "Chip Heath"],
  ["Dan Heath & Chip Heath", "Chip Heath"],
  ["Jim Collins & Jerry Porras", "Jim Collins"],
  ["Jerry Porras & Jim Collins", "Jim Collins"],
  ["Al Ries & Jack Trout", "Al Ries"],
  ["Jack Trout & Al Ries", "Al Ries"],
  ["Ryan Holiday & Stephen Hanselman", "Ryan Holiday"],
  ["Stephen Hanselman & Ryan Holiday", "Ryan Holiday"],
  ["George Labovitz & Victor Rosansky", "George Labovitz"],
  ["Victor Rosansky & George Labovitz", "George Labovitz"],
  ["Adam Grant - Organizational psychology and workplace motivation", "Adam Grant"],
  ["Alan Weiss - Consulting, business development, and thought leadership", "Alan Weiss"],
  ["Alex Hormozi - Business scaling and offer creation", "Alex Hormozi"],
  ["Andrew Huberman - Neuroscience and human performance", "Andrew Huberman"],
  ["Andy Grove - Technology leadership and strategic management", "Andy Grove"],
  ["Arianna Huffington - Wellness, productivity, and leadership", "Arianna Huffington"],
  ["Ashvin Vaidyanathan - Customer success and SaaS growth", "Ashvin Vaidyanathan"],
  ["Ben Horowitz - Tech entrepreneurship and startup culture", "Ben Horowitz"],
  ["Bob Burg - Networking and relationship-based selling", "Bob Burg"],
  ["Bob Burg - Relationship-based selling and referral marketing", "Bob Burg"],
  ["Brene Brown - Vulnerability, courage, and authentic leadership", "Brene Brown"],
  ["Brian Tracy - Sales performance and personal development", "Brian Tracy"],
  ["Cal Newport - Deep work and digital minimalism", "Cal Newport"],
  ["Carol Dweck - Growth mindset and motivation psychology", "Carol Dweck"],
  ["Chip Heath - Behavioral science and decision-making", "Chip Heath"],
  ["Chris Anderson - TED, ideas, and innovation", "Chris Anderson"],
  ["Chris Voss - Negotiation and high-stakes communication", "Chris Voss"],
  ["Clayton Christensen - Disruptive innovation and business strategy", "Clayton Christensen"],
  ["Damon Zahariades - Productivity and time management", "Damon Zahariades"],
  ["Dan Ariely - Behavioral economics and irrational decision-making", "Dan Ariely"],
  ["Dan Pink - Motivation, sales, and the science of timing", "Dan Pink"],
  ["Daniel Goleman - Emotional intelligence and leadership", "Daniel Goleman"],
  ["Daniel Kahneman - Cognitive biases and decision-making", "Daniel Kahneman"],
  ["David Brooks - Moral philosophy and cultural commentary", "David Brooks"],
  ["David Epstein - Generalism, learning, and athletic performance", "David Epstein"],
  ["David Goggins - Mental toughness and extreme endurance", "David Goggins"],
  ["David Meerman Scott - Marketing strategy and real-time communication", "David Meerman Scott"],
  ["Donald Miller - Storytelling and brand messaging", "Donald Miller"],
  ["Doris Kearns Goodwin - Presidential leadership and American history", "Doris Kearns Goodwin"],
  ["Douglas Stone - Difficult conversations and feedback", "Douglas Stone"],
  ["Ed Catmull - Creative leadership and Pixar culture", "Ed Catmull"],
  ["Eliyahu Goldratt - Theory of Constraints and systems thinking", "Eliyahu Goldratt"],
  ["Eric Ries - Lean startup methodology and entrepreneurship", "Eric Ries"],
  ["Esther Perel - Relationships, desire, and modern love", "Esther Perel"],
  ["Ev Williams - Social media and digital publishing", "Ev Williams"],
  ["Frank Slootman - Enterprise software leadership and scaling", "Frank Slootman"],
  ["Gino Wickman - Entrepreneurial operating system and business traction", "Gino Wickman"],
  ["Gino Wickman - EOS and entrepreneurial leadership", "Gino Wickman"],
  ["Guy Kawasaki - Entrepreneurship, marketing, and evangelism", "Guy Kawasaki"],
  ["Howard Schultz - Brand building and corporate leadership", "Howard Schultz"],
  ["Jack Welch - Corporate leadership and business management", "Jack Welch"],
  ["James Clear - Habit formation and continuous improvement", "James Clear"],
  ["Jason Fried - Remote work and business philosophy", "Jason Fried"],
  ["Jeff Sutherland - Agile methodology and Scrum framework", "Jeff Sutherland"],
  ["Jeff Walker - Product launches and online marketing", "Jeff Walker"],
  ["Jeffrey Gitomer - Sales performance and customer loyalty", "Jeffrey Gitomer"],
  ["Jim Collins - Business excellence and organizational endurance", "Jim Collins"],
  ["Jim Kwik - Memory enhancement and accelerated learning", "Jim Kwik"],
  ["John C. Maxwell - Leadership development and personal growth", "John C. Maxwell"],
  ["John Doerr - Venture capital and OKR goal-setting", "John Doerr"],
  ["John Kotter - Change management and leadership transformation", "John Kotter"],
  ["Jonathan Haidt - Moral psychology and social division", "Jonathan Haidt"],
  ["Jordan Peterson - Psychology, mythology, and personal responsibility", "Jordan Peterson"],
  ["Josh Kaufman - Self-education and business fundamentals", "Josh Kaufman"],
  ["Jocko Willink - Military leadership and extreme ownership", "Jocko Willink"],
  ["Keith Ferrazzi - Networking and relationship-driven leadership", "Keith Ferrazzi"],
  ["Ken Blanchard - Situational leadership and management", "Ken Blanchard"],
  ["Kim Scott - Radical candor and management feedback", "Kim Scott"],
  ["Liz Wiseman - Leadership multipliers and organizational intelligence", "Liz Wiseman"],
  ["Malcolm Gladwell - Social science and cultural storytelling", "Malcolm Gladwell"],
  ["Marcus Aurelius - Stoic philosophy and self-discipline", "Marcus Aurelius"],
  ["Mark Manson - Self-help, personal development, and life philosophy", "Mark Manson"],
  ["Matthew Dixon - Sales methodology and customer loyalty", "Matthew Dixon"],
  ["Mel Robbins - Motivation, confidence, and behavioral change", "Mel Robbins"],
  ["Mel Robbins - Motivational author", "Mel Robbins"],
  ["Michael Bungay Stanier - Coaching and leadership development", "Michael Bungay Stanier"],
  ["Michael Lewis - Financial journalism and narrative nonfiction", "Michael Lewis"],
  ["Mike Michalowicz - Small business growth and entrepreneurship", "Mike Michalowicz"],
  ["Mike Smerkle - Entrepreneurial grit and startup mindset", "Mike Smerkle"],
  ["Morgan Housel - behavioral finance, personal development, and economic psychology", "Morgan Housel"],
  ["Napoleon Hill - Success philosophy and personal achievement", "Napoleon Hill"],
  ["Nassim Nicholas Taleb - Probability, risk, and uncertainty", "Nassim Nicholas Taleb"],
  ["Naval Ravikant - Wealth creation and philosophical thinking", "Naval Ravikant"],
  ["Neil Rackham - Sales methodology and B2B selling", "Neil Rackham"],
  ["Nir Eyal - Habit formation and product design", "Nir Eyal"],
  ["Noah Kagan - Growth hacking and entrepreneurship", "Noah Kagan"],
  ["Noel Tichy - Leadership development and organizational transformation", "Noel Tichy"],
  ["Patrick Lencioni - Team dynamics and organizational health", "Patrick Lencioni"],
  ["Peter Northhouse - leadership theory and organizational behavior", "Peter Northhouse"],
  ["Peter Thiel - Technology entrepreneurship and contrarian thinking", "Peter Thiel"],
  ["Phil Knight - Sports business and entrepreneurship", "Phil Knight"],
  ["Ray Dalio - Investing, macroeconomics, and life principles", "Ray Dalio"],
  ["Ray Kurzweil - Futurism, AI, and human longevity", "Ray Kurzweil"],
  ["Reid Hoffman - Tech Futurist & LinkedIn Co-Founder", "Reid Hoffman"],
  ["Rhea Orion - Consensual nonmonogamy and relationship therapy", "Rhea Orion"],
  ["Richard H. Thaler - Behavioral economics and decision-making psychology", "Richard H. Thaler"],
  ["Richard Koch - Business strategy and the 80/20 principle", "Richard Koch"],
  ["Rob Fitzpatrick - Startup validation and customer conversations", "Rob Fitzpatrick"],
  ["Rob Walling - Bootstrapped SaaS entrepreneurship and mentorship", "Rob Walling"],
  ["Robert B. Cialdini - Behavioral psychology and ethical persuasion", "Robert B. Cialdini"],
  ["Robert Greene - Power, strategy, and human nature", "Robert Greene"],
  ["Robert M Grant - Business Strategy", "Robert M Grant"],
  ["Robin Sharma - Leadership, personal mastery, and life purpose", "Robin Sharma"],
  ["Ryan Holiday - Stoicism and modern philosophy", "Ryan Holiday"],
  ["Sam Walton - Retail entrepreneurship and business building", "Sam Walton"],
  ["Sanjoy Mahajan - Problem Solving and Critical Thinking", "Sanjoy Mahajan"],
  ["Scott Adams - Persuasion, creativity, and systems thinking", "Scott Adams"],
  ["Scott Galloway - business and tech author", "Scott Galloway"],
  ["Seth Godin - Marketing", "Seth Godin"],
  ["Shankar Vedantam - Behavioral science and unconscious bias", "Shankar Vedantam"],
  ["Simon Sinek - Business Leadership", "Simon Sinek"],
  ["Spencer Johnson - Change management and motivational storytelling", "Spencer Johnson"],
  ["Stephen R Poland - Startups", "Stephen R Poland"],
  ["Stephen R. Covey - personal development and leadership", "Stephen R. Covey"],
  ["Steven Bartlett - Entrepreneurship, personal growth, and storytelling", "Steven Bartlett"],
  ["Steven Pressfield - Creative resistance and the artistic life", "Steven Pressfield"],
  ["Susin Nielsen - young adult (YA) fiction, middle-grade fiction, and coming-of-age storytelling", "Susin Nielsen"],
  ["Tali Sharot - Neuroscience of optimism and influence", "Tali Sharot"],
  ["Tim Ferriss - Lifestyle design and performance optimization", "Tim Ferriss"],
  ["Todd Herman - Performance psychology and alter ego strategy", "Todd Herman"],
  ["Tom Yorton - Improv-based leadership and communication expert", "Tom Yorton"],
  ["Tony Robbins - Peak performance and life strategy", "Tony Robbins"],
  ["Uri Levine - Startup disruption and problem-centric innovation", "Uri Levine"],
  ["Vanessa Van Edwards - Behavioral science and charisma", "Vanessa Van Edwards"],
  ["Walter Isaacson - Innovator Biographies & Cultural History", "Walter Isaacson"],
  ["Will Guidara - hospitality and business author", "Will Guidara"],
  ["Yuval Noah Harari - Mcaro-History and Futurism", "Yuval Noah Harari"],
  // Additional entries from full file scan
  ["Itamar Gilad - Product strategy and evidence-guided product management", "Itamar Gilad"],
  ["Itamar Gilad", "Itamar Gilad"],
];

async function main() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  console.log("Connected to DB");

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const [rawName, canonical] of ALIASES) {
    try {
      const [result] = await db.execute(
        "INSERT IGNORE INTO author_aliases (rawName, canonical) VALUES (?, ?)",
        [rawName, canonical]
      );
      if (result.affectedRows > 0) {
        inserted++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`  ERROR for "${rawName}": ${err.message}`);
      errors++;
    }
  }

  await db.end();
  console.log(`\nDone! Inserted: ${inserted}, Skipped (already exists): ${skipped}, Errors: ${errors}`);
  console.log(`Total aliases in DB: ${inserted + skipped}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
