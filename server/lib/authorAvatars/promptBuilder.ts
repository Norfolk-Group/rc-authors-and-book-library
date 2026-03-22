/**
 * Prompt Builder — Stage 3 of the Meticulous Avatar Pipeline
 *
 * Converts a structured AuthorDescription into a highly specific image generation
 * prompt optimized for the target graphics LLM vendor.
 *
 * The prompt is structured as:
 *   [Subject core] [Physical features] [Expression] [Attire] [Background] [Quality modifiers]
 *
 * Negative prompts are vendor-specific (Stability/Replicate benefit most; Google/OpenAI
 * have built-in safety filters that make negative prompts less critical).
 */

import { AuthorDescription, ImagePromptPackage } from "./types.js";

// ── Background descriptions ────────────────────────────────────────────────────

const SPECIAL_BACKGROUNDS: Record<string, string> = {
  "bokeh-gold":
    "warm golden bokeh background with soft amber and cream circular light orbs, " +
    "professional studio avatar photography with warm backlighting, " +
    "shallow depth of field, elegant and inviting atmosphere",
  "bokeh-blue":
    "cool blue bokeh background with soft azure circular light orbs, " +
    "professional studio lighting, shallow depth of field",
  "office":
    "blurred modern open-plan office background with soft bokeh, " +
    "natural window light, professional environment",
  "library":
    "blurred bookshelf background with warm amber tones, " +
    "intellectual atmosphere, shallow depth of field",
  "gradient-dark":
    "dark charcoal to near-black gradient background with subtle vignette, " +
    "dramatic professional studio lighting",
  "gradient-light":
    "clean bright white to light gray gradient background, " +
    "airy professional studio photography",
};

function describeColor(hex: string): string {
  const h = hex.replace("#", "").toLowerCase();
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness > 200) return "bright white";
  if (brightness > 150) return "light neutral grey";
  if (r > g && r > b) return brightness < 80 ? "deep burgundy" : "warm red";
  if (g > r && g > b) return brightness < 80 ? "deep forest green" : "sage green";
  if (b > r && b > g) return brightness < 80 ? "deep navy blue" : "cool blue";
  if (r > 100 && g > 80 && b < 80) return "warm amber";
  if (r < 60 && g < 60 && b < 60) return "near-black charcoal";
  return "neutral dark";
}

function getBackgroundDescription(bgColor?: string): string {
  // Default to canonical bokeh-gold background for consistency across all avatars
  if (!bgColor) return SPECIAL_BACKGROUNDS["bokeh-gold"];
  const key = bgColor.toLowerCase();
  if (SPECIAL_BACKGROUNDS[key]) return SPECIAL_BACKGROUNDS[key];
  if (key.startsWith("#") && key.length === 7) {
    return `solid ${describeColor(bgColor)} background, professional studio lighting`;
  }
  return "neutral gray gradient background, professional studio lighting";
}

// ── Negative prompts ───────────────────────────────────────────────────────────

const COMMON_NEGATIVE = [
  "cartoon", "anime", "illustration", "painting", "drawing", "sketch",
  "distorted", "deformed", "disfigured", "bad anatomy", "extra limbs",
  "blurry", "out of focus", "low resolution", "pixelated", "jpeg artifacts",
  "watermark", "signature", "text", "logo", "caption",
  "multiple people", "group shot", "crowd", "two faces",
  "full body", "hands visible", "fingers",
  "ugly", "scary", "creepy", "uncanny valley",
  "oversaturated", "overexposed", "underexposed",
];

const VENDOR_NEGATIVE_ADDITIONS: Record<string, string[]> = {
  stability: ["nsfw", "nude", "naked", "explicit"],
  replicate: ["bad lighting", "harsh shadows", "flat lighting"],
  openai: [], // DALL-E 3 has built-in safety
  google: [], // Imagen has built-in safety
};

function buildNegativePrompt(vendor: string): string {
  const additions = VENDOR_NEGATIVE_ADDITIONS[vendor] ?? [];
  return [...COMMON_NEGATIVE, ...additions].join(", ");
}

// ── Main prompt builder ────────────────────────────────────────────────────────

/**
 * Build a meticulous image generation prompt from a structured AuthorDescription.
 * The prompt is specific to the author's actual appearance, not generic.
 */
export function buildMeticulousPrompt(
  desc: AuthorDescription,
  options: {
    bgColor?: string;
    vendor?: string;
    model?: string;
  } = {}
): ImagePromptPackage {
  const vendor = options.vendor ?? "google";
  const model = options.model ?? "gemini-2.5-flash-image";
  const bgDescription = getBackgroundDescription(options.bgColor);

  const d = desc;
  const pf = d.physicalFeatures;

  // Subject core
  const subjectCore = [
    "Professional corporate headshot avatar of",
    `a ${d.demographics.genderPresentation}`,
    `in ${d.demographics.apparentAgeRange}`,
    `with ${d.demographics.ethnicAppearance} appearance`,
  ].join(" ");

  // Hair description
  const hairDesc = [
    pf.hair.color,
    pf.hair.style,
    pf.hair.length !== "bald" ? `${pf.hair.length}-length hair` : "hair",
  ]
    .filter(Boolean)
    .join(", ");

  // Facial hair
  const facialHairDesc =
    pf.facialHair.type === "none"
      ? "clean-shaven"
      : [
          pf.facialHair.style ?? "",
          pf.facialHair.color ? `${pf.facialHair.color} ` : "",
          pf.facialHair.type,
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

  // Eyes and distinctive features
  const eyeDesc = [
    pf.eyes.color,
    pf.eyes.shape ?? "",
    pf.eyes.notable ?? "",
  ]
    .filter(Boolean)
    .join(", ");

  const distinctiveDesc =
    pf.distinctiveFeatures.length > 0
      ? pf.distinctiveFeatures.slice(0, 3).join(", ")
      : "";

  // Glasses
  const glassesDesc = pf.glasses.wears
    ? `wearing ${pf.glasses.style ?? "glasses"}`
    : "";

  // Expression and personality
  const expressionDesc = d.personalityExpression.typicalExpression;

  // Attire
  const attireDesc = [
    d.stylePresentation.typicalAttire.description,
    d.stylePresentation.typicalAttire.colors.length > 0
      ? `(${d.stylePresentation.typicalAttire.colors.slice(0, 2).join(", ")} tones)`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Professional context hint
  const professionalHint = `${d.professionalContext.roleType} in ${d.professionalContext.primaryField}`;

  // Assemble the full prompt
  const promptParts = [
    `${subjectCore}.`,
    `${hairDesc}, ${facialHairDesc}.`,
    `${pf.faceShape} face shape, ${eyeDesc} eyes.`,
    distinctiveDesc ? `Distinctive features: ${distinctiveDesc}.` : "",
    glassesDesc ? `${glassesDesc}.` : "",
    `Expression: ${expressionDesc}.`,
    `Wearing ${attireDesc}.`,
    `Professional ${professionalHint}.`,
    `${bgDescription}.`,
    "Professional studio lighting, soft key light, subtle fill, shallow depth of field.",
    "85mm portrait lens equivalent, f/2.8, photorealistic, high resolution.",
    "Corporate professional photography style. No text, watermarks, or logos.",
    "The avatar looks like it could appear on the back cover of a bestselling business book.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    prompt: promptParts,
    negativePrompt: buildNegativePrompt(vendor),
    backgroundDescription: bgDescription,
    targetVendor: vendor,
    targetModel: model,
  };
}

/**
 * Fallback generic prompt when no AuthorDescription is available.
 * Matches the existing behavior of the legacy buildPrompt() functions.
 */
export function buildGenericFallbackPrompt(
  authorName: string,
  bgColor?: string,
  vendor = "google"
): ImagePromptPackage {
  const bgDescription = getBackgroundDescription(bgColor);
  const firstName = authorName.split(" ")[0].toLowerCase();
  const FEMALE_NAMES = new Set([
    "frances", "anne", "emma", "rhea", "karen", "kim", "sue", "arianna",
    "esther", "annie", "april", "alison", "mel", "nixaly", "leil",
  ]);
  const gender = FEMALE_NAMES.has(firstName) ? "woman" : "person";

  const prompt = [
    `Professional corporate headshot avatar of a professional ${gender} business author and thought leader.`,
    "Warm approachable expression with a slight confident smile.",
    "Smart business attire suitable for a book author avatar.",
    `Clean studio lighting, soft shadows, ${bgDescription}.`,
    "High-end corporate avatar photography.",
    "Sharp focus on face, shallow depth of field.",
    "85mm portrait lens, f/2.8, professional studio lighting, photorealistic.",
    "The avatar looks like it could appear on the back cover of a bestselling business book.",
    "No text, watermarks, or logos.",
  ].join(" ");

  return {
    prompt,
    negativePrompt: buildNegativePrompt(vendor),
    backgroundDescription: bgDescription,
    targetVendor: vendor,
    targetModel: vendor === "google" ? "gemini-2.5-flash-image" : "flux-schnell",
  };
}
