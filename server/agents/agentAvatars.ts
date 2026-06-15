/**
 * agentAvatars.ts — registry of generated agent avatar URLs.
 *
 * Maps an agent key ("book-<id>" | "author-<id>" | "book-writer") to the public
 * S3/R2 URL of its photorealistic avatar. Avatars are generated offline (a batch
 * image-generation job that needs image-gen credentials) and the resulting URLs
 * are recorded here, then committed — the same offline → commit pattern the
 * reindex scripts use. Until an avatar is generated for a key, it is absent and
 * the identity layer reports `avatarUrl: null` (the UI shows a monogram).
 *
 * Keep this a plain data module (no imports) so it stays trivially mergeable and
 * safe to regenerate.
 */
export const AGENT_AVATARS: Record<string, string> = {};
