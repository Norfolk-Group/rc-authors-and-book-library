/**
 * logger.ts — lightweight structured logger for server-side code.
 *
 * In production (NODE_ENV=production), DEBUG-level messages are suppressed.
 * INFO, WARN, and ERROR always emit.
 *
 * Usage:
 *   import { logger } from "../lib/logger";
 *   logger.debug("[Avatar T1]", "Wikipedia found for", authorName);
 *   logger.info("[Mirror]", "Mirrored 12 avatars to S3");
 *   logger.warn("[bookEnrich]", "No Google Books result for", title);
 *   logger.error("[enrichSocial]", "Twitter API error", err);
 */

const isProd = process.env.NODE_ENV === "production";

function fmt(level: string, ...args: unknown[]): void {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console[level as "log"](`[${ts}] [${level.toUpperCase()}]`, ...args);
}

export const logger = {
  /** Verbose per-item progress — suppressed in production */
  debug: (...args: unknown[]) => {
    if (!isProd) fmt("log", ...args);
  },
  /** Operational milestones — always emitted */
  info: (...args: unknown[]) => fmt("info", ...args),
  /** Non-fatal issues — always emitted */
  warn: (...args: unknown[]) => fmt("warn", ...args),
  /** Errors — always emitted */
  error: (...args: unknown[]) => fmt("error", ...args),
};
