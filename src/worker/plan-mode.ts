/**
 * PlanMode — Permission system for controlling blast radius.
 *
 * 4 modes:
 *   ANALYSIS   → Read-only research with network + MCP
 *   READONLY   → Strict read-only, no bash/network/MCP
 *   SANDBOX    → Write + bash locally, no network
 *   PRODUCTION → Full permissions (everything)
 *
 * Ported from JARVIS 5.0 plan-mode.js.
 */

import { EventEmitter } from 'events'

export type PlanModeType = 'ANALYSIS' | 'READONLY' | 'SANDBOX' | 'PRODUCTION'
export type ActionType = 'read' | 'write' | 'bash' | 'network' | 'mcp'

export interface PermissionResult {
  allowed: boolean
  reason?: string
}

export interface PlanModeConfig {
  mode: PlanModeType
  allowWrite: boolean
  allowBash: boolean
  allowNetwork: boolean
  allowMcp: boolean
  readonlyPaths?: string[]
}

export class PlanMode extends EventEmitter {
  private config: PlanModeConfig
  private active = false

  constructor(config: Partial<PlanModeConfig> = {}) {
    super()
    this.config = {
      mode: config.mode || 'PRODUCTION',
      allowWrite: config.allowWrite !== false,
      allowBash: config.allowBash !== false,
      allowNetwork: config.allowNetwork !== false,
      allowMcp: config.allowMcp !== false,
      readonlyPaths: config.readonlyPaths || [],
    }
  }

  activate(): void {
    this.active = true
    this.emit('activated', { mode: this.config.mode })
    console.log(`[PlanMode] Activated: ${this.config.mode}`)
  }

  deactivate(): void {
    this.active = false
    this.emit('deactivated')
    console.log(`[PlanMode] Deactivated`)
  }

  canRead(): boolean {
    return true
  }

  canWrite(filePath?: string): boolean {
    if (!this.active) return true
    if (this.config.mode === 'READONLY' || this.config.mode === 'ANALYSIS') {
      return false
    }

    if (filePath && this.config.readonlyPaths) {
      for (const readonlyPath of this.config.readonlyPaths) {
        if (filePath.startsWith(readonlyPath)) {
          return false
        }
      }
    }

    return this.config.allowWrite
  }

  canBash(): boolean {
    if (!this.active) return true
    if (this.config.mode === 'ANALYSIS' || this.config.mode === 'READONLY') {
      return false
    }
    return this.config.allowBash
  }

  canNetwork(): boolean {
    if (!this.active) return true
    if (this.config.mode === 'SANDBOX') {
      return false
    }
    return this.config.allowNetwork
  }

  canMcp(): boolean {
    if (!this.active) return true
    return this.config.allowMcp
  }

  setMode(mode: PlanModeType): void {
    if (!['ANALYSIS', 'READONLY', 'SANDBOX', 'PRODUCTION'].includes(mode)) {
      throw new Error(`Invalid mode: ${mode}`)
    }
    this.config.mode = mode
    this.emit('mode-changed', { mode })
  }

  getMode(): PlanModeType {
    return this.config.mode
  }

  getRestrictions() {
    return {
      write: !this.config.allowWrite,
      bash: !this.config.allowBash,
      network: !this.config.allowNetwork,
      mcp: !this.config.allowMcp,
      readonlyPaths: this.config.readonlyPaths,
    }
  }
}

export class PlanModeManager extends EventEmitter {
  private modes: Map<string, PlanMode> = new Map()
  private current: PlanMode | null = null

  constructor() {
    super()
    this.initDefaults()
  }

  private initDefaults(): void {
    this.register('ANALYSIS', {
      mode: 'ANALYSIS',
      allowWrite: false,
      allowBash: false,
      allowNetwork: true,
      allowMcp: true,
    })

    this.register('READONLY', {
      mode: 'READONLY',
      allowWrite: false,
      allowBash: false,
      allowNetwork: false,
      allowMcp: false,
    })

    this.register('SANDBOX', {
      mode: 'SANDBOX',
      allowWrite: true,
      allowBash: true,
      allowNetwork: false,
      allowMcp: true,
    })

    this.register('PRODUCTION', {
      mode: 'PRODUCTION',
      allowWrite: true,
      allowBash: true,
      allowNetwork: true,
      allowMcp: true,
    })
  }

  register(name: string, config: Partial<PlanModeConfig>): PlanMode {
    const mode = new PlanMode(config)
    this.modes.set(name, mode)

    mode.on('activated', (data) => this.emit('mode-activated', { name, ...data }))
    mode.on('deactivated', () => this.emit('mode-deactivated', { name }))

    return mode
  }

  activate(name: string): { status: string; name: string } | { error: string } {
    if (this.current) {
      this.current.deactivate()
    }

    const mode = this.modes.get(name)
    if (mode) {
      mode.activate()
      this.current = mode
      return { status: 'activated', name }
    }

    return { error: `Mode not found: ${name}` }
  }

  deactivate(): void {
    if (this.current) {
      this.current.deactivate()
      this.current = null
    }
  }

  getCurrent(): PlanModeType | null {
    return this.current?.getMode() || null
  }

  list(): string[] {
    return Array.from(this.modes.keys())
  }

  checkPermission(action: ActionType, target?: string): PermissionResult {
    if (!this.current) {
      return { allowed: true }
    }

    switch (action) {
      case 'read':
        return { allowed: this.current.canRead() }
      case 'write':
        return { allowed: this.current.canWrite(target) }
      case 'bash':
        return { allowed: this.current.canBash() }
      case 'network':
        return { allowed: this.current.canNetwork() }
      case 'mcp':
        return { allowed: this.current.canMcp() }
      default:
        return { allowed: true, reason: 'unknown action' }
    }
  }

  getCurrentPermissions() {
    if (!this.current) {
      return {
        write: true,
        bash: true,
        network: true,
        mcp: true,
      }
    }

    return this.current.getRestrictions()
  }
}
