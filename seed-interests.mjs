/**
 * seed-interests.mjs
 *
 * Seeds 8 default personal interests for the app owner.
 * Run with: node seed-interests.mjs
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const OWNER_OPEN_ID = process.env.OWNER_OPEN_ID ?? "owner";

const DEFAULT_INTERESTS = [
  {
    topic: "Behavioral Psychology & Change",
    description: "How humans form habits, make decisions, and change behavior — from Kahneman's dual-process theory to Fogg's behavior model.",
    category: "Psychology & Neuroscience",
    weight: "critical",
    color: "#8B5CF6",
    displayOrder: 1,
  },
  {
    topic: "Leadership & Organizational Culture",
    description: "What makes great leaders, how culture shapes performance, and how organizations evolve — from servant leadership to radical candor.",
    category: "Leadership & Management",
    weight: "critical",
    color: "#3B82F6",
    displayOrder: 2,
  },
  {
    topic: "Neuroscience of Learning & Memory",
    description: "How the brain encodes, stores, and retrieves information — neuroplasticity, sleep, stress, and peak cognitive performance.",
    category: "Psychology & Neuroscience",
    weight: "high",
    color: "#EC4899",
    displayOrder: 3,
  },
  {
    topic: "Entrepreneurship & Innovation",
    description: "Building companies from zero to one, disruptive innovation, startup ecosystems, and the psychology of founders.",
    category: "Business Strategy",
    weight: "high",
    color: "#F59E0B",
    displayOrder: 4,
  },
  {
    topic: "Communication & Storytelling",
    description: "The art of persuasion, narrative structure, public speaking, and how stories shape belief and drive action.",
    category: "Communication",
    weight: "high",
    color: "#10B981",
    displayOrder: 5,
  },
  {
    topic: "Emotional Intelligence & Relationships",
    description: "Self-awareness, empathy, social dynamics, and the science of human connection — from Goleman to Brené Brown.",
    category: "Psychology & Neuroscience",
    weight: "medium",
    color: "#EF4444",
    displayOrder: 6,
  },
  {
    topic: "Future of Work & AI",
    description: "How automation, AI, and remote work are reshaping careers, organizations, and the nature of human contribution.",
    category: "Technology & Society",
    weight: "high",
    color: "#06B6D4",
    displayOrder: 7,
  },
  {
    topic: "Philosophy of Success & Meaning",
    description: "What constitutes a well-lived life, the pursuit of meaning over happiness, Stoicism, and long-term thinking.",
    category: "Philosophy & Mindset",
    weight: "medium",
    color: "#84CC16",
    displayOrder: 8,
  },
];

async function seedInterests() {
  const conn = await mysql.createConnection(DATABASE_URL);

  try {
    console.log(`\n🌱 Seeding interests for owner: ${OWNER_OPEN_ID}\n`);

    // Check if interests already exist
    const [existing] = await conn.execute(
      "SELECT COUNT(*) as count FROM user_interests WHERE userId = ?",
      [OWNER_OPEN_ID]
    );
    const existingCount = existing[0].count;

    if (existingCount > 0) {
      console.log(`ℹ️  Found ${existingCount} existing interests — skipping seed to avoid duplicates.`);
      console.log("   Delete existing interests from Admin → My Interests first if you want to re-seed.\n");
      await conn.end();
      return;
    }

    // Insert all 8 interests
    for (const interest of DEFAULT_INTERESTS) {
      await conn.execute(
        `INSERT INTO user_interests 
          (userId, topic, description, category, weight, color, displayOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          OWNER_OPEN_ID,
          interest.topic,
          interest.description,
          interest.category,
          interest.weight,
          interest.color,
          interest.displayOrder,
        ]
      );
      console.log(`  ✅ ${interest.topic} [${interest.weight}]`);
    }

    console.log(`\n✨ Seeded ${DEFAULT_INTERESTS.length} interests successfully!\n`);
    console.log("👉 View them at: Admin → My Interests\n");
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

seedInterests();
