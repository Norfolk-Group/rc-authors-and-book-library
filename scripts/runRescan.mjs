/**
 * Standalone Drive rescan script.
 * Runs outside the tRPC auth layer — safe to execute directly in the sandbox.
 * Usage: node --loader tsx/esm scripts/runRescan.mjs
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Bootstrap tsx for TypeScript imports
register("tsx/esm", pathToFileURL("./"));

// Now import the scan logic
const { runRescan } = await import("./rescanImpl.ts");
await runRescan();
