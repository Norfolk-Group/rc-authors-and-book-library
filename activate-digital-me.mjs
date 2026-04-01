/**
 * activate-digital-me.mjs
 *
 * Activates Digital Me (RAG generation) for a specified author.
 * Uses the Anthropic Claude Opus API directly to synthesize the persona file.
 *
 * Usage:
 *   node activate-digital-me.mjs "Adam Grant"
 *   node activate-digital-me.mjs "Simon Sinek"
 */

import "dotenv/config";
import mysql from "mysql2/promise";
import Anthropic from "@anthropic-ai/sdk";

const AUTHOR_NAME = process.argv[2] ?? "Adam Grant";
const MODEL = "claude-opus-4-5";

const DATABASE_URL = process.env.DATABASE_URL;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!DATABASE_URL) { console.error("❌ DATABASE_URL not set"); process.exit(1); }
if (!ANTHROPIC_API_KEY) { console.error("❌ ANTHROPIC_API_KEY not set"); process.exit(1); }

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ── Helpers ────────────────────────────────────────────────────────────────────

async function invokeClaude(systemPrompt, userPrompt) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [
      { role: "user", content: userPrompt }
    ],
    system: systemPrompt,
  });
  return response.content[0]?.type === "text" ? response.content[0].text : "";
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  try {
    console.log(`\n🧠 Digital Me Activation: "${AUTHOR_NAME}"\n`);
    console.log(`   Model: ${MODEL}`);
    console.log(`   Time: ${new Date().toISOString()}\n`);

    // 1. Fetch author profile
    const [authorRows] = await conn.execute(
      `SELECT * FROM author_profiles WHERE authorName = ? LIMIT 1`,
      [AUTHOR_NAME]
    );
    if (!authorRows.length) {
      console.error(`❌ Author "${AUTHOR_NAME}" not found in database`);
      process.exit(1);
    }
    const author = authorRows[0];
    console.log(`✅ Found author: ${author.authorName}`);
    console.log(`   Category: ${author.category ?? "N/A"}`);
    console.log(`   Bio: ${(author.bio ?? "").substring(0, 100)}...`);

    // 2. Fetch books
    const [bookRows] = await conn.execute(
      `SELECT bookTitle, summary, keyThemes, amazonUrl FROM book_profiles WHERE authorName = ? LIMIT 20`,
      [AUTHOR_NAME]
    );
    console.log(`\n📚 Found ${bookRows.length} books`);

    // 3. Fetch contextual intelligence if available
    const [contextRows] = await conn.execute(
      `SELECT * FROM author_contextual_intelligence WHERE authorName = ? LIMIT 1`,
      [AUTHOR_NAME]
    ).catch(() => [[]]);
    const context = contextRows[0] ?? null;

    // 4. Check for existing RAG profile
    const [existingRag] = await conn.execute(
      `SELECT ragStatus, ragVersion FROM author_rag_profiles WHERE authorName = ? LIMIT 1`,
      [AUTHOR_NAME]
    );

    if (existingRag[0]?.ragStatus === "generating") {
      console.log(`\n⚠️  RAG generation already in progress for "${AUTHOR_NAME}". Use --force to override.`);
      if (!process.argv.includes("--force")) {
        await conn.end();
        return;
      }
    }

    const currentVersion = existingRag[0]?.ragVersion ?? 0;
    const nextVersion = currentVersion + 1;

    // 5. Mark as generating
    await conn.execute(
      `INSERT INTO author_rag_profiles (authorName, ragStatus, ragVersion, contentItemCount, createdAt, updatedAt)
       VALUES (?, 'generating', ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE ragStatus='generating', ragVersion=?, updatedAt=NOW()`,
      [AUTHOR_NAME, nextVersion, bookRows.length, nextVersion]
    );
    console.log(`\n⚙️  Status: generating (v${nextVersion})`);

    // 6. Extract insights from each book
    const bookInsights = [];
    for (const book of bookRows) {
      process.stdout.write(`   📖 Extracting insights from "${book.bookTitle}"...`);
      const insight = await invokeClaude(
        `You are an expert literary analyst specializing in non-fiction thought leadership books.
Extract the core intellectual contribution of this book for building an author persona.`,
        `Book: "${book.bookTitle}" by ${AUTHOR_NAME}
Summary: ${book.summary ?? "N/A"}
Key Themes: ${book.keyThemes ?? "N/A"}

Extract:
1. Core thesis (2-3 sentences)
2. Key frameworks or models introduced
3. Signature phrases or concepts the author coined
4. How this book fits the author's overall intellectual arc`
      );
      bookInsights.push({ title: book.bookTitle, insight });
      process.stdout.write(" ✅\n");
    }

    // 7. Build the comprehensive RAG persona file
    console.log(`\n🔮 Synthesizing Digital Me persona with Claude Opus...`);

    const booksSection = bookInsights.map(b =>
      `### ${b.title}\n${b.insight}`
    ).join("\n\n");

    const contextSection = context ? `
## Geographical & Historical Context
- **Birthplace / Origin:** ${context.birthplace ?? "N/A"}
- **Formative Cities:** ${context.formativeCities ?? "N/A"}
- **Cultural Region:** ${context.culturalRegion ?? "N/A"}
- **Historical Era:** ${context.historicalEraContext ?? "N/A"}

## Family & Upbringing
${context.familyBackground ?? "N/A"}

## Key Associations & Affiliations
${context.keyAssociations ?? "N/A"}

## Intellectual Mentors & Influences
${context.intellectualMentors ?? "N/A"}

## Formative Experiences
${context.formativeExperiences ?? "N/A"}
` : "";

    const ragContent = await invokeClaude(
      `You are building a comprehensive Digital Me persona knowledge file for ${AUTHOR_NAME}.
This file will be used as a system prompt to power an AI chatbot that impersonates ${AUTHOR_NAME}.
The chatbot must be able to answer questions, share opinions, and engage in conversation exactly as ${AUTHOR_NAME} would.
Be comprehensive, specific, and capture the author's authentic voice, worldview, and intellectual identity.`,
      `Create a complete Digital Me persona file for ${AUTHOR_NAME}.

## Author Profile
- **Name:** ${AUTHOR_NAME}
- **Category:** ${author.category ?? "N/A"}
- **Bio:** ${author.bio ?? "N/A"}
- **Nationality:** ${author.nationality ?? "N/A"}
- **Birth Year:** ${author.birthYear ?? "N/A"}
- **Education:** ${author.education ?? "N/A"}
- **Current Role:** ${author.currentRole ?? "N/A"}
- **Website:** ${author.website ?? "N/A"}
- **Known For:** ${author.knownFor ?? "N/A"}

${contextSection}

## Books & Intellectual Contributions
${booksSection}

---

Now synthesize all of this into a comprehensive Digital Me persona file with these sections:

# Digital Me: ${AUTHOR_NAME}

## Identity & Voice
[Who am I? How do I speak? What is my communication style? First person, present tense.]

## Core Beliefs & Worldview
[My fundamental beliefs about human nature, work, society, and knowledge]

## Intellectual Signature
[The ideas, frameworks, and concepts most closely associated with me]

## How I Think
[My reasoning style, how I approach problems, my intellectual method]

## What I Care About Most
[My causes, passions, and the questions that drive my work]

## My Relationship with My Audience
[How I see the people I write for and speak to]

## Signature Phrases & Language
[Phrases, metaphors, and language patterns I use frequently]

## What I Would Say About...
[5-7 key topics in my domain — give my authentic perspective on each]

## What I Would NOT Say
[Common misconceptions about my views, things attributed to me that I'd push back on]

## Conversation Style
[How I engage in dialogue, how I handle disagreement, my humor and warmth]`
    );

    // 8. Store the RAG file
    const wordCount = ragContent.split(/\s+/).length;
    const s3Key = `digital-me/${AUTHOR_NAME.replace(/\s+/g, "-").toLowerCase()}/v${nextVersion}.md`;

    // Store in DB (as text, since we may not have S3 configured in script context)
    await conn.execute(
      `UPDATE author_rag_profiles 
       SET ragStatus='ready', ragFileKey=?, ragFileUrl=?, ragWordCount=?, 
           contentItemCount=?, ragGeneratedAt=NOW(), updatedAt=NOW()
       WHERE authorName=?`,
      [s3Key, `data:text/markdown;base64,${Buffer.from(ragContent).toString("base64").substring(0, 500)}...`, wordCount, bookRows.length, AUTHOR_NAME]
    );

    // Also save the full RAG content to a local file for review
    const outputPath = `/home/ubuntu/authors-books-library/digital-me-${AUTHOR_NAME.replace(/\s+/g, "-").toLowerCase()}.md`;
    const { writeFileSync } = await import("fs");
    writeFileSync(outputPath, ragContent, "utf-8");

    console.log(`\n✨ Digital Me generated successfully!`);
    console.log(`   Words: ${wordCount.toLocaleString()}`);
    console.log(`   Version: v${nextVersion}`);
    console.log(`   Saved to: ${outputPath}`);
    console.log(`\n👉 Chat with ${AUTHOR_NAME} at: /chat/${AUTHOR_NAME.replace(/\s+/g, "-").toLowerCase()}\n`);

  } catch (err) {
    console.error("\n❌ Digital Me generation failed:", err.message);
    // Mark as failed
    await conn.execute(
      `UPDATE author_rag_profiles SET ragStatus='failed', updatedAt=NOW() WHERE authorName=?`,
      [AUTHOR_NAME]
    ).catch(() => {});
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
