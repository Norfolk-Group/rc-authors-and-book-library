# Agent Mishaps — RC Authors & Books Library

**Read this skill at the start of every session before making any changes.**

This skill documents every instance where the AI agent made mistakes, added unapproved
tasks, forgot to implement things, or failed to execute user instructions. It exists to
prevent the same mistakes from being repeated.

---

## Rule 0: Do Not Trust Previous "Done" Claims

Before marking any task complete, verify it yourself. The agent has a history of:
- Marking parent tasks `[x]` while leaving sub-tasks `[ ]`
- Claiming features are "wired" when they only have placeholder toasts
- Saying "TypeScript: 0 errors" without running `npx tsc --noEmit`

---

## Self-Imposed Tasks Added Without User Approval

The following were **added to `todo.md` by the agent without user request**:

### Built Without Approval (Still in Codebase)
- **`client/src/components/FloatingBooks.tsx`** — Three.js 3D floating book shapes. Agent
  installed `@react-three/fiber` + `@react-three/drei` and wired it into `Home.tsx`. User
  never asked for this. The packages add ~800KB to the bundle.
- **`AcademicResearchPanel.tsx` + `academicResearchJson` DB column** — Full academic
  research panel using OpenAlex/Semantic Scholar. Added `academicResearchJson` column to
  `author_profiles` table. User never explicitly requested this.
- **CNBC RapidAPI scraper** — Built a full CNBC franchise feed scraper in
  `server/enrichment/rapidapi.ts` without confirming the user had a paid RapidAPI
  subscription. The endpoint requires a paid plan and has **never worked** (always 403).
  The `businessProfileJson` column is always null. CNBC badges always show 0.

### Recommended and Added to Todo Without Approval (Never Built)
In one session (Mar 25, 2026), after a connector audit, the agent added **57 new todo
items** without user approval. Most were never implemented:
- Quartr earnings call transcripts
- Apollo.io professional profiles
- Notion bidirectional reading notes sync
- Context7 technical book references
- Curated Reading Paths (guided learning sequences)

### Built Then Cancelled (Removed from Codebase)
- **Seeking Alpha** — Built enrichment, user cancelled, removed.
- **SimilarWeb** — Agent recommended and started integration, user cancelled, rolled back.

---

## Forgotten Tasks — Marked Done But Weren't

| Item | What Was Claimed | Reality |
|---|---|---|
| **Substack tab** | `[x]` "Add Substack tab to AuthorDetail" | `SubstackPostsPanel` is wired, but 3 sub-tasks remain `[ ]`: procedure use, post display, empty state |
| **AI Search Status Indicator** | `[x]` "Add AI Search indicator to sidebar" | Shows static text. 3 sub-tasks remain `[ ]`: green/grey dot, link to Admin, nudge when empty |
| **Backup toast with file counts** | `[x]` in one session | Backup mutations return stats, but the UI toast was never implemented. Re-opened as `[ ]` |
| **Admin infotips on tab content** | `[x]` for nav items | Only 24 nav item infotips done. Tab content infotips (buttons, stat cards) never done |
| **Populate vector index** | Listed as done in migration notes | Magazine feeds table is empty; the Pinecone-era todo item was never updated for Neon |

---

## Coding Failures That Required Multiple Retries

### Neon Migration (Apr 18, 2026) — 6 Failed Attempts Before Success

1. **Wrong embedding model** — Used `text-embedding-004` → 404 error. Correct model:
   `gemini-embedding-001` with `outputDimensionality: 1536`.

2. **tsx OOM** — Three tsx-based indexing scripts all crashed before processing a single
   record. The tsx + Neon driver + Drizzle stack consumes ~2GB just to start. Solution:
   pure Node.js `.cjs` scripts using `pg` + Gemini REST API directly.

3. **`@neondatabase/serverless` OOM in vitest** — The driver is too large for vitest
   workers. Required 4 attempts before settling on mocked unit tests.

4. **JWT auth from shell** — Cannot generate valid admin JWT tokens from shell because the
   server's `JWT_SECRET` is injected by the Manus platform and differs from the shell env.
   Do not attempt this. Use direct DB + REST API scripts instead.

5. **Stale `-chunk0` IDs** — First tsx run created `author-{id}-chunk0` IDs. Second pg run
   created `author-{id}` IDs. Both coexisted. Required manual cleanup of 159 duplicates.

6. **`ON CONFLICT` clause wrong** — Used `ON CONFLICT (id, namespace)` but the table has
   no composite unique constraint. Fix: `ON CONFLICT (id)`.

### Drizzle `pnpm db:push` Interactive Prompt
`pnpm db:push` hangs waiting for interactive input when renaming columns (rename vs.
create new). Agent killed the process 3 times. Use `--force` flag or answer the prompt
interactively.

### Vite 7 Upgrade (Rolled Back)
Agent upgraded Vite 6 → 7. Deployment failed: Node.js 20.15.1 in deployment env is below
Vite 7's minimum of 20.19+. **Do not upgrade Vite past 6.x.**

### flowbite-react `0.12.17` Upgrade (Rolled Back)
Agent upgraded to `0.12.17`. Deployment failed: `oxc-parser` has native bindings that
fail in deployment. **Pin flowbite-react to `0.12.16`.**

### CLAUDE.md Loaded Wrong File (Multiple Sessions)
Agent loaded `claude.md` (lowercase, stale) instead of `CLAUDE.md` (uppercase, canonical).
Both files coexisted for weeks. **`claude.md` has been deleted. `CLAUDE.md` is canonical.**

### Stack Confusion (Early Sessions)
Agent confused MySQL/TiDB/Drizzle stack with Postgres/Prisma (Manus template default).
Caused failed `db:push` commands and wrong schema syntax. **This project uses MySQL/TiDB
with Drizzle ORM. Never use Prisma syntax.**

### Google Drive Removal (Mar 2026)
Agent built extensive `gws`/`rclone` Google Drive integration. User switched to Dropbox.
Agent continued referencing Google Drive in docs for 2+ weeks after removal. **Google
Drive is permanently removed. Never add `gws` or `rclone` calls.**

---

## Tasks Explicitly Requested But Never Executed

These were **user-requested** and remain incomplete:

| Task | Status |
|---|---|
| Delete 6 stale Pinecone files | ✅ Done Apr 19, 2026 — all deleted |
| Rewrite `verify-pinecone-coverage.mjs` → `verify-neon-coverage.mjs` | ✅ Done Apr 19, 2026 — full coverage report with flags |
| Implement "Refresh All Data" in `AuthorCardActions.tsx` | ✅ Done Apr 19, 2026 — runs bio → links → avatar sequentially |
| Complete Re-index All button with live progress in Admin | ✅ Done Apr 19, 2026 — AdminNeonTab.tsx with live progress |
| Build Dropbox inbox ingestion pipeline | ✅ Done — `dropboxIngest.service.ts` fully wired |
| S3 migration audit (external URLs → s3AvatarUrl) | ✅ Done — `AdminS3AuditTab.tsx` + `s3Audit.router.ts` |
| Commit and push to GitHub | ✅ Done — all changes pushed |
| `authorAliases.ts` and `authorAvatars.ts` deletion | ⚠️ Still active — both files are still imported in 10+ places; cannot delete without refactor |
| Set `VITE_APP_LOGO` in Management UI | ⚠️ Manual step — must be done by user in Settings panel |
| Run Substack post count enrichment | ⚠️ Still pending — 40 authors have substackUrl but post counts are 0 |

---

## How to Use This Skill

At the start of a session, read this file and:
1. Check if the user's request relates to any item in "Tasks Explicitly Requested But Never Executed" — if so, complete it first.
2. Do not add new items to `todo.md` without explicit user approval.
3. Do not mark tasks `[x]` until you have verified the implementation works end-to-end.
4. When a coding approach fails twice, stop and try a fundamentally different approach.
5. After any migration or major change, run `npx tsc --noEmit` and verify the test count.
### JWT_SECRET Startup Crash (Apr 19, 2026)
Added a startup validation that required JWT_SECRET to be 32+ characters. The platform-managed
JWT_SECRET is only 22 characters. This crashed the production deployment.
**Fix:** Changed the validation to  instead of . Never add hard 
validations on platform-managed secrets — they are injected by Manus and cannot be changed.

### OOM Build Failure — Exit Code 137 (Apr 19, 2026)
Production Vite build was killed by OOM (exit code 137) because the entire bundle was processed
in one pass. The three.js + framer-motion + recharts + flowbite stack is too large for the
deployment build environment.
**Fix:** Added  to  splitting vendor libs into separate chunks,
and lazy-loaded , , and  (the three.js component).
**Rule:** Always lazy-load heavy pages and 3D/animation libraries. Never let three.js be in the
main bundle.

---

## Railway Migration Failures (Jun 2026)

### "Cannot find package 'vite'" Boot Crash
Railway's Nixpacks build runner prunes `devDependencies` before starting the server. The server
bundle (`esbuild --packages=external`) statically imports vite-related packages at load time.
They were in `devDependencies` — not present at runtime — causing an immediate crash.
**Fix:** Moved `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-plugin-manus-runtime`,
`@builder.io/vite-plugin-jsx-loc` from `devDependencies` to `dependencies`. Also updated the
Dockerfile runtime stage to copy full `node_modules` from the builder (not `--prod` install).
**Rule:** Any package that the server process imports at runtime must be in `dependencies`.

### 502 Bad Gateway — findAvailablePort() Race
The original `server/_core/index.ts` called `findAvailablePort()` to probe for a free port.
Railway pre-allocates `$PORT` before the process starts. The port probe bumped the server off
that port, causing Railway's proxy to get no response → 502.
**Fix:** Removed `findAvailablePort()` entirely. Bind directly: `server.listen(parseInt(process.env.PORT || "3000", 10))`.
**Rule:** Never use findAvailablePort() or similar probing on Railway. Bind directly to `$PORT`.

### TiDB Data Not Loading (Silent TLS Failure)
The Drizzle setup used `drizzle(process.env.DATABASE_URL)` with the default mysql2 pool.
mysql2 with a bare URI string leaves SSL off. TiDB Cloud Serverless requires TLS — the
connection appeared to succeed but returned no data.
**Fix:** Use an explicit `mysql.createPool({ uri, ssl: { minVersion: "TLSv1.2" } })`.

### Blank Screen #1 — Invalid URL on Login Page
`getLoginUrl()` was called eagerly as a default argument in `useAuth`. When `VITE_OAUTH_PORTAL_URL`
is absent (Railway deployment, no Manus OAuth), the function called `new URL("undefined/app-auth")`
which threw "Invalid URL" and crashed the entire React app.
**Fix:** Added early return `if (!oauthPortalUrl || !appId) return "/"` to `client/src/const.ts`.

### Blank Screen #2 — manualChunks Circular Chunk Dependencies
In production builds, `vite.config.ts` had `manualChunks` grouping vendor libs into
`vendor-react`, `vendor-misc`, `vendor-radix`. This created mutual circular dependencies between
chunks. The `vendor-radix` chunk tried to initialize while `vendor-react` wasn't yet resolved,
leaving `React.forwardRef` undefined. Console: "Cannot read properties of undefined (reading 'forwardRef')".
**Fix:** Removed `manualChunks` entirely. Rollup's automatic chunking has 0 mutual cycles.
**Rule:** Never add manualChunks to this project's vite.config.ts.

### R2 Orphan-Object Bug
`isR2Configured()` checked only 4 of the 5 R2 env vars — it omitted `R2_PUBLIC_URL`. An
upload would succeed (bytes written to R2), then throw when building the return URL, orphaning
the object with no reference stored in the DB.
**Fix:** Added `R2_PUBLIC_URL` to the `isR2Configured()` check.

### Cloudflare Access Policy — Auth Method Instead of Emails
The CF Access application policy Include rule was set to "Authentication Method" (pwd/sms/mfa/otp)
instead of "Emails". This meant the policy allowed anyone who authenticated — not just
the owner's email. Users also could not receive the email OTP (they got a policy mismatch error).
**Fix:** Change the policy Include rule to "Emails" selector with the specific allowed email list.

### SONAR_API_KEY vs PERPLEXITY_API_KEY Mismatch
User saved the Perplexity API key in Railway as `SONAR_API_KEY`. The codebase reads `PERPLEXITY_API_KEY`.
The key was silently absent, causing web research features to fail with no error.
**Fix:** User renamed the Railway variable from `SONAR_API_KEY` to `PERPLEXITY_API_KEY`.
**Rule:** Always verify the exact variable name the code reads before asking the user to save a secret.

### CF Access JWT PII Leak in Logs
`jose` (the JWT library) attaches the decoded token payload to `JWTClaimValidationFailed` errors.
Logging `error` directly would have logged the user's email and other JWT claims.
**Fix:** Log only `(err as Error).message` — never log the raw error object from jose.

### Spanish Content in Enriched Bios/Summaries
Enrichment prompts in `richBio.ts` and `richSummary.ts` had no language constraint. When an
author's name is Spanish or the input bio came from a Spanish source, the LLM mirrored the
language and produced Spanish output that appeared in the library UI.
**Fix (Jun 13, 2026):** Added "Always respond in English." to all 4 system prompts in
`richBio.ts` (research + synthesis passes) and `richSummary.ts` (research + synthesis passes).
To fix already-stored Spanish content: re-run `enrich-rich-bios` and `enrich-rich-summaries`
pipelines in Admin → Intelligence Dashboard.
