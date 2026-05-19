/**
 * Skill watcher — monitors skill files for changes and triggers hot-reload.
 *
 * Uses file system watcher to detect changes and notifies via WebSocket.
 */

import fs from 'fs'
import path from 'path'
import { EventEmitter } from 'events'

const DEBOUNCE_MS = 500 // Debounce file changes

interface WatcherConfig {
  onReload?: (skillPath: string) => Promise<void>
  onError?: (error: Error) => void
}

export class SkillWatcher extends EventEmitter {
  private watching = new Map<string, ReturnType<typeof setTimeout> | null>()
  private watchers = new Map<string, fs.FSWatcher>()
  private config: WatcherConfig

  constructor(config: WatcherConfig = {}) {
    super()
    this.config = config
  }

  /**
   * Start watching a skill file for changes
   */
  watch(skillPath: string): void {
    const resolvedPath = path.resolve(skillPath)

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`)
    }

    if (this.watchers.has(resolvedPath)) {
      console.log(`[watcher] Already watching: ${resolvedPath}`)
      return
    }

    try {
      const skillDir = path.dirname(resolvedPath)
      const watcher = fs.watch(skillDir, (eventType, filename) => {
        if (!filename || !filename.includes('skill')) {
          return
        }

        // Debounce rapid changes
        const existingTimer = this.watching.get(resolvedPath)
        if (existingTimer) {
          clearTimeout(existingTimer)
        }

        const timer = setTimeout(async () => {
          try {
            console.log(`[watcher] Change detected in ${filename}`)

            // Emit reload event
            this.emit('reload', { skillPath: resolvedPath, timestamp: Date.now() })

            // Call handler if provided
            if (this.config.onReload) {
              await this.config.onReload(resolvedPath)
            }
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            console.error(`[watcher] Reload failed: ${error.message}`)

            if (this.config.onError) {
              this.config.onError(error)
            }

            this.emit('error', error)
          }

          this.watching.delete(resolvedPath)
        }, DEBOUNCE_MS)

        this.watching.set(resolvedPath, timer)
      })

      this.watchers.set(resolvedPath, watcher)
      console.log(`[watcher] ✓ Watching: ${resolvedPath}`)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      console.error(`[watcher] Failed to watch: ${error.message}`)
      throw error
    }
  }

  /**
   * Stop watching a skill file
   */
  unwatch(skillPath: string): void {
    const resolvedPath = path.resolve(skillPath)
    const watcher = this.watchers.get(resolvedPath)

    if (watcher) {
      watcher.close()
      this.watchers.delete(resolvedPath)
      console.log(`[watcher] Stopped watching: ${resolvedPath}`)
    }

    const timer = this.watching.get(resolvedPath)
    if (timer) {
      clearTimeout(timer)
      this.watching.delete(resolvedPath)
    }
  }

  /**
   * Stop watching all skills
   */
  unwatchAll(): void {
    for (const [skillPath] of this.watchers) {
      this.unwatch(skillPath)
    }
  }

  /**
   * Get list of watched skills
   */
  getWatched(): string[] {
    return Array.from(this.watchers.keys())
  }

  /**
   * Check if a skill is being watched
   */
  isWatching(skillPath: string): boolean {
    return this.watchers.has(path.resolve(skillPath))
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.unwatchAll()
    this.removeAllListeners()
  }
}

/**
 * Global watcher instance
 */
let globalWatcher: SkillWatcher | null = null

/**
 * Get or create global watcher
 */
export function getSkillWatcher(config?: WatcherConfig): SkillWatcher {
  if (!globalWatcher) {
    globalWatcher = new SkillWatcher(config)
  }
  return globalWatcher
}

/**
 * Cleanup global watcher
 */
export function destroySkillWatcher(): void {
  if (globalWatcher) {
    globalWatcher.destroy()
    globalWatcher = null
  }
}
