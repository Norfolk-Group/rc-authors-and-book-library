/**
 * modelResolver.test.ts
 *
 * Tests the pure selection logic (pickLatestAnthropic / pickLatestGemini /
 * versionKey) and the always-safe fallback contract of getModel().
 * Network resolution is not exercised — getModel() falls back to PINNED_MODELS
 * when no key is configured in the test environment.
 */

import { describe, it, expect } from "vitest";
import {
  versionKey,
  pickLatestAnthropic,
  pickLatestGemini,
  PINNED_MODELS,
  getModel,
} from "./lib/modelResolver";

describe("versionKey", () => {
  it("extracts numeric components", () => {
    expect(versionKey("claude-opus-4-8")).toEqual([4, 8]);
    expect(versionKey("gemini-2.5-flash")).toEqual([2, 5]);
    expect(versionKey("gemini-3-pro")).toEqual([3]);
  });

  it("returns empty array when there are no digits", () => {
    expect(versionKey("nano-banana")).toEqual([]);
  });
});

describe("pickLatestAnthropic", () => {
  const models = [
    { id: "claude-opus-4-8", created_at: "2026-05-01T00:00:00Z" },
    { id: "claude-opus-4-6", created_at: "2026-01-01T00:00:00Z" },
    { id: "claude-sonnet-4-6", created_at: "2026-02-01T00:00:00Z" },
    { id: "claude-opus-4-1-20250805", created_at: "2025-08-05T00:00:00Z" }, // dated snapshot
    { id: "claude-opus-4-6-fast", created_at: "2026-01-02T00:00:00Z" },     // variant
  ];

  it("picks the newest bare opus alias", () => {
    expect(pickLatestAnthropic(models, "opus")).toBe("claude-opus-4-8");
  });

  it("picks the newest bare sonnet alias", () => {
    expect(pickLatestAnthropic(models, "sonnet")).toBe("claude-sonnet-4-6");
  });

  it("ignores dated snapshots and -fast/-preview variants", () => {
    const onlyVariants = [
      { id: "claude-opus-4-1-20250805", created_at: "2025-08-05T00:00:00Z" },
      { id: "claude-opus-4-6-fast", created_at: "2026-01-02T00:00:00Z" },
    ];
    expect(pickLatestAnthropic(onlyVariants, "opus")).toBeNull();
  });

  it("returns null when no family match exists", () => {
    expect(pickLatestAnthropic([{ id: "claude-haiku-4-5" }], "opus")).toBeNull();
  });

  it("falls back to version order when created_at is absent", () => {
    const noDates = [{ id: "claude-opus-4-6" }, { id: "claude-opus-4-8" }];
    expect(pickLatestAnthropic(noDates, "opus")).toBe("claude-opus-4-8");
  });
});

describe("pickLatestGemini", () => {
  const models = [
    { name: "models/gemini-2.5-flash" },
    { name: "models/gemini-2.5-pro" },
    { name: "models/gemini-3-pro" },
    { name: "models/gemini-2.5-flash-image" },
    { name: "models/gemini-3-pro-image-preview" }, // preview — excluded
    { name: "models/gemini-embedding-001" },        // embedding — excluded
    { name: "models/gemini-2.0-flash-exp" },         // experimental — excluded
  ];

  it("picks the newest stable gemini text model", () => {
    expect(pickLatestGemini(models, "gemini-text")).toBe("gemini-3-pro");
  });

  it("picks the newest stable gemini image model (excluding previews)", () => {
    expect(pickLatestGemini(models, "gemini-image")).toBe("gemini-2.5-flash-image");
  });

  it("excludes embedding/experimental/preview variants from text", () => {
    const noStable = [
      { name: "models/gemini-embedding-001" },
      { name: "models/gemini-2.0-flash-exp" },
    ];
    expect(pickLatestGemini(noStable, "gemini-text")).toBeNull();
  });

  it("returns null when the list is empty", () => {
    expect(pickLatestGemini([], "gemini-image")).toBeNull();
  });
});

describe("getModel fallback contract", () => {
  it("returns a pinned fallback for every family when resolution is unavailable", async () => {
    // No ANTHROPIC/GEMINI key in the test env → resolvers no-op → pinned values.
    for (const family of Object.keys(PINNED_MODELS) as Array<keyof typeof PINNED_MODELS>) {
      const resolved = await getModel(family);
      expect(typeof resolved).toBe("string");
      expect(resolved.length).toBeGreaterThan(0);
      expect(resolved).toBe(PINNED_MODELS[family]);
    }
  });
});
