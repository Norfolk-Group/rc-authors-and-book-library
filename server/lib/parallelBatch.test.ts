/**
 * Tests for parallelBatch utility.
 * Covers: concurrency cap, error isolation, result ordering, progress, empty input.
 */
import { describe, it, expect, vi } from "vitest";
import { parallelBatch } from "./parallelBatch";

// Helper: create a delayed task that records its start/end times
function makeTimedTask(durationMs: number, fail = false) {
  return async (input: string) => {
    await new Promise((r) => setTimeout(r, durationMs));
    if (fail) throw new Error(`Task failed: ${input}`);
    return `done:${input}`;
  };
}

describe("parallelBatch", () => {
  it("returns empty summary for empty input", async () => {
    const summary = await parallelBatch([], 3, async (x) => x);
    expect(summary.results).toHaveLength(0);
    expect(summary.succeeded).toBe(0);
    expect(summary.failed).toBe(0);
  });

  it("processes all inputs and returns correct results", async () => {
    const inputs = ["a", "b", "c"];
    const summary = await parallelBatch(inputs, 2, async (x) => `result:${x}`);
    expect(summary.results).toHaveLength(3);
    expect(summary.succeeded).toBe(3);
    expect(summary.failed).toBe(0);
    // Results are ordered by input index
    expect(summary.results[0].result).toBe("result:a");
    expect(summary.results[1].result).toBe("result:b");
    expect(summary.results[2].result).toBe("result:c");
  });

  it("isolates errors — failed items don't abort other tasks", async () => {
    const inputs = ["ok1", "fail", "ok2"];
    const summary = await parallelBatch(inputs, 3, async (x) => {
      if (x === "fail") throw new Error("intentional failure");
      return `done:${x}`;
    });
    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(1);
    // Successful items have results
    expect(summary.results[0].result).toBe("done:ok1");
    expect(summary.results[2].result).toBe("done:ok2");
    // Failed item has error message, no result
    expect(summary.results[1].error).toContain("intentional failure");
    expect(summary.results[1].result).toBeUndefined();
  });

  it("respects concurrency cap — never exceeds limit", async () => {
    let maxConcurrent = 0;
    let current = 0;
    const concurrencyLimit = 3;
    const inputs = Array.from({ length: 9 }, (_, i) => `item${i}`);

    await parallelBatch(inputs, concurrencyLimit, async (x) => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise((r) => setTimeout(r, 10));
      current--;
      return x;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(concurrencyLimit);
  });

  it("clamps concurrency to 1 when 0 is passed", async () => {
    let maxConcurrent = 0;
    let current = 0;
    const inputs = ["a", "b", "c"];

    await parallelBatch(inputs, 0, async (x) => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise((r) => setTimeout(r, 5));
      current--;
      return x;
    });

    expect(maxConcurrent).toBe(1);
  });

  it("clamps concurrency to 10 when >10 is passed", async () => {
    let maxConcurrent = 0;
    let current = 0;
    const inputs = Array.from({ length: 20 }, (_, i) => `item${i}`);

    await parallelBatch(inputs, 50, async (x) => {
      current++;
      maxConcurrent = Math.max(maxConcurrent, current);
      await new Promise((r) => setTimeout(r, 5));
      current--;
      return x;
    });

    expect(maxConcurrent).toBeLessThanOrEqual(10);
  });

  it("records durationMs for each result", async () => {
    const inputs = ["x", "y"];
    const summary = await parallelBatch(inputs, 2, async (x) => {
      await new Promise((r) => setTimeout(r, 10));
      return x;
    });
    for (const r of summary.results) {
      expect(r.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("records totalMs for the whole batch", async () => {
    const summary = await parallelBatch(["a", "b"], 2, async (x) => {
      await new Promise((r) => setTimeout(r, 10));
      return x;
    });
    expect(summary.totalMs).toBeGreaterThanOrEqual(0);
  });

  it("processes single item correctly", async () => {
    const summary = await parallelBatch(["solo"], 3, async (x) => `done:${x}`);
    expect(summary.succeeded).toBe(1);
    expect(summary.results[0].result).toBe("done:solo");
  });

  it("handles all failures gracefully", async () => {
    const inputs = ["a", "b", "c"];
    const summary = await parallelBatch(inputs, 2, async (x) => {
      throw new Error(`fail:${x}`);
    });
    expect(summary.succeeded).toBe(0);
    expect(summary.failed).toBe(3);
    for (const r of summary.results) {
      expect(r.error).toBeDefined();
      expect(r.result).toBeUndefined();
    }
  });

  it("concurrency=1 processes items sequentially", async () => {
    const order: string[] = [];
    const inputs = ["first", "second", "third"];

    await parallelBatch(inputs, 1, async (x) => {
      order.push(x);
      await new Promise((r) => setTimeout(r, 5));
      return x;
    });

    expect(order).toEqual(["first", "second", "third"]);
  });
});
