import { join } from "path";
import { homedir } from "os";

const DB_PATH = join(homedir(), ".jarvis", "worker.db");

let db: any = null;

export function getDatabase() {
  if (!db) {
    const Database = require("bun:sqlite").Database;
    db = new Database(DB_PATH);
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA foreign_keys = ON");
    initializeSchema();
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function initializeSchema(): void {
  const database = db;

  // Sessions table
  database.run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('CRIADO', 'ANALISANDO', 'ATIVO', 'AGUARDANDO', 'COMPLETO', 'FECHADO')),
    currentProject TEXT,
    currentIntent TEXT,
    idleSince INTEGER,
    autoCloseAt INTEGER,
    createdAt INTEGER NOT NULL,
    lastActiveAt INTEGER NOT NULL,
    UNIQUE(userId, state, createdAt)
  )`);

  // Messages table
  database.run(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sessionId TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    tokens INTEGER,
    cost REAL,
    metadata TEXT,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY(sessionId) REFERENCES sessions(id)
  )`);

  // Budget daily table
  database.run(`CREATE TABLE IF NOT EXISTS budget_daily (
    id TEXT PRIMARY KEY,
    user_phone TEXT NOT NULL,
    date TEXT NOT NULL,
    cost REAL DEFAULT 0,
    tokens INTEGER DEFAULT 0,
    UNIQUE(user_phone, date)
  )`);

  // Entities (knowledge graph nodes)
  database.run(`CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    properties TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    extractedAt INTEGER,
    lastAccessedAt INTEGER
  )`);

  // Create index for entities
  database.run(`CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_entities_weight ON entities(weight)`);

  // Relations (knowledge graph edges)
  database.run(`CREATE TABLE IF NOT EXISTS relations (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    target TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    extractedAt INTEGER,
    FOREIGN KEY(source) REFERENCES entities(id),
    FOREIGN KEY(target) REFERENCES entities(id),
    UNIQUE(source, target, type)
  )`);

  // Create indexes for relations
  database.run(`CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(type)`);

  // Learnings (spaced repetition)
  database.run(`CREATE TABLE IF NOT EXISTS learnings (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    category TEXT,
    content TEXT NOT NULL,
    confidence REAL DEFAULT 0.5,
    relevance REAL DEFAULT 1.0,
    reviewCount INTEGER DEFAULT 0,
    nextReviewAt INTEGER NOT NULL,
    lastReviewAt INTEGER,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
  )`);

  // Create indexes for learnings
  database.run(`CREATE INDEX IF NOT EXISTS idx_learnings_nextReview ON learnings(nextReviewAt)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_learnings_relevance ON learnings(relevance)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_learnings_category ON learnings(category)`);

  // Learning index (cross-reference + review tracking)
  database.run(`CREATE TABLE IF NOT EXISTS learning_index (
    id TEXT PRIMARY KEY,
    learningId TEXT NOT NULL REFERENCES learnings(id) ON DELETE CASCADE,
    userId TEXT NOT NULL,
    lastReviewAt INTEGER,
    nextReviewAt INTEGER,
    reviewOrder INTEGER,
    FOREIGN KEY(learningId) REFERENCES learnings(id),
    UNIQUE(learningId, userId)
  )`);

  // Create indexes for learning_index
  database.run(`CREATE INDEX IF NOT EXISTS idx_learning_index_user ON learning_index(userId)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_learning_index_nextReview ON learning_index(nextReviewAt)`);

  console.log("[schema] ✓ Database schema initialized");
}

// Helper functions
export function beginTransaction(): void {
  getDatabase().run("BEGIN TRANSACTION");
}

export function commit(): void {
  getDatabase().run("COMMIT");
}

export function rollback(): void {
  getDatabase().run("ROLLBACK");
}

export function withTransaction<T>(fn: () => T): T {
  const database = getDatabase();
  database.run("BEGIN TRANSACTION");
  try {
    const result = fn();
    database.run("COMMIT");
    return result;
  } catch (error) {
    database.run("ROLLBACK");
    throw error;
  }
}
