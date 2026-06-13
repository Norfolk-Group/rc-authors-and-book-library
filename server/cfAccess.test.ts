import { describe, it, expect } from "vitest";
import type { Request } from "express";
import {
  isCfAccessEnabled,
  verifyCfAccessEmail,
  resolveCfAccessOwner,
} from "./lib/cfAccess";

// CF_ACCESS_* are unset in the test env, so the gate must be fully inert:
// no JWKS fetch, no DB access, and the existing auth path is unchanged.
describe("cfAccess — disabled by default (no env)", () => {
  it("isCfAccessEnabled() is false when env is unset", () => {
    expect(isCfAccessEnabled()).toBe(false);
  });

  it("verifyCfAccessEmail() returns null without a token", async () => {
    const req = { headers: {} } as unknown as Request;
    expect(await verifyCfAccessEmail(req)).toBeNull();
  });

  it("verifyCfAccessEmail() returns null even with a token present (gate off)", async () => {
    const req = {
      headers: { "cf-access-jwt-assertion": "header.payload.sig" },
    } as unknown as Request;
    expect(await verifyCfAccessEmail(req)).toBeNull();
  });

  it("resolveCfAccessOwner() returns null and never touches the DB when disabled", async () => {
    const req = {
      headers: { "cf-access-jwt-assertion": "header.payload.sig" },
    } as unknown as Request;
    expect(await resolveCfAccessOwner(req)).toBeNull();
  });
});
