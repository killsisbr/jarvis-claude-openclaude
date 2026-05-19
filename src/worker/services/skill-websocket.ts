/**
 * Skill WebSocket manager — broadcast reload events to connected clients.
 *
 * Handles WebSocket connections and notifies clients of skill changes.
 */

import { WebSocket, WebSocketServer } from 'ws'
import { Server } from 'http'
import { EventEmitter } from 'events'

export interface SkillMessage {
  type: 'reload-start' | 'reload-success' | 'reload-error' | 'list-updated' | 'ping' | 'pong'
  skill?: string
  error?: string
  skills?: string[]
  latencyMs?: number
  timestamp: number
}

export class SkillWebSocketManager extends EventEmitter {
  private wss: WebSocketServer | null = null
  private clients = new Set<WebSocket>()
  private heartbeatInterval: NodeJS.Timeout | null = null

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: Server, path: string = '/ws/skills'): void {
    try {
      this.wss = new WebSocketServer({ server: httpServer, path })

      this.wss.on('connection', (ws) => {
        console.log('[ws-skills] Client connected')
        this.clients.add(ws)

        // Send welcome message
        this.sendMessage(ws, {
          type: 'ping',
          timestamp: Date.now(),
        })

        // Handle messages
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString()) as SkillMessage

            if (msg.type === 'pong') {
              // Handle ping/pong
            }
          } catch (err) {
            console.warn('[ws-skills] Failed to parse message:', err instanceof Error ? err.message : String(err))
          }
        })

        // Handle disconnect
        ws.on('close', () => {
          console.log('[ws-skills] Client disconnected')
          this.clients.delete(ws)
        })

        ws.on('error', (err) => {
          console.error('[ws-skills] Client error:', err.message)
          this.clients.delete(ws)
        })
      })

      // Start heartbeat
      this.startHeartbeat()

      console.log(`[ws-skills] ✓ WebSocket server initialized on ${path}`)
    } catch (err) {
      console.error('[ws-skills] Failed to initialize:', err instanceof Error ? err.message : String(err))
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(msg: SkillMessage): void {
    const payload = JSON.stringify(msg)

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload).catch((err) => {
          console.warn('[ws-skills] Failed to send:', err instanceof Error ? err.message : String(err))
          this.clients.delete(client)
        })
      }
    }
  }

  /**
   * Send message to specific client
   */
  sendMessage(client: WebSocket, msg: SkillMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(msg)).catch((err) => {
        console.warn('[ws-skills] Failed to send:', err instanceof Error ? err.message : String(err))
      })
    }
  }

  /**
   * Notify reload start
   */
  notifyReloadStart(skillName: string): void {
    this.broadcast({
      type: 'reload-start',
      skill: skillName,
      timestamp: Date.now(),
    })
  }

  /**
   * Notify reload success
   */
  notifyReloadSuccess(skillName: string, latencyMs: number): void {
    this.broadcast({
      type: 'reload-success',
      skill: skillName,
      latencyMs,
      timestamp: Date.now(),
    })
  }

  /**
   * Notify reload error
   */
  notifyReloadError(skillName: string, error: string): void {
    this.broadcast({
      type: 'reload-error',
      skill: skillName,
      error,
      timestamp: Date.now(),
    })
  }

  /**
   * Notify skills list updated
   */
  notifyListUpdated(skills: string[]): void {
    this.broadcast({
      type: 'list-updated',
      skills,
      timestamp: Date.now(),
    })
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size
  }

  /**
   * Start heartbeat (keep connections alive)
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.ping().catch(() => {
            this.clients.delete(client)
          })
        }
      }
    }, 30000) // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopHeartbeat()

    if (this.wss) {
      this.wss.close()
      this.wss = null
    }

    this.clients.clear()
    this.removeAllListeners()
  }
}

/**
 * Global WebSocket manager
 */
let globalManager: SkillWebSocketManager | null = null

/**
 * Get or create global manager
 */
export function getSkillWebSocketManager(): SkillWebSocketManager {
  if (!globalManager) {
    globalManager = new SkillWebSocketManager()
  }
  return globalManager
}

/**
 * Cleanup global manager
 */
export function destroySkillWebSocketManager(): void {
  if (globalManager) {
    globalManager.destroy()
    globalManager = null
  }
}
