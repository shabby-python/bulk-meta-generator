import type { BatchQueueOptions } from "./types";

/**
 * Runs `worker` over every item in `items` with bounded concurrency.
 * Each item is isolated: a thrown error is caught and reported through
 * `worker`'s own error handling (worker should not throw for expected
 * per-item failures) so one bad URL never aborts the whole batch.
 */
export async function runBatchQueue<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  options: BatchQueueOptions
): Promise<void> {
  const { concurrency, onItemSettled, isCancelled } = options;
  const total = items.length;
  let nextIndex = 0;
  let completed = 0;

  async function runWorker(): Promise<void> {
    for (;;) {
      if (isCancelled?.()) return;
      const currentIndex = nextIndex;
      if (currentIndex >= total) return;
      nextIndex++;

      try {
        await worker(items[currentIndex], currentIndex);
      } catch {
        // Workers are expected to handle their own errors; this is a
        // last-resort guard so one unexpected throw can't stall the queue.
      } finally {
        completed++;
        onItemSettled?.(completed, total);
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, total || 1));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
}
