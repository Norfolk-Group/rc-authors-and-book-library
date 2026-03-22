/**
 * Image Generator Factory
 *
 * Creates the appropriate ImageGenerator implementation based on vendor config.
 * This is the single entry point for all image generation — the rest of the
 * pipeline only interacts with the ImageGenerator interface, never with
 * vendor-specific classes directly.
 *
 * Supported vendors:
 *   - google   → Google Imagen / Nano Banana (gemini-2.5-flash-image by default)
 *   - replicate → Replicate flux models (flux-schnell by default)
 *
 * Future vendors (add API keys via webdev_request_secrets):
 *   - openai    → DALL-E 3 (requires OPENAI_API_KEY)
 *   - stability → Stability AI SDXL (requires STABILITY_API_KEY)
 */

import {
  ImageGenerator,
  ImageGeneratorConfig,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "../types.js";
import { GoogleImagenGenerator, DEFAULT_GOOGLE_MODEL, GOOGLE_MODELS } from "./google.js";
import { ReplicateGenerator, DEFAULT_REPLICATE_MODEL, REPLICATE_MODELS } from "./replicate.js";

export { GOOGLE_MODELS, DEFAULT_GOOGLE_MODEL, REPLICATE_MODELS, DEFAULT_REPLICATE_MODEL };

// ── Vendor metadata (for UI display) ──────────────────────────────────────────

export interface VendorInfo {
  vendor: string;
  label: string;
  defaultModel: string;
  models: Array<{ id: string; label: string; description: string }>;
  requiresKey: string | null;
  available: boolean;
}

export function getAvailableVendors(): VendorInfo[] {
  return [
    {
      vendor: "google",
      label: "Google Imagen (Nano Banana)",
      defaultModel: DEFAULT_GOOGLE_MODEL,
      models: [
        {
          id: "gemini-2.5-flash-image",
          label: "Nano Banana (gemini-2.5-flash-image)",
          description: "Fast, high quality — recommended default",
        },
        {
          id: "gemini-3-pro-image-preview",
          label: "Nano Banana Pro (gemini-3-pro-image-preview)",
          description: "Higher quality, slower",
        },
        {
          id: "imagen-3.0-generate-001",
          label: "Imagen 3 (imagen-3.0-generate-001)",
          description: "Dedicated image model, photorealistic",
        },
      ],
      requiresKey: null, // Uses GEMINI_API_KEY already configured
      available: !!process.env.GEMINI_API_KEY,
    },
    {
      vendor: "replicate",
      label: "Replicate (Flux)",
      defaultModel: DEFAULT_REPLICATE_MODEL,
      models: [
        {
          id: "black-forest-labs/flux-schnell",
          label: "Flux Schnell",
          description: "Fast (~2s), good quality, low cost",
        },
        {
          id: "black-forest-labs/flux-dev",
          label: "Flux Dev",
          description: "Higher quality, ~10s",
        },
        {
          id: "black-forest-labs/flux-pro",
          label: "Flux Pro",
          description: "Best quality, highest cost",
        },
      ],
      requiresKey: null, // Uses REPLICATE_API_TOKEN already configured
      available: !!process.env.REPLICATE_API_TOKEN,
    },
  ];
}

// ── Factory ────────────────────────────────────────────────────────────────────

/**
 * Create an ImageGenerator for the given vendor and model.
 * Falls back to Google Imagen if the vendor is unknown or unavailable.
 */
export function createImageGenerator(config: ImageGeneratorConfig): ImageGenerator {
  switch (config.vendor) {
    case "google":
      return new GoogleImagenGenerator(config);
    case "replicate":
      return new ReplicateGenerator(config);
    default:
      console.warn(
        `[imageGenerators] Unknown vendor "${config.vendor}", falling back to google`
      );
      return new GoogleImagenGenerator({ ...config, vendor: "google" });
  }
}

/**
 * Generate an image using the specified vendor/model config.
 * Convenience wrapper around createImageGenerator().generate().
 */
export async function generateImage(
  request: ImageGenerationRequest,
  config: ImageGeneratorConfig
): Promise<ImageGenerationResult> {
  const generator = createImageGenerator(config);

  if (!generator.isAvailable()) {
    return {
      mimeType: "image/png",
      vendor: config.vendor,
      model: config.model,
      durationMs: 0,
      error: `Vendor "${config.vendor}" is not available (API key not configured)`,
    };
  }

  return generator.generate(request);
}

/**
 * Convert an ImageGenerationResult to a Buffer for S3 upload.
 * Handles both base64-encoded bytes (Google/Stability) and URL-based results (Replicate/OpenAI).
 */
export async function resultToBuffer(
  result: ImageGenerationResult
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (result.error) return null;

  if (result.imageBase64) {
    return {
      buffer: Buffer.from(result.imageBase64, "base64"),
      mimeType: result.mimeType,
    };
  }

  if (result.imageUrl) {
    try {
      const res = await fetch(result.imageUrl);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      return {
        buffer: Buffer.from(arrayBuffer),
        mimeType: result.mimeType,
      };
    } catch {
      return null;
    }
  }

  return null;
}
