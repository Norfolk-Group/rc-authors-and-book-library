/**
 * Tier 5: Replicate AI Portrait Generation — last resort, ~$0.003/image
 * Generates a realistic professional headshot when no real photo is found.
 *
 * NOTE: The Replicate SDK (>=1.0) returns FileOutput objects, not plain strings.
 * FileOutput.toString() returns the URL string directly.
 * FileOutput.url() returns a URL object (not a string) — do NOT call .slice() on it.
 */
import Replicate from "replicate";

function getClient() {
  return new Replicate({ auth: process.env.REPLICATE_API_TOKEN ?? "" });
}

const FEMALE_NAMES = new Set([
  "frances", "anne", "emma", "rhea", "karen", "kim", "sue", "arianna",
  "esther", "annie", "april", "alison", "mel", "nixaly", "leil",
]);
const MALE_NAMES = new Set([
  "aaron", "adam", "alex", "andrew", "ben", "cal", "charles", "chris",
  "colin", "dale", "dan", "daniel", "david", "eric", "ezra", "fred",
  "geoffrey", "george", "gino", "hamilton", "hans", "henry", "houston",
  "jack", "james", "jason", "jeb", "jeff", "jefferson", "jim", "john",
  "lawrence", "leander", "malcolm", "marcus", "martin", "matt", "mike",
  "morgan", "peter", "philipp", "ray", "reid", "richard", "rob", "robert",
  "sanjoy", "scott", "sean", "seth", "shankar", "simon", "stephen",
  "steven", "uri", "walter", "will", "yuval", "albert",
]);

function buildPrompt(authorName: string): string {
  const firstName = authorName.split(" ")[0].toLowerCase();
  const gender = FEMALE_NAMES.has(firstName)
    ? "woman"
    : MALE_NAMES.has(firstName)
    ? "man"
    : "person";

  return `Professional corporate headshot photograph of a professional ${gender} business author and thought leader. Warm approachable expression with a slight confident smile. Smart business attire suitable for a book author photo. Clean studio lighting, soft shadows, neutral gray background. High-end corporate portrait photography. Sharp focus on face, shallow depth of field. 85mm portrait lens, f/2.8, professional studio lighting, photorealistic. The portrait looks like it could appear on the back cover of a bestselling business book. No text, watermarks, or logos.`;
}

export interface GeneratedPortrait {
  url: string;
  isAiGenerated: true;
}

/**
 * Extract URL string from a Replicate output item.
 * Handles both legacy string outputs and new FileOutput objects.
 */
function extractUrl(item: unknown): string | null {
  if (!item) return null;
  // Plain string (legacy SDK behaviour)
  if (typeof item === "string") return item;
  // FileOutput: toString() returns the URL string directly
  const str = String(item);
  if (str.startsWith("http")) return str;
  return null;
}

export async function generateAIPortrait(
  authorName: string
): Promise<GeneratedPortrait | null> {
  try {
    const replicate = getClient();
    const prompt = buildPrompt(authorName);

    const output = await replicate.run("black-forest-labs/flux-schnell", {
      input: {
        prompt,
        num_outputs: 1,
        aspect_ratio: "1:1",
        output_format: "webp",
        output_quality: 90,
      },
    });

    // flux-schnell returns an array of FileOutput objects (SDK >=1.0)
    // or plain strings (older SDK). Use extractUrl() to handle both.
    let imageUrl: string | null = null;
    if (Array.isArray(output) && output.length > 0) {
      imageUrl = extractUrl(output[0]);
    } else if (output) {
      imageUrl = extractUrl(output);
    }

    if (!imageUrl) {
      console.error(`[Replicate] No URL extracted from output for ${authorName}`, output);
      return null;
    }
    return { url: imageUrl, isAiGenerated: true };
  } catch (err) {
    console.error(`[Replicate] Portrait generation error for ${authorName}:`, err);
    return null;
  }
}
