/**
 * run-enrich-rich-bios.mjs
 * Directly calls the enrichRichBio helper for all authors missing richBioJson.
 * Runs sequentially with a 1.2s delay to avoid rate limits.
 */
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

// We need to use tsx to run TypeScript files — invoke via child_process
import { execSync } from "child_process";

const result = execSync(
  "npx tsx scripts/enrich-rich-bios.ts",
  { cwd: path.join(__dirname, ".."), stdio: "inherit", timeout: 3600000 }
);
