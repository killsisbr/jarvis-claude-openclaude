import { EventBus } from "./event-bus";

export interface CronJob {
  name: string;
  intervalMs: number;
  fn: () => Promise<void> | void;
  timerId?: NodeJS.Timeout;
  lastRun?: number;
  nextRun?: number;
  errorCount: number;
  lastError?: string;
  active: boolean;
}

export class CronScheduler {
  private jobs: Map<string, CronJob> = new Map();
  private eventBus: EventBus;
  private startTime: number;

  constructor(eventBus?: EventBus) {
    this.eventBus = eventBus || new EventBus();
    this.startTime = Date.now();
  }

  schedule(name: string, intervalMs: number, fn: () => Promise<void> | void): string {
    if (this.jobs.has(name)) {
      throw new Error(`Job with name "${name}" already exists`);
    }

    const job: CronJob = {
      name,
      intervalMs,
      fn,
      errorCount: 0,
      active: true,
      nextRun: Date.now() + intervalMs,
    };

    // Schedule first run
    this.executeJob(job);

    this.jobs.set(name, job);
    this.eventBus.emit("job_scheduled", { name, intervalMs });

    return name;
  }

  cancel(name: string): boolean {
    const job = this.jobs.get(name);
    if (!job) return false;

    if (job.timerId) {
      clearInterval(job.timerId);
    }
    job.active = false;
    this.jobs.delete(name);
    this.eventBus.emit("job_cancelled", { name });

    return true;
  }

  list(): CronJob[] {
    return Array.from(this.jobs.values()).map((job) => ({
      name: job.name,
      intervalMs: job.intervalMs,
      fn: job.fn,
      lastRun: job.lastRun,
      nextRun: job.nextRun,
      errorCount: job.errorCount,
      lastError: job.lastError,
      active: job.active,
    })) as CronJob[];
  }

  getStats(): {
    totalJobs: number;
    activeJobs: number;
    totalErrors: number;
    uptime: number;
    lastErrors: Record<string, string>;
  } {
    let activeJobs = 0;
    let totalErrors = 0;
    const lastErrors: Record<string, string> = {};

    for (const job of this.jobs.values()) {
      if (job.active) activeJobs++;
      totalErrors += job.errorCount;
      if (job.lastError) {
        lastErrors[job.name] = job.lastError;
      }
    }

    return {
      totalJobs: this.jobs.size,
      activeJobs,
      totalErrors,
      uptime: Date.now() - this.startTime,
      lastErrors,
    };
  }

  private executeJob(job: CronJob): void {
    const runJob = async () => {
      try {
        const start = Date.now();
        job.lastRun = start;

        await Promise.resolve(job.fn());

        const duration = Date.now() - start;
        job.nextRun = Date.now() + job.intervalMs;

        this.eventBus.emit("job_executed", {
          name: job.name,
          duration,
          errorCount: job.errorCount,
        });
      } catch (error) {
        job.errorCount++;
        job.lastError = error instanceof Error ? error.message : String(error);
        job.nextRun = Date.now() + job.intervalMs;

        console.error(`[CronScheduler] Job "${job.name}" failed:`, job.lastError);

        this.eventBus.emit("job_error", {
          name: job.name,
          error: job.lastError,
          errorCount: job.errorCount,
        });
      }
    };

    // Schedule recurring execution
    job.timerId = setInterval(() => {
      runJob().catch((error) => {
        console.error(`[CronScheduler] Unhandled error in job "${job.name}":`, error);
      });
    }, job.intervalMs);

    // Run immediately
    runJob().catch((error) => {
      console.error(`[CronScheduler] Unhandled error in initial run of "${job.name}":`, error);
    });
  }

  shutdownAll(): void {
    for (const job of this.jobs.values()) {
      if (job.timerId) {
        clearInterval(job.timerId);
      }
    }
    this.jobs.clear();
    this.eventBus.emit("scheduler_shutdown", { timestamp: Date.now() });
  }
}
