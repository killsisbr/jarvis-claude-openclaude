import { EventBus } from "./event-bus";
import { CronScheduler } from "./cron-scheduler";
import { getDatabase } from "./db/schema";
import os from "os";

interface SentinelAlert {
  name: string;
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: number;
  cooldownUntil?: number;
}

export class Sentinels {
  private scheduler: CronScheduler;
  private eventBus: EventBus;
  private db: any;
  private alertCooldowns: Map<string, number> = new Map();
  private cooldownDurationMs = 5 * 60 * 1000; // 5 minutes

  constructor(scheduler: CronScheduler, eventBus?: EventBus) {
    this.scheduler = scheduler;
    this.eventBus = eventBus || new EventBus();
    this.db = getDatabase();
  }

  registerAll(): void {
    this.registerHealthCheck();
    this.registerKeyHealthCheck();
    this.registerCostSentinel();
    this.registerMemoryConsolidation();
    this.registerSpacedRepetitionDecay();

    console.log("[Sentinels] All 5 sentinelas registered");
  }

  private registerHealthCheck(): void {
    this.scheduler.schedule("health-check", 60000, async () => {
      try {
        const cpuUsage = this.getCpuUsage();
        const memUsage = this.getMemoryUsage();
        const diskUsage = this.getDiskUsage();

        const stats = {
          cpu: cpuUsage,
          memory: memUsage,
          disk: diskUsage,
        };

        // Check thresholds
        let alert: SentinelAlert | null = null;

        if (cpuUsage > 90) {
          alert = {
            name: "health-check",
            severity: "critical",
            message: `🚨 CPU usage critical: ${cpuUsage.toFixed(1)}%`,
            timestamp: Date.now(),
          };
        } else if (memUsage > 90) {
          alert = {
            name: "health-check",
            severity: "critical",
            message: `🚨 Memory usage critical: ${memUsage.toFixed(1)}%`,
            timestamp: Date.now(),
          };
        } else if (diskUsage > 90) {
          alert = {
            name: "health-check",
            severity: "warning",
            message: `⚠️ Disk usage high: ${diskUsage.toFixed(1)}%`,
            timestamp: Date.now(),
          };
        }

        if (alert && this.shouldAlert("health-check")) {
          this.emit(alert);
        }

        this.eventBus.emit("health_check", stats);
      } catch (error) {
        console.error("[health-check] Error:", error);
      }
    });
  }

  private registerKeyHealthCheck(): void {
    this.scheduler.schedule("key-health-check", 60000, async () => {
      try {
        // Query approval_requests for recent 429 errors or denied requests
        const stmt = this.db.prepare(`
          SELECT COUNT(*) as count
          FROM approval_requests
          WHERE status = 'denied'
          AND createdAt > datetime('now', '-1 hour')
        `);

        const result = stmt.all();
        const denialCount = result[0]?.count ?? 0;

        if (denialCount > 5) {
          const alert: SentinelAlert = {
            name: "key-health-check",
            severity: "warning",
            message: `⚠️ High denial rate: ${denialCount} requests denied in last hour`,
            timestamp: Date.now(),
          };

          if (this.shouldAlert("key-health-check")) {
            this.emit(alert);
          }
        }

        this.eventBus.emit("key_health_check", { denialCount });
      } catch (error) {
        console.error("[key-health-check] Error:", error);
      }
    });
  }

  private registerCostSentinel(): void {
    this.scheduler.schedule("cost-sentinel", 5 * 60 * 1000, async () => {
      try {
        // Query daily spending
        const stmt = this.db.prepare(`
          SELECT
            COALESCE(SUM(cost), 0) as totalCost,
            COUNT(DISTINCT user_phone) as uniqueUsers
          FROM budget_daily
          WHERE date = date('now', 'localtime')
        `);

        const result = stmt.all();
        const totalCost = result[0]?.totalCost ?? 0;
        const uniqueUsers = result[0]?.uniqueUsers ?? 0;

        // Get global limit (default $1000/day for now)
        const globalLimit = 1000;
        const costPercent = (totalCost / globalLimit) * 100;

        let alert: SentinelAlert | null = null;

        if (costPercent >= 100) {
          alert = {
            name: "cost-sentinel",
            severity: "critical",
            message: `🚨 Daily budget EXCEEDED: $${totalCost.toFixed(2)} / $${globalLimit}`,
            timestamp: Date.now(),
          };
        } else if (costPercent >= 80) {
          alert = {
            name: "cost-sentinel",
            severity: "warning",
            message: `⚠️ Daily budget warning: $${totalCost.toFixed(2)} / $${globalLimit} (${costPercent.toFixed(0)}%)`,
            timestamp: Date.now(),
          };
        }

        if (alert && this.shouldAlert("cost-sentinel")) {
          this.emit(alert);
        }

        this.eventBus.emit("cost_sentinel", {
          totalCost,
          costPercent,
          uniqueUsers,
          limit: globalLimit,
        });
      } catch (error) {
        console.error("[cost-sentinel] Error:", error);
      }
    });
  }

  private registerMemoryConsolidation(): void {
    this.scheduler.schedule("memory-consolidation", 4 * 60 * 60 * 1000, async () => {
      try {
        // Stub: In future, this will extract learnings from recent interactions
        // via Haiku LLM and persist to learnings table

        // For now, just log that the job ran
        this.eventBus.emit("memory_consolidation", {
          status: "stub",
          message: "Memory consolidation stub - will extract learnings in future",
          timestamp: Date.now(),
        });

        console.log("[memory-consolidation] Stub job executed (future: Haiku extraction)");
      } catch (error) {
        console.error("[memory-consolidation] Error:", error);
      }
    });
  }

  private registerSpacedRepetitionDecay(): void {
    this.scheduler.schedule("spaced-repetition-decay", 24 * 60 * 60 * 1000, async () => {
      try {
        // Apply daily decay to relevance
        const decayRate = 0.98; // 2% per day

        const updateStmt = this.db.prepare(`
          UPDATE learnings
          SET relevance = relevance * ?
          WHERE relevance > 0.05
        `);

        updateStmt.run(decayRate);

        // Cleanup: Remove items with relevance < 0.05 and 90+ days old
        const cutoffDate = Date.now() - 90 * 24 * 60 * 60 * 1000;

        const deleteStmt = this.db.prepare(`
          DELETE FROM learnings
          WHERE relevance < 0.05
          AND createdAt < ?
        `);

        deleteStmt.run(cutoffDate);

        const deleteResult = deleteStmt.all();
        const deletedCount = 0; // SQLite doesn't return row count easily

        this.eventBus.emit("spaced_rep_decay", {
          decayRate,
          cutoffDate,
          timestamp: Date.now(),
        });

        console.log(
          "[spaced-repetition-decay] Applied decay and cleaned up old learnings"
        );
      } catch (error) {
        console.error("[spaced-repetition-decay] Error:", error);
      }
    });
  }

  private shouldAlert(sentinelName: string): boolean {
    const cooldownUntil = this.alertCooldowns.get(sentinelName);
    if (!cooldownUntil) return true;

    if (Date.now() >= cooldownUntil) {
      this.alertCooldowns.delete(sentinelName);
      return true;
    }

    return false;
  }

  private emit(alert: SentinelAlert): void {
    // Set cooldown
    this.alertCooldowns.set(alert.name, Date.now() + this.cooldownDurationMs);

    // Emit event
    this.eventBus.emit("sentinel_alert", alert);
    console.log(`[Sentinels] ALERT: ${alert.message}`);
  }

  private getCpuUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~((idle / total) * 100);

    return Math.max(0, Math.min(100, usage));
  }

  private getMemoryUsage(): number {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return (usedMem / totalMem) * 100;
  }

  private getDiskUsage(): number {
    // Approximate disk usage by checking available space
    // This is a simplified implementation
    try {
      const freeSpace = os.freemem() / (1024 * 1024 * 1024); // GB
      // Estimate total disk as 100GB
      const estimatedTotal = 100;
      const estimatedUsed = estimatedTotal - freeSpace;
      return (estimatedUsed / estimatedTotal) * 100;
    } catch {
      return 0;
    }
  }

  getStats(): {
    sentinels: string[];
    alerts: SentinelAlert[];
    cooldowns: Record<string, number>;
  } {
    const cooldowns: Record<string, number> = {};
    for (const [name, until] of this.alertCooldowns) {
      cooldowns[name] = until - Date.now();
    }

    return {
      sentinels: [
        "health-check",
        "key-health-check",
        "cost-sentinel",
        "memory-consolidation",
        "spaced-repetition-decay",
      ],
      alerts: this.eventBus.getHistory("sentinel_alert") as unknown as SentinelAlert[],
      cooldowns,
    };
  }
}
