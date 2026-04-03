/**
 * Seed sample non-book content items (TED talks, podcasts, papers, articles)
 * for top authors in the library.
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const conn = await createConnection(process.env.DATABASE_URL);

// ── Content items to seed ─────────────────────────────────────────────────
// Format: { contentType, title, subtitle, description, url, authorName, publishedDate, metadataJson }

const items = [
  // ── TED Talks ──────────────────────────────────────────────────────────
  {
    contentType: "ted_talk",
    title: "The surprising habits of original thinkers",
    subtitle: "TED2016",
    description: "How do creative people come up with great ideas? Organizational psychologist Adam Grant studies 'originals': thinkers who dream up new ideas and take action to put them into the world.",
    url: "https://www.ted.com/talks/adam_grant_the_surprising_habits_of_original_thinkers",
    authorName: "Adam Grant",
    publishedDate: "2016-02-16",
    metadataJson: { viewCount: 17000000, duration: "15:26", event: "TED2016", language: "en" },
  },
  {
    contentType: "ted_talk",
    title: "Are you a giver or a taker?",
    subtitle: "TED@IBM",
    description: "In every workplace, there are three basic kinds of people: givers, takers and matchers. Adam Grant breaks down these personalities and offers simple strategies to promote a culture of generosity.",
    url: "https://www.ted.com/talks/adam_grant_are_you_a_giver_or_a_taker",
    authorName: "Adam Grant",
    publishedDate: "2016-11-04",
    metadataJson: { viewCount: 9000000, duration: "13:30", event: "TED@IBM", language: "en" },
  },
  {
    contentType: "ted_talk",
    title: "The power of believing that you can improve",
    subtitle: "TEDxNorrkoping",
    description: "Carol Dweck researches 'growth mindset' — the idea that we can grow our brain's capacity to learn and to solve problems. In this talk, she describes two ways to think about a problem that's slightly too hard for you to solve.",
    url: "https://www.ted.com/talks/carol_dweck_the_power_of_believing_that_you_can_improve",
    authorName: "Carol Dweck",
    publishedDate: "2014-12-17",
    metadataJson: { viewCount: 15000000, duration: "10:23", event: "TEDxNorrkoping", language: "en" },
  },
  {
    contentType: "ted_talk",
    title: "The puzzle of motivation",
    subtitle: "TEDGlobal 2009",
    description: "Career analyst Dan Pink examines the puzzle of motivation, starting with a fact that social scientists know but most managers don't: Traditional rewards aren't always as effective as we think.",
    url: "https://www.ted.com/talks/dan_pink_the_puzzle_of_motivation",
    authorName: "Dan Pink",
    publishedDate: "2009-07-01",
    metadataJson: { viewCount: 40000000, duration: "18:36", event: "TEDGlobal 2009", language: "en" },
  },
  {
    contentType: "ted_talk",
    title: "How great leaders inspire action",
    subtitle: "TEDxPugetSound",
    description: "Simon Sinek has a simple but powerful model for inspirational leadership — starting with a golden circle and the question: 'Why?' His examples include Apple, Martin Luther King Jr. and the Wright Brothers.",
    url: "https://www.ted.com/talks/simon_sinek_how_great_leaders_inspire_action",
    authorName: "Simon Sinek",
    publishedDate: "2010-05-04",
    metadataJson: { viewCount: 74000000, duration: "18:04", event: "TEDxPugetSound", language: "en" },
  },
  {
    contentType: "ted_talk",
    title: "The happy secret to better work",
    subtitle: "TEDxBloomington",
    description: "We believe we should work hard in order to be happy, but could we be thinking about this backwards? In this fast-moving and funny talk, psychologist Shawn Achor argues that happiness inspires us to be more productive.",
    url: "https://www.ted.com/talks/shawn_achor_the_happy_secret_to_better_work",
    authorName: "Shawn Achor",
    publishedDate: "2011-05-01",
    metadataJson: { viewCount: 24000000, duration: "12:20", event: "TEDxBloomington", language: "en" },
  },
  {
    contentType: "ted_talk",
    title: "Your body language may shape who you are",
    subtitle: "TEDGlobal 2012",
    description: "Body language affects how others see us, but it may also change how we see ourselves. Social psychologist Amy Cuddy argues that 'power posing' — standing in a posture of confidence — can affect testosterone and cortisol levels in the brain.",
    url: "https://www.ted.com/talks/amy_cuddy_your_body_language_may_shape_who_you_are",
    authorName: "Amy Cuddy",
    publishedDate: "2012-10-01",
    metadataJson: { viewCount: 68000000, duration: "21:02", event: "TEDGlobal 2012", language: "en" },
  },
  {
    contentType: "ted_talk",
    title: "The skill of self confidence",
    subtitle: "TEDxRyersonU",
    description: "Dr. Ivan Joseph, Athletic Director and head coach of the Ryerson University Soccer team, discusses the skill of self confidence. He believes self confidence is the most important skill one can have.",
    url: "https://www.ted.com/talks/dr_ivan_joseph_the_skill_of_self_confidence",
    authorName: "James Clear",
    publishedDate: "2012-11-01",
    metadataJson: { viewCount: 8000000, duration: "13:10", event: "TEDxRyersonU", language: "en" },
  },

  // ── Podcasts ───────────────────────────────────────────────────────────
  {
    contentType: "podcast",
    title: "WorkLife with Adam Grant: The Science of Making Work Not Suck",
    subtitle: "WorkLife with Adam Grant, Season 1 Ep 1",
    description: "Adam Grant takes you inside the minds of some of the world's most unusual professionals to explore the science of making work not suck. In the premiere episode, Grant explores how to build a culture of givers.",
    url: "https://podcasts.apple.com/us/podcast/worklife-with-adam-grant/id1346314086",
    authorName: "Adam Grant",
    publishedDate: "2018-02-28",
    metadataJson: { platform: "TED / Spotify", episodeNumber: 1, season: 1, duration: "38:00" },
  },
  {
    contentType: "podcast",
    title: "The Tim Ferriss Show: Tools of Titans — Tactics, Routines, and Habits of Billionaires, Icons, and World-Class Performers",
    subtitle: "The Tim Ferriss Show, Ep 100",
    description: "Tim Ferriss interviews world-class performers from eclectic areas (investing, chess, pro sports, etc.) to extract the tactics, tools, and routines you can use. This episode distills lessons from 100 episodes.",
    url: "https://tim.blog/podcast/",
    authorName: "Tim Ferriss",
    publishedDate: "2015-09-01",
    metadataJson: { platform: "Apple Podcasts / Spotify", episodeNumber: 100, duration: "60:00" },
  },
  {
    contentType: "podcast",
    title: "The Knowledge Project: Mental Models for Better Decisions",
    subtitle: "The Knowledge Project with Shane Parrish, Ep 1",
    description: "Shane Parrish interviews world-class thinkers and doers to extract the mental models they use to make better decisions. This episode introduces the concept of the knowledge project.",
    url: "https://fs.blog/knowledge-project-podcast/",
    authorName: "Shane Parrish",
    publishedDate: "2017-01-01",
    metadataJson: { platform: "Apple Podcasts / Spotify", episodeNumber: 1, duration: "45:00" },
  },
  {
    contentType: "podcast",
    title: "Hidden Brain: You 2.0 — How to Become a Better Version of Yourself",
    subtitle: "Hidden Brain, Season 9",
    description: "Shankar Vedantam uses science and storytelling to reveal the unconscious patterns that drive human behavior. This series explores how to become a better version of yourself.",
    url: "https://hiddenbrain.org/",
    authorName: "Daniel Kahneman",
    publishedDate: "2021-08-01",
    metadataJson: { platform: "NPR / Spotify", duration: "30:00" },
  },

  // ── Academic Papers ────────────────────────────────────────────────────
  {
    contentType: "paper",
    title: "Prosocial Motivation at Work: When Does Making a Prosocial Difference Explain Why Employees Work Harder, Smarter, and More Creatively?",
    subtitle: "Journal of Applied Psychology",
    description: "This paper examines when prosocial motivation — the desire to benefit others — leads employees to work harder, smarter, and more creatively. Grant and colleagues find that prosocial motivation amplifies the impact of intrinsic motivation.",
    url: "https://doi.org/10.1037/a0014282",
    authorName: "Adam Grant",
    publishedDate: "2008-01-01",
    metadataJson: { doi: "10.1037/a0014282", journal: "Journal of Applied Psychology", citationCount: 1200, openAccess: false },
  },
  {
    contentType: "paper",
    title: "Implicit Theories of Intelligence Predict Achievement Across an Adolescent Transition: A Longitudinal Study and an Intervention",
    subtitle: "Child Development",
    description: "Carol Dweck and colleagues demonstrate that students who hold an incremental theory of intelligence (growth mindset) show greater academic achievement across the transition to junior high school.",
    url: "https://doi.org/10.1111/j.1467-8624.2007.01064.x",
    authorName: "Carol Dweck",
    publishedDate: "2007-01-01",
    metadataJson: { doi: "10.1111/j.1467-8624.2007.01064.x", journal: "Child Development", citationCount: 3800, openAccess: false },
  },
  {
    contentType: "paper",
    title: "A Theory of Human Motivation",
    subtitle: "Psychological Review",
    description: "Abraham Maslow's foundational paper presenting the hierarchy of needs — the theory that human needs are organized in a hierarchical structure from physiological needs to self-actualization.",
    url: "https://doi.org/10.1037/h0054346",
    authorName: "Daniel Pink",
    publishedDate: "1943-01-01",
    metadataJson: { doi: "10.1037/h0054346", journal: "Psychological Review", citationCount: 65000, openAccess: true },
  },

  // ── Articles / Essays ──────────────────────────────────────────────────
  {
    contentType: "article",
    title: "The Real Meaning of Freedom",
    subtitle: "The Atlantic",
    description: "James Clear explores the paradox of freedom — how constraints and systems can actually create more freedom than unlimited choice, drawing on his research for Atomic Habits.",
    url: "https://jamesclear.com/freedom",
    authorName: "James Clear",
    publishedDate: "2019-03-01",
    metadataJson: { publication: "JamesClear.com", readTime: "8 min" },
  },
  {
    contentType: "article",
    title: "Productivity Is About Your Systems, Not Your Mindset",
    subtitle: "Harvard Business Review",
    description: "Adam Grant argues that productivity is less about motivation and more about designing systems that make it easier to do the right things. Drawing on research in organizational psychology.",
    url: "https://hbr.org/2019/03/productivity-is-about-your-systems-not-your-mindset",
    authorName: "Adam Grant",
    publishedDate: "2019-03-01",
    metadataJson: { publication: "Harvard Business Review", readTime: "6 min" },
  },

  // ── YouTube ────────────────────────────────────────────────────────────
  {
    contentType: "youtube_video",
    title: "The Power of Habit: Charles Duhigg at TEDxTeachersCollege",
    subtitle: "TEDx Talks",
    description: "Charles Duhigg, author of The Power of Habit, explains the science behind habit formation and how understanding the habit loop — cue, routine, reward — can help us change our behavior.",
    url: "https://www.youtube.com/watch?v=OMbsGBlpP30",
    authorName: "Charles Duhigg",
    publishedDate: "2013-03-05",
    metadataJson: { youtubeId: "OMbsGBlpP30", viewCount: 2800000, duration: "17:45", channel: "TEDx Talks" },
  },
  {
    contentType: "youtube_video",
    title: "Simon Sinek: How to Start a Business with Why",
    subtitle: "Simon Sinek Official",
    description: "Simon Sinek explains the concept of 'Start With Why' — how great leaders and companies inspire action by communicating their purpose before their product.",
    url: "https://www.youtube.com/watch?v=IPYeCltXpxw",
    authorName: "Simon Sinek",
    publishedDate: "2014-09-15",
    metadataJson: { youtubeId: "IPYeCltXpxw", viewCount: 5200000, duration: "45:30", channel: "Simon Sinek" },
  },
];

// ── Insert ────────────────────────────────────────────────────────────────

let inserted = 0;
let skipped = 0;
let failed = 0;

for (const item of items) {
  try {
    // Check if already exists by URL
    const [existing] = await conn.query(
      "SELECT id FROM content_items WHERE url = ? LIMIT 1",
      [item.url]
    );
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Insert content item
    const [result] = await conn.query(
      `INSERT INTO content_items (contentType, title, subtitle, description, url, publishedDate, metadataJson, includedInLibrary, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())`,
      [
        item.contentType,
        item.title,
        item.subtitle ?? null,
        item.description ?? null,
        item.url,
        item.publishedDate ?? null,
        JSON.stringify(item.metadataJson ?? {}),
      ]
    );
    const contentItemId = result.insertId;

    // Insert author link
    await conn.query(
      `INSERT INTO author_content_links (authorName, contentItemId, role, displayOrder, createdAt)
       VALUES (?, ?, 'primary', 0, NOW())`,
      [item.authorName, contentItemId]
    );

    inserted++;
    console.log(`✅ [${item.contentType}] "${item.title.slice(0, 60)}" → ${item.authorName}`);
  } catch (err) {
    failed++;
    console.error(`❌ "${item.title.slice(0, 50)}": ${err.message.slice(0, 80)}`);
  }
}

console.log(`\n📊 Summary:`);
console.log(`   Inserted: ${inserted}`);
console.log(`   Skipped (already exists): ${skipped}`);
console.log(`   Failed: ${failed}`);

// Final count by type
const [counts] = await conn.query(
  "SELECT contentType, COUNT(*) as n FROM content_items GROUP BY contentType ORDER BY n DESC"
);
console.log("\n📚 Content items by type:");
counts.forEach(r => console.log(`   ${r.contentType}: ${r.n}`));

await conn.end();
