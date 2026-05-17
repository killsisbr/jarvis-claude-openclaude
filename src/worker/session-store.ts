/**
 * session-store — gerenciamento de sessões em memória.
 *
 * Fase 1: sem SQLite, sessões vivem apenas enquanto o processo roda.
 * Fase 4 vai substituir por persistência SQLite.
 */

export type Message = {
  role: 'user' | 'assistant'
  content: string
}

export type Session = {
  id: string
  userId: string
  messages: Message[]
  turnCount: number
  tokenCount: number
  costUsd: number
  createdAt: Date
  lastActiveAt: Date
}

/** TTL padrão: 2 horas de inatividade */
const SESSION_TTL_MS = 2 * 60 * 60 * 1000

const sessions = new Map<string, Session>()

/** Cria ou recupera sessão por userId. Uma sessão ativa por usuário. */
export function getOrCreateSession(userId: string): Session {
  const existing = getActiveSessionForUser(userId)
  if (existing) {
    existing.lastActiveAt = new Date()
    return existing
  }

  const session: Session = {
    id: `${userId}-${Date.now()}`,
    userId,
    messages: [],
    turnCount: 0,
    tokenCount: 0,
    costUsd: 0,
    createdAt: new Date(),
    lastActiveAt: new Date(),
  }
  sessions.set(session.id, session)
  return session
}

export function getSession(sessionId: string): Session | null {
  return sessions.get(sessionId) ?? null
}

export function updateSession(
  sessionId: string,
  updates: Partial<Pick<Session, 'messages' | 'turnCount' | 'tokenCount' | 'costUsd' | 'lastActiveAt'>>,
): void {
  const session = sessions.get(sessionId)
  if (!session) return
  Object.assign(session, updates)
}

export function getActiveSessions(): Session[] {
  return Array.from(sessions.values()).filter(isSessionActive)
}

export function getStats(): { total: number; active: number; costToday: number } {
  const active = getActiveSessions()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const costToday = Array.from(sessions.values())
    .filter((s) => s.createdAt >= today)
    .reduce((sum, s) => sum + s.costUsd, 0)

  return {
    total: sessions.size,
    active: active.length,
    costToday,
  }
}

function getActiveSessionForUser(userId: string): Session | null {
  for (const session of sessions.values()) {
    if (session.userId === userId && isSessionActive(session)) {
      return session
    }
  }
  return null
}

function isSessionActive(session: Session): boolean {
  return Date.now() - session.lastActiveAt.getTime() < SESSION_TTL_MS
}

/** Limpa sessões expiradas. Chamar periodicamente. */
export function evictExpiredSessions(): number {
  let evicted = 0
  for (const [id, session] of sessions) {
    if (!isSessionActive(session)) {
      sessions.delete(id)
      evicted++
    }
  }
  return evicted
}
