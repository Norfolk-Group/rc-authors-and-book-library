/**
 * substack.test.ts
 * Vitest unit tests for the Substack service utilities
 */

import { describe, it, expect } from "vitest";
import { extractSubstackSubdomain } from "./services/substack.service";

describe("extractSubstackSubdomain", () => {
  it("returns null for empty input", () => {
    expect(extractSubstackSubdomain("")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(extractSubstackSubdomain("   ")).toBeNull();
  });

  it("extracts subdomain from full https URL", () => {
    expect(extractSubstackSubdomain("https://adamgrant.substack.com")).toBe("adamgrant");
  });

  it("extracts subdomain from URL without protocol", () => {
    expect(extractSubstackSubdomain("adamgrant.substack.com")).toBe("adamgrant");
  });

  it("extracts subdomain from URL with path", () => {
    expect(extractSubstackSubdomain("https://adamgrant.substack.com/p/some-post")).toBe("adamgrant");
  });

  it("returns raw subdomain when no dots present", () => {
    expect(extractSubstackSubdomain("adamgrant")).toBe("adamgrant");
  });

  it("handles subdomain with hyphens", () => {
    expect(extractSubstackSubdomain("https://derek-thompson.substack.com")).toBe("derek-thompson");
  });

  it("handles uppercase input by normalizing to lowercase", () => {
    expect(extractSubstackSubdomain("AdamGrant.substack.com")).toBe("adamgrant");
  });

  it("handles trailing slash in URL", () => {
    expect(extractSubstackSubdomain("https://adamgrant.substack.com/")).toBe("adamgrant");
  });

  it("handles http:// prefix", () => {
    expect(extractSubstackSubdomain("http://adamgrant.substack.com")).toBe("adamgrant");
  });
});
