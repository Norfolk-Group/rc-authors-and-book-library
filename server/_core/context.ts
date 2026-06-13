import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { resolveCfAccessOwner } from "../lib/cfAccess";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Cloudflare Access fallback: when no Manus session is present but the request
  // carries a valid Cloudflare Access identity, authenticate as the owner.
  // No-op unless CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD are configured.
  if (!user) {
    try {
      user = await resolveCfAccessOwner(opts.req);
    } catch (error) {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
