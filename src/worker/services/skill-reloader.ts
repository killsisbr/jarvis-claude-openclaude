/**
 * Skill reloader — manages hot-reload with fallback and versioning.
 *
 * Safely reloads skill implementations without downtime.
 * Maintains previous version for rollback on failure.
 */

import fs from 'fs'
import path from 'path'
import { EventEmitter } from 'events'

interface SkillVersion {
  code: string
  timestamp: number
  hash: string
}

interface ReloadMetrics {
  name: string
  count: number
  successCount: number
  errorCount: number
  avgLatencyMs: number
  lastReloadAt: number | null
  lastError: string | null
}

export class SkillReloader extends EventEmitter {
  private versions = new Map<string, SkillVersion[]>() // Store previous versions
  private metrics = new Map<string, ReloadMetrics>()
  private readonly MAX_VERSIONS = 5 // Keep last 5 versions for rollback
  private readonly RETRY_DELAY_MS = 100
  private readonly MAX_RETRIES = 3

  /**
   * Reload a skill from disk
   */
  async reload(skillPath: string): Promise<{ success: boolean; error?: string; latencyMs: number }> {
    const t0 = Date.now()
    const skillName = path.basename(path.dirname(skillPath))

    try {
      // Verify file exists
      if (!fs.existsSync(skillPath)) {
        throw new Error(`Skill file not found: ${skillPath}`)
      }

      // Read new code
      const newCode = fs.readFileSync(skillPath, 'utf-8')
      const newHash = this.hashCode(newCode)

      // Check if code actually changed
      const currentVersions = this.versions.get(skillName) || []
      if (currentVersions.length > 0) {
        const latestVersion = currentVersions[currentVersions.length - 1]
        if (latestVersion.hash === newHash) {
          return {
            success: true,
            latencyMs: Date.now() - t0,
          }
        }
      }

      // Try to load and validate
      let skill = await this.loadSkill(skillPath)

      // Validate structure
      if (!skill.execute) {
        throw new Error('Skill must export execute() function')
      }

      // Success: store version
      const version: SkillVersion = {
        code: newCode,
        timestamp: Date.now(),
        hash: newHash,
      }

      let versions = this.versions.get(skillName) || []
      versions.push(version)

      // Keep only last N versions
      if (versions.length > this.MAX_VERSIONS) {
        versions = versions.slice(-this.MAX_VERSIONS)
      }
      this.versions.set(skillName, versions)

      // Update metrics
      this.updateMetrics(skillName, true, Date.now() - t0)

      this.emit('reload-success', { skillName, latencyMs: Date.now() - t0 })

      return {
        success: true,
        latencyMs: Date.now() - t0,
      }
    } catch (err) {
      const latencyMs = Date.now() - t0
      const errorMsg = err instanceof Error ? err.message : String(err)

      // Update metrics
      this.updateMetrics(skillName, false, latencyMs, errorMsg)

      this.emit('reload-error', { skillName, error: errorMsg, latencyMs })

      return {
        success: false,
        error: errorMsg,
        latencyMs,
      }
    }
  }

  /**
   * Rollback to previous version
   */
  rollback(skillName: string): boolean {
    const versions = this.versions.get(skillName)

    if (!versions || versions.length < 2) {
      return false
    }

    // Remove last version, revert to second-to-last
    versions.pop()

    this.emit('rollback', { skillName })

    return true
  }

  /**
   * Get skill version history
   */
  getVersionHistory(skillName: string): SkillVersion[] {
    return this.versions.get(skillName) || []
  }

  /**
   * Get reload metrics
   */
  getMetrics(skillName?: string): ReloadMetrics | ReloadMetrics[] {
    if (skillName) {
      return this.metrics.get(skillName) || this.createMetrics(skillName)
    }

    return Array.from(this.metrics.values())
  }

  /**
   * Load skill module from file
   */
  private async loadSkill(skillPath: string): Promise<any> {
    try {
      delete require.cache[require.resolve(skillPath)]
      return require(skillPath)
    } catch (err) {
      throw new Error(`Failed to load skill: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /**
   * Hash code for change detection
   */
  private hashCode(code: string): string {
    let hash = 0
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16)
  }

  /**
   * Update metrics
   */
  private updateMetrics(skillName: string, success: boolean, latencyMs: number, error?: string): void {
    let metrics = this.metrics.get(skillName) || this.createMetrics(skillName)

    metrics.count++
    if (success) {
      metrics.successCount++
    } else {
      metrics.errorCount++
      metrics.lastError = error || null
    }

    metrics.avgLatencyMs = (metrics.avgLatencyMs * (metrics.count - 1) + latencyMs) / metrics.count
    metrics.lastReloadAt = Date.now()

    this.metrics.set(skillName, metrics)
  }

  /**
   * Create initial metrics
   */
  private createMetrics(skillName: string): ReloadMetrics {
    return {
      name: skillName,
      count: 0,
      successCount: 0,
      errorCount: 0,
      avgLatencyMs: 0,
      lastReloadAt: null,
      lastError: null,
    }
  }
}

/**
 * Global reloader instance
 */
let globalReloader: SkillReloader | null = null

/**
 * Get or create global reloader
 */
export function getSkillReloader(): SkillReloader {
  if (!globalReloader) {
    globalReloader = new SkillReloader()
  }
  return globalReloader
}

/**
 * Cleanup global reloader
 */
export function destroySkillReloader(): void {
  if (globalReloader) {
    globalReloader.removeAllListeners()
    globalReloader = null
  }
}
