import { getDatabase, withTransaction } from "./schema";

export interface Learning {
  id: string;
  type: string;
  category?: string;
  content: string;
  confidence: number; // 0-1
  relevance: number; // 0-1, decays over time
  reviewCount: number;
  nextReviewAt: number;
  lastReviewAt?: number;
  createdAt: number;
  updatedAt: number;
}

const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60];
const DECAY_RATE = 0.02; // 2% per day inactive
const GC_THRESHOLD_RELEVANCE = 0.05;
const GC_THRESHOLD_DAYS = 90;

export function proposeLearning(learning: Omit<Learning, "id" | "reviewCount" | "nextReviewAt" | "createdAt" | "updatedAt" | "lastReviewAt">): Learning {
  const id = `learning-${Date.now()}-${Math.random()}`;
  const now = Date.now();
  const nextReviewAt = now + REVIEW_INTERVALS_DAYS[0] * 24 * 60 * 60 * 1000;

  return {
    ...learning,
    id,
    reviewCount: 0,
    nextReviewAt,
    createdAt: now,
    updatedAt: now,
  };
}

export function registerLearning(learning: Learning): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO learnings (id, type, category, content, confidence, relevance, reviewCount, nextReviewAt, lastReviewAt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    learning.id,
    learning.type,
    learning.category,
    learning.content,
    learning.confidence,
    learning.relevance,
    learning.reviewCount,
    learning.nextReviewAt,
    learning.lastReviewAt,
    learning.createdAt,
    learning.updatedAt
  );

  console.log(`[learnings] Registered learning ${learning.id} (${learning.type})`);
}

export function getLearning(id: string): Learning | null {
  const db = getDatabase();

  const stmt = db.prepare("SELECT * FROM learnings WHERE id = ?");
  const record = stmt.get(id) as any;

  if (!record) return null;

  return {
    id: record.id,
    type: record.type,
    category: record.category,
    content: record.content,
    confidence: record.confidence,
    relevance: record.relevance,
    reviewCount: record.reviewCount,
    nextReviewAt: record.nextReviewAt,
    lastReviewAt: record.lastReviewAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function updateLearningReview(id: string, successful: boolean): void {
  const db = getDatabase();

  const learning = getLearning(id);
  if (!learning) return;

  const nextIntervalIndex = Math.min(learning.reviewCount + 1, REVIEW_INTERVALS_DAYS.length - 1);
  const nextReviewAt = Date.now() + REVIEW_INTERVALS_DAYS[nextIntervalIndex] * 24 * 60 * 60 * 1000;

  // Adjust confidence based on review result
  const newConfidence = successful ? Math.min(learning.confidence + 0.1, 1.0) : Math.max(learning.confidence - 0.2, 0);

  const stmt = db.prepare(`
    UPDATE learnings
    SET reviewCount = ?, nextReviewAt = ?, lastReviewAt = ?, confidence = ?, updatedAt = ?
    WHERE id = ?
  `);

  stmt.run(learning.reviewCount + 1, nextReviewAt, Date.now(), newConfidence, Date.now(), id);
}

export function applyDecay(): void {
  const db = getDatabase();

  // Calculate relevance decay for all learnings
  withTransaction(() => {
    const learnings = db.prepare("SELECT * FROM learnings").all() as any[];

    for (const learning of learnings) {
      const daysSinceUpdate = (Date.now() - learning.updatedAt) / (24 * 60 * 60 * 1000);
      const decayFactor = Math.pow(1 - DECAY_RATE, daysSinceUpdate);
      const newRelevance = learning.relevance * decayFactor;

      const stmt = db.prepare("UPDATE learnings SET relevance = ?, updatedAt = ? WHERE id = ?");
      stmt.run(newRelevance, Date.now(), learning.id);
    }
  });

  console.log("[learnings] Applied decay to all learnings");
}

export function garbageCollect(): void {
  const db = getDatabase();

  const threshold = Date.now() - GC_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  const toDelete = db
    .prepare(
      `
    SELECT id FROM learnings
    WHERE relevance < ? AND updatedAt < ? AND confidence < 0.5
  `
    )
    .all(GC_THRESHOLD_RELEVANCE, threshold) as { id: string }[];

  if (toDelete.length > 0) {
    withTransaction(() => {
      const stmt = db.prepare("DELETE FROM learnings WHERE id = ?");
      for (const { id } of toDelete) {
        stmt.run(id);
      }
    });

    console.log(`[learnings] GC removed ${toDelete.length} old learnings`);
  }
}

export function getReviewDue(userId: string, limit = 10): Learning[] {
  const db = getDatabase();

  const now = Date.now();

  const stmt = db.prepare(`
    SELECT l.* FROM learnings l
    WHERE l.nextReviewAt <= ?
    ORDER BY l.relevance DESC, l.confidence DESC
    LIMIT ?
  `);

  const records = stmt.all(now, limit) as any[];

  return records.map((r) => ({
    id: r.id,
    type: r.type,
    category: r.category,
    content: r.content,
    confidence: r.confidence,
    relevance: r.relevance,
    reviewCount: r.reviewCount,
    nextReviewAt: r.nextReviewAt,
    lastReviewAt: r.lastReviewAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export function getStats(): {
  total: number;
  reviewDue: number;
  avgConfidence: number;
  avgRelevance: number;
} {
  const db = getDatabase();

  const totalStmt = db.prepare("SELECT COUNT(*) as count FROM learnings");
  const dueStmt = db.prepare("SELECT COUNT(*) as count FROM learnings WHERE nextReviewAt <= ?");
  const confStmt = db.prepare("SELECT AVG(confidence) as avg FROM learnings");
  const relStmt = db.prepare("SELECT AVG(relevance) as avg FROM learnings");

  return {
    total: (totalStmt.get() as { count: number }).count,
    reviewDue: (dueStmt.get(Date.now()) as { count: number }).count,
    avgConfidence: (confStmt.get() as { avg: number | null }).avg ?? 0,
    avgRelevance: (relStmt.get() as { avg: number | null }).avg ?? 0,
  };
}

export function getAllLearnings(): Learning[] {
  const db = getDatabase();

  const stmt = db.prepare("SELECT * FROM learnings ORDER BY relevance DESC");
  const records = stmt.all() as any[];

  return records.map((r) => ({
    id: r.id,
    type: r.type,
    category: r.category,
    content: r.content,
    confidence: r.confidence,
    relevance: r.relevance,
    reviewCount: r.reviewCount,
    nextReviewAt: r.nextReviewAt,
    lastReviewAt: r.lastReviewAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}
