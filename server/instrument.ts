// Sentry server-side instrumentation.
//
// Imported FIRST in server/_core/index.ts so Sentry initializes before Express
// and other modules load (required for auto-instrumentation). No-op unless
// SENTRY_DSN is set, so it's safe to ship before the DSN is configured.
//
// dotenv is loaded here (before reading SENTRY_DSN) so the value is available
// even though this runs ahead of the app's own dotenv import.
import "dotenv/config";
import * as Sentry from "@sentry/node";
import { ENV } from "./_core/env";
import { logger } from "./lib/logger";

const dsn = ENV.sentryDsn;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    // Strip request bodies before any event leaves the server. tRPC inputs to
    // enrichment procedures can contain author bios, book summaries, and raw
    // document text — none of which should be forwarded to Sentry. The Node
    // SDK's RequestDataIntegration attaches the body by default, and
    // sendDefaultPii:false does not suppress it, so we redact it explicitly.
    beforeSend(event) {
      if (event.request) {
        event.request.data = "[redacted]";
        if (event.request.cookies) event.request.cookies = { redacted: "true" };
      }
      return event;
    },
  });
  logger.info("[Sentry] Server error monitoring enabled");
}

export { Sentry };
