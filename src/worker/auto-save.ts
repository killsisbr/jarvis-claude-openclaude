export interface AutoSaveOptions {
  delayMs?: number;
  maxBatchSize?: number;
}

export class AutoSave {
  private timeout: NodeJS.Timeout | null = null;
  private queue: Array<() => Promise<void>> = [];
  private delayMs: number;
  private maxBatchSize: number;

  constructor(private saveFn: (items: Array<() => Promise<void>>) => Promise<void>, options: AutoSaveOptions = {}) {
    this.delayMs = options.delayMs ?? 1000;
    this.maxBatchSize = options.maxBatchSize ?? 100;
  }

  async enqueue(fn: () => Promise<void>): Promise<void> {
    this.queue.push(fn);

    // Flush if batch is full
    if (this.queue.length >= this.maxBatchSize) {
      await this.flush();
      return;
    }

    // Schedule flush if not already scheduled
    if (!this.timeout) {
      this.timeout = setTimeout(() => this.flush().catch(console.error), this.delayMs);
    }
  }

  async flush(): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.queue.length === 0) return;

    const items = this.queue.splice(0);
    try {
      await this.saveFn(items);
    } catch (error) {
      console.error("[AutoSave] Error flushing queue:", error);
      // Re-queue failed items
      this.queue.unshift(...items);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    // Flush remaining items
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.queue.length > 0) {
      console.log(`[AutoSave] Flushing ${this.queue.length} pending saves on shutdown`);
      await this.flush();
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

// Generic debounced save factory
export function createAutoSave<T>(
  items: Map<string, T>,
  saveFn: (items: T[]) => Promise<void>,
  options: AutoSaveOptions = {}
): AutoSave {
  const autoSave = new AutoSave(async (fns) => {
    const toSave: T[] = [];
    const ids = new Set<string>();

    for (const fn of fns) {
      await fn();
      // Collect unique items to save
      for (const [id, item] of items) {
        if (!ids.has(id)) {
          ids.add(id);
          toSave.push(item);
        }
      }
    }

    if (toSave.length > 0) {
      await saveFn(toSave);
    }
  }, options);

  return autoSave;
}
