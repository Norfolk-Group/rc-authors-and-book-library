// Cloudflare Access (Zero Trust) edge OAuth gate.
//
// When CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD are set, a request carrying a valid
// Cloudflare Access JWT is authenticated as the app owner (single-user model:
// anyone Cloudflare lets through the policy is treated as the owner/admin).
//
// Disabled and inert unless both env vars are present — when unset, every
// function returns null without touching the network or DB, so the existing
// auth path is unchanged.

import type { Request } from "express";
import { parse as parseCookieHeader } from "cookie";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "../_core/env";
import { logger } from "./logger";

/** Team domain without a trailing slash, e.g. https://acme.cloudflareaccess.com */
function teamDomain(): string {
  return ENV.cfAccessTeamDomain.replace(/\/+$/, "");
}

export function isCfAccessEnabled(): boolean {
  return Boolean(ENV.cfAccessTeamDomain && ENV.cfAccessAud);
}

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!_jwks) {
    _jwks = createRemoteJWKSet(new URL(`${teamDomain()}/cdn-cgi/access/certs`));
  }
  return _jwks;
}

/** Cloudflare sends the signed assertion as a header and a cookie; prefer the header. */
function extractToken(req: Request): string | null {
  const header = req.headers["cf-access-jwt-assertion"];
  if (typeof header === "string" && header.length > 0) return header;
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookieHeader(cookieHeader);
    if (cookies.CF_Authorization) return cookies.CF_Authorization;
  }
  return null;
}

/** Validate the Cloudflare Access JWT and return the authenticated email, or null. */
export async function verifyCfAccessEmail(req: Request): Promise<string | null> {
  if (!isCfAccessEnabled()) return null;
  const token = extractToken(req);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: teamDomain(),
      audience: ENV.cfAccessAud,
    });
    const email = payload.email;
    return typeof email === "string" && email.length > 0 ? email : null;
  } catch (err) {
    logger.warn("[CfAccess] JWT verification failed", err);
    return null;
  }
}

/**
 * Single-user owner model: a valid Cloudflare Access identity is mapped to the
 * app owner (openId === ENV.ownerOpenId), which upsertUser auto-grants `admin`.
 * Returns the owner User, or null when CF Access is disabled / the JWT is absent
 * or invalid.
 */
export async function resolveCfAccessOwner(req: Request): Promise<User | null> {
  const email = await verifyCfAccessEmail(req);
  if (!email) return null;

  const ownerOpenId = ENV.ownerOpenId || "owner";
  await db.upsertUser({
    openId: ownerOpenId,
    email,
    name: email,
    loginMethod: "cloudflare",
    lastSignedIn: new Date(),
  });
  const user = await db.getUserByOpenId(ownerOpenId);
  return user ?? null;
}
