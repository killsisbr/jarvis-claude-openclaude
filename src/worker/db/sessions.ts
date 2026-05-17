import { getDatabase, withTransaction } from "./schema";
import type { ChatSession } from "../chat-session";

export interface SessionRecord {
  id: string;
  userId: string;
  state: string;
  currentProject?: string;
  currentIntent?: string;
  idleSince?: number;
  autoCloseAt?: number;
  createdAt: number;
  lastActiveAt: number;
}

export interface MessageRecord {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  tokens?: number;
  cost?: number;
  metadata?: string;
  timestamp: number;
}

const SESSIONS_MAP = new Map<string, ChatSession>();

export function getOrCreateSession(userId: string): ChatSession {
  // Check if already in memory
  const existing = SESSIONS_MAP.get(userId);
  if (existing) return existing;

  // Try to load from DB
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM sessions
    WHERE userId = ? AND state NOT IN ('COMPLETO', 'FECHADO')
    ORDER BY lastActiveAt DESC
    LIMIT 1
  `);
  const record = stmt.get(userId) as SessionRecord | undefined;

  let session: ChatSession;
  if (record) {
    // Restore from DB
    session = new ChatSession(userId);
    // Restore state from DB record
    const metadata = {
      dbId: record.id,
      currentProject: record.currentProject,
      currentIntent: record.currentIntent,
      messageCount: getMessageCount(record.id),
      totalTokens: getTotalTokens(record.id),
      totalCost: getTotalCost(record.id),
    };
    for (const [key, value] of Object.entries(metadata)) {
      session.setMetadata(key, value);
    }
    console.log(`[sessions] Restored session ${record.id} for user ${userId}`);
  } else {
    // Create new
    session = new ChatSession(userId);
    const sessionId = `${userId}-${Date.now()}`;
    session.setMetadata("dbId", sessionId);
    console.log(`[sessions] Created new session ${sessionId} for user ${userId}`);
  }

  SESSIONS_MAP.set(userId, session);
  return session;
}

export function getSession(sessionId: string): ChatSession | undefined {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM sessions WHERE id = ?");
  const record = stmt.get(sessionId) as SessionRecord | undefined;

  if (!record) return undefined;

  // Check if in memory
  const existing = SESSIONS_MAP.get(record.userId);
  if (existing && existing.getMetadata("dbId") === sessionId) {
    return existing;
  }

  // Restore and return
  const session = new ChatSession(record.userId);
  session.setMetadata("dbId", sessionId);
  return session;
}

export function updateSession(sessionId: string, updates: Partial<SessionRecord>): void {
  const db = getDatabase();

  withTransaction(() => {
    const stmt = db.prepare(`
      UPDATE sessions
      SET state = COALESCE(?, state),
          currentProject = COALESCE(?, currentProject),
          currentIntent = COALESCE(?, currentIntent),
          idleSince = COALESCE(?, idleSince),
          autoCloseAt = COALESCE(?, autoCloseAt),
          lastActiveAt = COALESCE(?, lastActiveAt)
      WHERE id = ?
    `);

    stmt.run(
      updates.state,
      updates.currentProject,
      updates.currentIntent,
      updates.idleSince,
      updates.autoCloseAt,
      updates.lastActiveAt || Date.now(),
      sessionId
    );
  });
}

export function saveSession(sessionId: string, session: ChatSession): void {
  const db = getDatabase();
  const data = session.getData();

  withTransaction(() => {
    const check = db.prepare("SELECT id FROM sessions WHERE id = ?").get(sessionId);

    if (check) {
      const stmt = db.prepare(`
        UPDATE sessions
        SET state = ?, currentProject = ?, currentIntent = ?, lastActiveAt = ?
        WHERE id = ?
      `);
      stmt.run(data.state, data.currentProject, data.currentIntent, Date.now(), sessionId);
    } else {
      const stmt = db.prepare(`
        INSERT INTO sessions (id, userId, state, currentProject, currentIntent, createdAt, lastActiveAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(sessionId, data.userId, data.state, data.currentProject, data.currentIntent, Date.now(), Date.now());
    }
  });
}

export function saveMessage(sessionId: string, role: "user" | "assistant", content: string, tokens = 0, cost = 0): void {
  const db = getDatabase();
  const messageId = `${sessionId}-${Date.now()}-${Math.random()}`;

  const stmt = db.prepare(`
    INSERT INTO messages (id, sessionId, role, content, tokens, cost, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(messageId, sessionId, role, content, tokens, cost, Date.now());
}

export function getMessages(sessionId: string): MessageRecord[] {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM messages WHERE sessionId = ? ORDER BY timestamp ASC");
  return stmt.all(sessionId) as MessageRecord[];
}

export function getMessageCount(sessionId: string): number {
  const db = getDatabase();
  const stmt = db.prepare("SELECT COUNT(*) as count FROM messages WHERE sessionId = ?");
  const result = stmt.get(sessionId) as { count: number };
  return result.count;
}

export function getTotalTokens(sessionId: string): number {
  const db = getDatabase();
  const stmt = db.prepare("SELECT COALESCE(SUM(tokens), 0) as total FROM messages WHERE sessionId = ?");
  const result = stmt.get(sessionId) as { total: number };
  return result.total;
}

export function getTotalCost(sessionId: string): number {
  const db = getDatabase();
  const stmt = db.prepare("SELECT COALESCE(SUM(cost), 0) as total FROM messages WHERE sessionId = ?");
  const result = stmt.get(sessionId) as { total: number };
  return result.total;
}

export function closeSessions(sessionIds: string[]): void {
  if (sessionIds.length === 0) return;

  const db = getDatabase();
  const placeholders = sessionIds.map(() => "?").join(",");

  withTransaction(() => {
    const stmt = db.prepare(`UPDATE sessions SET state = 'FECHADO', lastActiveAt = ? WHERE id IN (${placeholders})`);
    stmt.run(Date.now(), ...sessionIds);
  });

  // Remove from memory
  for (const sessionId of sessionIds) {
    for (const [userId, session] of SESSIONS_MAP) {
      if (session.getMetadata("dbId") === sessionId) {
        SESSIONS_MAP.delete(userId);
      }
    }
  }
}

export function getActiveSessions(): SessionRecord[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM sessions
    WHERE state NOT IN ('COMPLETO', 'FECHADO')
    ORDER BY lastActiveAt DESC
  `);
  return stmt.all() as SessionRecord[];
}

export function getStats(): { total: number; active: number; costToday: number; tokensToday: number } {
  const db = getDatabase();

  const totalStmt = db.prepare("SELECT COUNT(*) as count FROM sessions");
  const activeStmt = db.prepare(`SELECT COUNT(*) as count FROM sessions WHERE state NOT IN ('COMPLETO', 'FECHADO')`);
  const costStmt = db.prepare(`
    SELECT COALESCE(SUM(cost), 0) as total
    FROM budget_daily
    WHERE date = date('now')
  `);
  const tokensStmt = db.prepare(`
    SELECT COALESCE(SUM(tokens), 0) as total
    FROM budget_daily
    WHERE date = date('now')
  `);

  return {
    total: (totalStmt.get() as { count: number }).count,
    active: (activeStmt.get() as { count: number }).count,
    costToday: (costStmt.get() as { total: number }).total,
    tokensToday: (tokensStmt.get() as { total: number }).total,
  };
}

export function evictExpiredSessions(): void {
  const db = getDatabase();

  // Find sessions idle > 24h
  const expiredStmt = db.prepare(`
    SELECT id FROM sessions
    WHERE state NOT IN ('COMPLETO', 'FECHADO')
    AND lastActiveAt < ?
  `);

  const now = Date.now();
  const expiryTime = now - 24 * 60 * 60 * 1000; // 24 hours
  const expired = expiredStmt.all(expiryTime) as { id: string }[];

  if (expired.length > 0) {
    const ids = expired.map((r) => r.id);
    closeSessions(ids);
    console.log(`[sessions] Evicted ${ids.length} expired sessions`);
  }
}
