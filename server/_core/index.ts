import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerDropboxOAuthRoutes } from "../dropboxOAuthRoutes";
import { registerSmartUploadRoutes } from "../smartUploadRoutes";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startOrchestrator, seedDefaultSchedules } from "../services/enrichmentOrchestrator.service";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

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
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      allowMethodOverride: true,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
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
