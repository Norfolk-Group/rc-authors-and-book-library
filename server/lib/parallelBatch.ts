/**
 * parallelBatch — Configurable concurrency pool for per-author batch operations.
 *
 * Runs a list of async tasks with a bounded concurrency limit (pLimit-style),
 * collecting results and errors without throwing. Designed for:
 *   - Avatar generation (T5 can take 30-120s per author)
 *   - Bio enrichment (Perplexity + Wikipedia, ~5-10s per author)
 *   - Links enrichment (Tavily + Apify, ~10-30s per author)
 *   - Background normalization (Gemini Vision + Imagen, ~30-90s per author)
 *
 * Usage:
 *   const results = await parallelBatch(authorNames, 3, async (name) => {
 *     return await processAuthor(name);
 *   });
 */

export interface BatchResult<T> {
  input: string;
  result?: T;
  error?: string;
  durationMs: number;
}

export interface BatchSummary<T> {
  results: BatchResult<T>[];
  succeeded: number;
  failed: number;
  totalMs: number;
}

/**
 * Run `tasks` in parallel with at most `concurrency` running at once.
 *
 * @param inputs      Array of string inputs (e.g. author names)
 * @param concurrency Maximum number of concurrent tasks (default: 3)
 * @param fn          Async function to run for each input
 * @returns           BatchSummary with per-item results and aggregate stats
 */
export async function parallelBatch<T>(
  inputs: string[],
  concurrency: number = 3,
  fn: (input: string) => Promise<T>
): Promise<BatchSummary<T>> {
  const batchStart = Date.now();
  const results: BatchResult<T>[] = [];

  // Clamp concurrency to a safe range
  const limit = Math.max(1, Math.min(concurrency, 10));

  // Work queue — process inputs in order, bounded by concurrency
  let index = 0;
  const inFlight = new Set<Promise<void>>();

  const runNext = (): Promise<void> => {
    if (index >= inputs.length) return Promise.resolve();
    const currentIndex = index++;
    const input = inputs[currentIndex];
    const taskStart = Date.now();

    // Use a holder so the finally block can reference the promise after assignment
    let taskHolder!: Promise<void>;
    taskHolder = (async () => {
      try {
        const result = await fn(input);
        results[currentIndex] = {
          input,
          result,
          durationMs: Date.now() - taskStart,
        };
      } catch (err) {
        results[currentIndex] = {
          input,
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - taskStart,
        };
      } finally {
        inFlight.delete(taskHolder);
        // Immediately start next task when a slot opens
        if (index < inputs.length) {
          const next = runNext();
          inFlight.add(next);
        }
      }
    })();

    return taskHolder;
  };

  // Seed the initial batch
  const initialBatch = Math.min(limit, inputs.length);
  for (let i = 0; i < initialBatch; i++) {
    const task = runNext();
    inFlight.add(task);
  }

  // Wait for all tasks to complete
  while (inFlight.size > 0) {
    await Promise.race(inFlight);
  }

  const succeeded = results.filter((r) => r.error === undefined).length;
  const failed = results.filter((r) => r.error !== undefined).length;

  return {
    results,
    succeeded,
    failed,
    totalMs: Date.now() - batchStart,
  };
}
