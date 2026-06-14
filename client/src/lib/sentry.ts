import * as Sentry from "@sentry/react";

/**
 * Initialize Sentry browser error monitoring. No-op unless VITE_SENTRY_DSN is
 * set at build time, so it's safe to ship before the DSN is configured.
 * Call once, before the app renders.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration()],
    sendDefaultPii: false,
  });
}
