/**
 * anthropicModels.ts
 *
 * Single source of truth for the Claude model IDs used by the *direct*
 * Anthropic SDK calls — the multimodal paths (file classification, author
 * photo/vision research) that intentionally bypass the Forge gateway
 * (`server/_core/llm.ts` → `invokeLLM`) because they pass images/PDFs as
 * base64 input.
 *
 * Text-only LLM work should continue to go through `invokeLLM`, not these.
 */

export const ANTHROPIC_MODELS = {
  /** Smart Upload file classification — needs strong vision + reasoning. */
  fileClassifier: "claude-opus-4-5",
  /** Author photo / appearance vision analysis. */
  authorResearch: "claude-sonnet-4-5-20250929",
} as const;
