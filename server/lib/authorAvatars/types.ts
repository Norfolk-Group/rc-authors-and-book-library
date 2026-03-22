/**
 * Types for the Meticulous Author Avatar Pipeline.
 *
 * Pipeline stages:
 *   1. Research (Wikipedia bio + Tavily photo search + Apify Amazon scrape) → raw data
 *   2. Research LLM (Gemini Vision) → AuthorDescription JSON
 *   3. Prompt Builder → ImagePromptPackage
 *   4. Graphics LLM Router (vendor-switchable) → image bytes/URL
 *   5. Storage (S3 + Google Drive + DB)
 */

// ── Author Description ─────────────────────────────────────────────────────────

/**
 * Structured output from the Research LLM stage.
 * Optimized for image generation prompt construction.
 * Cached in DB as authorDescriptionJson to avoid re-research on regeneration.
 */
export interface AuthorDescription {
  /** Core identification */
  authorName: string;

  /** Demographics — critical for accurate likeness */
  demographics: {
    /** Estimated age range for image generation */
    apparentAgeRange: string; // e.g. "early 40s", "mid 50s", "late 60s"
    /** Gender presentation for image generation */
    genderPresentation: "male" | "female" | "non-binary";
    /** Ethnic appearance — be specific for accurate generation */
    ethnicAppearance: string; // e.g. "East Asian", "South Asian", "White European", "African American"
  };

  /** Physical Features — high impact on likeness */
  physicalFeatures: {
    /** Hair description — extremely important */
    hair: {
      color: string;   // "salt-and-pepper", "dark brown", "silver-gray", "bald"
      style: string;   // "swept back", "close-cropped", "curly and full", "receding"
      length: string;  // "short", "medium", "long", "bald", "balding"
    };
    /** Facial hair if any */
    facialHair: {
      type: "none" | "beard" | "goatee" | "stubble" | "mustache" | "full beard";
      color?: string;
      style?: string;  // "neatly trimmed", "full and natural"
    };
    /** Face shape affects overall likeness */
    faceShape: string; // "oval", "round", "square", "heart", "oblong"
    /** Distinctive facial features */
    distinctiveFeatures: string[]; // ["strong jawline", "prominent cheekbones", "dimples"]
    /** Eye description */
    eyes: {
      color: string;
      shape?: string;  // "deep-set", "almond-shaped"
      notable?: string; // "crow's feet", "expressive", "warm"
    };
    /** Skin tone for accurate rendering */
    skinTone: string;  // "fair", "medium", "olive", "tan", "dark brown"
    /** Build/body type visible in headshot */
    build: string;     // "slim", "average", "athletic", "stocky"
    /** Glasses — very distinctive */
    glasses: {
      wears: boolean;
      style?: string;  // "black rectangular frames", "round tortoiseshell", "rimless"
    };
  };

  /** Style & Presentation */
  stylePresentation: {
    /** Typical attire in professional contexts */
    typicalAttire: {
      formality: string; // "very formal", "business formal", "business casual", "smart casual"
      description: string; // "Dark suits with no tie, open collar"
      colors: string[];    // ["navy", "charcoal", "light blue shirts"]
    };
    /** Overall aesthetic/vibe */
    aesthetic: string[]; // ["academic", "tech executive", "approachable", "authoritative"]
  };

  /** Personality Expression — affects expression/pose */
  personalityExpression: {
    /** How they typically present in photos/videos */
    dominantTraits: string[]; // ["warm", "intellectual", "confident", "approachable"]
    /** Typical expression */
    typicalExpression: string; // "genuine smile with slight head tilt"
    /** Energy level */
    energy: string; // "calm", "moderate", "energetic", "intense"
  };

  /** Professional Context */
  professionalContext: {
    /** Primary field — affects styling choices */
    primaryField: string;    // "organizational psychology", "tech entrepreneurship"
    /** Role/position type */
    roleType: string;        // "professor", "CEO", "consultant", "speaker"
    /** Institutions associated with (for styling hints) */
    institutions: string[];  // ["Wharton", "Google", "TED"]
  };

  /** Source Confidence */
  sourceConfidence: {
    /** How many distinct photo sources found */
    photoSourceCount: number;
    /** How consistent were the photos */
    photoConsistency: "high" | "medium" | "low";
    /** Overall confidence in description accuracy */
    overallConfidence: "high" | "medium" | "low";
    /** Notes on any uncertainty */
    uncertainties: string[];
  };

  /** Raw references for debugging/auditing */
  references: {
    photoUrls: string[];    // URLs of reference photos analyzed
    textSources: string[];  // Source names: "Wikipedia", "Amazon Author Page"
  };
}

// ── Image Prompt Package ───────────────────────────────────────────────────────

/**
 * The complete prompt package sent to the graphics LLM.
 */
export interface ImagePromptPackage {
  /** Main positive prompt */
  prompt: string;
  /** Negative prompt (things to avoid) — vendor-specific */
  negativePrompt: string;
  /** Background description derived from bgColor setting */
  backgroundDescription: string;
  /** Which vendor this prompt was optimized for */
  targetVendor: string;
  /** Which model this prompt was optimized for */
  targetModel: string;
}

// ── Image Generator Interfaces ─────────────────────────────────────────────────

export interface ImageGeneratorConfig {
  vendor: "google" | "replicate" | "openai" | "stability";
  model: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  guidanceScale?: number;
}

export interface ImageGenerationResult {
  /** URL to the generated image (for Replicate, OpenAI) */
  imageUrl?: string;
  /** Base64-encoded image bytes (for Google Imagen, Stability) */
  imageBase64?: string;
  mimeType: string;
  vendor: string;
  model: string;
  durationMs: number;
  error?: string;
}

export interface ImageGenerator {
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
  isAvailable(): boolean;
}

// ── Research Input/Output ──────────────────────────────────────────────────────

/**
 * Raw data aggregated from all research sources before LLM analysis.
 */
export interface AuthorResearchData {
  authorName: string;
  /** Bio text from Wikipedia */
  wikiBio?: string;
  /** Photo URLs from Tavily image search */
  tavilyPhotoUrls: string[];
  /** Photo URLs from Apify Amazon/Wikipedia scrape */
  apifyPhotoUrls: string[];
  /** All unique photo URLs (deduplicated, prioritized) */
  allPhotoUrls: string[];
  /** Source names that contributed data */
  sources: string[];
}

// ── Pipeline Options ───────────────────────────────────────────────────────────

export interface MeticulousPipelineOptions {
  /** Background color hex or sentinel key (e.g. "bokeh-gold") */
  bgColor?: string;
  /** Graphics LLM vendor */
  vendor?: string;
  /** Graphics LLM model */
  model?: string;
  /** Research LLM vendor (for description building, e.g. 'google', 'anthropic') */
  researchVendor?: string;
  /** Research LLM model (for description building) */
  researchModel?: string;
  /** If true, use cached AuthorDescription from DB instead of re-researching */
  useCache?: boolean;
  /** If true, skip research and use the cached lastAvatarPrompt directly */
  promptOnly?: boolean;
  /** Force regeneration even if cache is fresh */
  forceRefresh?: boolean;
}

export interface MeticulousPipelineResult {
  success: boolean;
  s3AvatarUrl?: string;
  s3AvatarKey?: string;
  driveFileId?: string;
  avatarSource: "google-imagen" | "ai" | "drive";
  authorDescription?: AuthorDescription;
  imagePrompt?: string;
  vendor?: string;
  model?: string;
  durationMs: number;
  error?: string;
  /** Which stages were executed */
  stages: {
    research: "executed" | "cached" | "skipped" | "failed";
    promptBuild: "executed" | "cached" | "skipped" | "failed";
    imageGen: "executed" | "failed";
    s3Upload: "executed" | "failed" | "skipped";
    driveUpload: "executed" | "failed" | "skipped";
  };
}
