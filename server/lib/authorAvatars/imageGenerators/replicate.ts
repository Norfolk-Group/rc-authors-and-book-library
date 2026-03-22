/**
 * Replicate Image Generator
 *
 * Supports Replicate-hosted models:
 *   - black-forest-labs/flux-schnell  (fast, ~2s, good quality — default)
 *   - black-forest-labs/flux-dev      (slower, higher quality)
 *   - black-forest-labs/flux-pro      (best quality, most expensive)
 *
 * NOTE: The Replicate SDK (>=1.0) returns FileOutput objects.
 * FileOutput.toString() returns the URL string directly.
 */

import Replicate from "replicate";
import {
  ImageGenerator,
  ImageGeneratorConfig,
  ImageGenerationRequest,
  ImageGenerationResult,
} from "../types.js";

export const REPLICATE_MODELS: Record<string, string> = {
  "flux-schnell": "black-forest-labs/flux-schnell",
  "flux-dev": "black-forest-labs/flux-dev",
  "flux-pro": "black-forest-labs/flux-pro",
  // Allow passing full model IDs directly
  "black-forest-labs/flux-schnell": "black-forest-labs/flux-schnell",
  "black-forest-labs/flux-dev": "black-forest-labs/flux-dev",
  "black-forest-labs/flux-pro": "black-forest-labs/flux-pro",
};

export const DEFAULT_REPLICATE_MODEL = "black-forest-labs/flux-schnell";

export class ReplicateGenerator implements ImageGenerator {
  private readonly model: string;

  constructor(config: ImageGeneratorConfig) {
    this.model = REPLICATE_MODELS[config.model] ?? config.model ?? DEFAULT_REPLICATE_MODEL;
  }

  isAvailable(): boolean {
    return !!process.env.REPLICATE_API_TOKEN;
  }

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const startTime = Date.now();
    const auth = process.env.REPLICATE_API_TOKEN;

    if (!auth) {
      return {
        mimeType: "image/webp",
        vendor: "replicate",
        model: this.model,
        durationMs: Date.now() - startTime,
        error: "REPLICATE_API_TOKEN is not set",
      };
    }

    try {
      const client = new Replicate({ auth });
      const output = await client.run(this.model as `${string}/${string}`, {
        input: {
          prompt: request.prompt,
          negative_prompt: request.negativePrompt,
          aspect_ratio: request.aspectRatio ?? "1:1",
          guidance_scale: request.guidanceScale ?? 7.5,
          num_outputs: 1,
          output_format: "webp",
          output_quality: 90,
        },
      });

      // FileOutput.toString() returns the URL
      const imageUrl = Array.isArray(output)
        ? String(output[0])
        : String(output);

      return {
        imageUrl: imageUrl || undefined,
        mimeType: "image/webp",
        vendor: "replicate",
        model: this.model,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        mimeType: "image/webp",
        vendor: "replicate",
        model: this.model,
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
}
