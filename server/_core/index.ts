// Sentry must initialize before anything else loads (no-op unless SENTRY_DSN set).
import "../instrument";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import * as Sentry from "@sentry/node";
import { ENV } from "./env";
import { registerOAuthRoutes } from "./oauth";
import { registerDropboxOAuthRoutes } from "../dropboxOAuthRoutes";
import { registerSmartUploadRoutes } from "../smartUploadRoutes";
import { registerImportRoutes } from "../importRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startOrchestrator, seedDefaultSchedules } from "../services/enrichmentOrchestrator.service";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Dropbox OAuth 2 flow: /api/dropbox/connect, /api/dropbox/callback, /api/dropbox/status
  registerDropboxOAuthRoutes(app);
  // Smart Upload: POST /api/upload/smart
  registerSmartUploadRoutes(app);
  // Library Import: POST /api/import/check | /upload | /finalize (bulk R2 import)
  registerImportRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      allowMethodOverride: true,
    })
  );
  // Sentry error handler — after the API routes, before the static/SPA fallback.
  // Captures errors thrown by the routes above. No-op unless SENTRY_DSN is set.
  if (ENV.sentryDsn) {
    Sentry.setupExpressErrorHandler(app);
  }

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Bind directly to the platform-assigned port. Managed hosts (Railway, etc.)
  // pre-allocate $PORT and route traffic only there, so probing for an
  // "available" port can bump us off it and cause 502s. Omitting the host binds
  // 0.0.0.0 (all interfaces), which is what the platform proxy needs.
  const port = parseInt(process.env.PORT || "3000", 10);
  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  // Seed default pipeline schedules (idempotent — skips existing rows)
  seedDefaultSchedules().catch((err: Error) =>
    console.warn("[Orchestrator] Schedule seed failed:", err)
  );

  // Start the autonomous enrichment background engine
  // Pipelines are OFF by default — admin must enable each one in the Intelligence Dashboard
  startOrchestrator();
}

startServer().catch(console.error);
