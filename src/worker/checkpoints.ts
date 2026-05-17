/**
 * CheckpointManager — File snapshots for safe restore before destructive ops.
 *
 * Creates snapshots of critical files before edit/delete operations.
 * User can restore to any checkpoint.
 *
 * Ported from JARVIS 5.0 checkpoints.js.
 * Persists to ~/.jarvis/checkpoints/ as JSON files.
 */

import { EventEmitter } from 'events'
import * as fs from 'fs'
import * as path from 'path'
import { homedir } from 'os'
import { randomBytes } from 'crypto'

const CHECKPOINTS_DIR = path.join(homedir(), '.jarvis', 'checkpoints')

export interface CheckpointData {
  id: string
  name: string
  description: string
  timestamp: number
  files: Record<string, string> // filePath → content
  metadata: Record<string, unknown>
}

export class Checkpoint {
  id: string
  name: string
  description: string
  timestamp: number
  files: Record<string, string>
  metadata: Record<string, unknown>

  constructor(config: Partial<CheckpointData>) {
    this.id = config.id || randomBytes(8).toString('hex')
    this.name = config.name || 'unnamed'
    this.description = config.description || ''
    this.timestamp = config.timestamp || Date.now()
    this.files = config.files || {}
    this.metadata = config.metadata || {}
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      timestamp: this.timestamp,
      fileCount: Object.keys(this.files).length,
      metadata: this.metadata,
    }
  }
}

export class CheckpointManager extends EventEmitter {
  private checkpoints: Map<string, Checkpoint> = new Map()
  private current: string | null = null
  private readonly MAX_CHECKPOINTS = 50

  constructor() {
    super()
  }

  /**
   * Create checkpoint.
   * Options: {files: {filePath: content, ...}, metadata: {...}}
   */
  async create(
    name: string,
    options: { files?: Record<string, string>; metadata?: Record<string, unknown> } = {}
  ): Promise<Checkpoint> {
    await this.ensureDir()

    const checkpoint = new Checkpoint({
      name,
      timestamp: Date.now(),
      ...options,
    })

    this.checkpoints.set(checkpoint.id, checkpoint)

    if (this.current === null) {
      this.current = checkpoint.id
    }

    await this.save(checkpoint)
    this.emit('created', checkpoint)
    console.log(`[Checkpoints] Created: ${name} (${checkpoint.id})`)

    // Cleanup old checkpoints if over limit
    await this.cleanup()

    return checkpoint
  }

  /**
   * Restore checkpoint.
   * Returns {restored: {filePath: status, ...}}.
   */
  async restore(checkpointId: string): Promise<{
    checkpoint?: Checkpoint
    restored?: Record<string, string>
    error?: string
  }> {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) {
      return { error: `Checkpoint not found: ${checkpointId}` }
    }

    const restored: Record<string, string> = {}

    for (const [filePath, content] of Object.entries(checkpoint.files)) {
      try {
        const dir = path.dirname(filePath)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        fs.writeFileSync(filePath, content)
        restored[filePath] = 'restored'
      } catch (err) {
        restored[filePath] = `error: ${(err as Error).message}`
      }
    }

    this.current = checkpointId
    this.emit('restored', checkpoint)
    console.log(`[Checkpoints] Restored: ${checkpointId} (${Object.keys(restored).length} files)`)

    return { checkpoint, restored }
  }

  /**
   * Get checkpoint by ID.
   */
  get(checkpointId: string): Checkpoint | undefined {
    return this.checkpoints.get(checkpointId)
  }

  /**
   * List all checkpoints (most recent first).
   */
  list(): CheckpointData[] {
    return Array.from(this.checkpoints.values())
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        timestamp: c.timestamp,
        files: c.files,
        metadata: c.metadata,
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get current checkpoint ID.
   */
  getCurrent(): string | null {
    return this.current
  }

  /**
   * Delete checkpoint.
   */
  async delete(checkpointId: string): Promise<boolean> {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) return false

    this.checkpoints.delete(checkpointId)

    const filePath = path.join(CHECKPOINTS_DIR, `${checkpointId}.json`)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    if (this.current === checkpointId) {
      const remaining = this.list()
      this.current = remaining[0]?.id || null
    }

    this.emit('deleted', checkpointId)
    console.log(`[Checkpoints] Deleted: ${checkpointId}`)

    return true
  }

  /**
   * Load all checkpoints from disk.
   */
  async loadAll(): Promise<void> {
    await this.ensureDir()

    try {
      const files = fs.readdirSync(CHECKPOINTS_DIR)

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        const checkpointId = file.replace('.json', '')
        const checkpoint = await this.load(checkpointId)

        if (checkpoint) {
          this.checkpoints.set(checkpoint.id, checkpoint)
        }
      }

      const list = this.list()
      this.current = list[0]?.id || null

      console.log(`[Checkpoints] Loaded ${this.checkpoints.size} checkpoints from disk`)
    } catch (err) {
      console.error(`[Checkpoints] Load failed: ${(err as Error).message}`)
    }
  }

  /**
   * Cleanup old checkpoints if over limit.
   */
  private async cleanup(): Promise<void> {
    const list = this.list()

    if (list.length > this.MAX_CHECKPOINTS) {
      const toDelete = list.slice(this.MAX_CHECKPOINTS)

      for (const cp of toDelete) {
        await this.delete(cp.id)
      }

      console.log(`[Checkpoints] Cleaned up ${toDelete.length} old checkpoints`)
    }
  }

  /**
   * Ensure checkpoint directory exists.
   */
  private async ensureDir(): Promise<void> {
    if (!fs.existsSync(CHECKPOINTS_DIR)) {
      fs.mkdirSync(CHECKPOINTS_DIR, { recursive: true })
    }
  }

  /**
   * Save checkpoint to disk.
   */
  private async save(checkpoint: Checkpoint): Promise<void> {
    await this.ensureDir()

    const filePath = path.join(CHECKPOINTS_DIR, `${checkpoint.id}.json`)
    const data: CheckpointData = {
      id: checkpoint.id,
      name: checkpoint.name,
      description: checkpoint.description,
      timestamp: checkpoint.timestamp,
      files: checkpoint.files,
      metadata: checkpoint.metadata,
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
  }

  /**
   * Load checkpoint from disk.
   */
  private async load(checkpointId: string): Promise<Checkpoint | null> {
    const filePath = path.join(CHECKPOINTS_DIR, `${checkpointId}.json`)

    if (!fs.existsSync(filePath)) {
      return null
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      return new Checkpoint(data)
    } catch (err) {
      console.error(`[Checkpoints] Failed to load ${checkpointId}: ${(err as Error).message}`)
      return null
    }
  }
}

export class BranchManager extends CheckpointManager {
  private branches: Map<string, { name: string; createdAt: number; checkpointId: string | null }> =
    new Map()
  private currentBranch = 'main'

  constructor() {
    super()
    // Initialize default branch
    this.branches.set('main', {
      name: 'main',
      createdAt: Date.now(),
      checkpointId: null,
    })
  }

  /**
   * Create branch from checkpoint.
   */
  createBranch(name: string, fromCheckpoint: string | null = null): {
    name: string
    createdAt: number
    checkpointId: string | null
  } {
    const branch = {
      name,
      createdAt: Date.now(),
      checkpointId: fromCheckpoint || this.getCurrent(),
    }

    this.branches.set(name, branch)
    this.emit('branch-created', branch)
    console.log(`[Branches] Created: ${name}`)

    return branch
  }

  /**
   * Checkout branch.
   */
  checkout(branchName: string): { branch: string; checkpoint: string | null } | { error: string } {
    const branch = this.branches.get(branchName)
    if (!branch) {
      return { error: `Branch not found: ${branchName}` }
    }

    if (branch.checkpointId) {
      // TODO: Restore checkpoint for this branch
    }

    this.currentBranch = branchName
    this.emit('checkout', branchName)
    console.log(`[Branches] Checked out: ${branchName}`)

    return { branch: branchName, checkpoint: branch.checkpointId }
  }

  /**
   * List branches.
   */
  listBranches(): string[] {
    return Array.from(this.branches.keys())
  }

  /**
   * Merge branch.
   */
  merge(
    sourceBranch: string,
    targetBranch = 'main'
  ): { status: string; from: string; to: string } | { error: string } {
    const source = this.branches.get(sourceBranch)
    const target = this.branches.get(targetBranch)

    if (!source || !target) {
      return { error: 'Branch not found' }
    }

    if (source.checkpointId) {
      target.checkpointId = source.checkpointId
    }

    this.emit('merged', { source: sourceBranch, target: targetBranch })
    console.log(`[Branches] Merged: ${sourceBranch} → ${targetBranch}`)

    return { status: 'merged', from: sourceBranch, to: targetBranch }
  }
}
