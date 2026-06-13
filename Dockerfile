# syntax=docker/dockerfile:1
#
# Portable container image for the RC Library app.
# The app is a single long-running Node server (Express + tRPC) that also serves
# the built React client. This image builds both, then runs `node dist/index.js`.
#
# It runs identically on any container host (Railway, Render, Fly.io, Azure
# Container Apps, or your laptop) — set the env vars from .env.example on the host.

# ── Stage 1: build the client + server ────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# Use the pnpm version pinned in package.json (via corepack). Disable the
# interactive download prompt so the build never hangs.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# Install dependencies first for better layer caching. The patches/ dir is
# required because package.json declares pnpm patchedDependencies.
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

# Copy the source and build: Vite → dist/public (client), esbuild → dist/index.js (server)
COPY . .
RUN pnpm build

# ── Stage 2: lightweight runtime ──────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# The esbuild server bundle uses `--packages=external` and statically imports a
# few BUILD-TIME packages (vite, @vitejs/plugin-react, @tailwindcss/vite,
# vite-plugin-manus-runtime) at module load — even in production — so the runtime
# needs the FULL dependency set, not a --prod subset. Copy the exact, already-
# installed node_modules from the builder (pnpm's node_modules is self-contained)
# plus the compiled app. package.json is needed at runtime for "type": "module".
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# The server listens on PORT (defaults to 3000). Hosts like Railway/Render
# inject PORT automatically.
EXPOSE 3000
CMD ["node", "dist/index.js"]
