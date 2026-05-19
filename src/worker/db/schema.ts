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

  // Approval requests (Fase 5)
  database.run(`CREATE TABLE IF NOT EXISTS approval_requests (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    action TEXT NOT NULL,
    params TEXT NOT NULL,
    dangerLevel TEXT NOT NULL CHECK(dangerLevel IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'denied')) DEFAULT 'pending',
    createdAt INTEGER NOT NULL,
    respondedAt INTEGER,
    respondedBy TEXT,
    responseReason TEXT,
    expiresAt INTEGER NOT NULL,
    FOREIGN KEY(userId) REFERENCES sessions(userId)
  )`);

  database.run(`CREATE INDEX IF NOT EXISTS idx_approval_pending ON approval_requests(status, expiresAt)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_approval_user ON approval_requests(userId)`);

  // Action history (Fase 5)
  database.run(`CREATE TABLE IF NOT EXISTS action_history (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    action TEXT NOT NULL,
    cost REAL DEFAULT 0,
    status TEXT NOT NULL CHECK(status IN ('pending', 'executing', 'success', 'failed')) DEFAULT 'pending',
    checkpointId TEXT,
    createdAt INTEGER NOT NULL,
    completedAt INTEGER,
    errorMsg TEXT,
    FOREIGN KEY(userId) REFERENCES sessions(userId)
  )`);

  database.run(`CREATE INDEX IF NOT EXISTS idx_action_user ON action_history(userId)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_action_status ON action_history(status)`);

  // User preferences (Proactive Learning)
  database.run(`CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL DEFAULT 0.5,
    observed_count INTEGER DEFAULT 1,
    last_updated_at INTEGER NOT NULL,
    UNIQUE(user_id, category, value)
  )`);

  database.run(`CREATE INDEX IF NOT EXISTS idx_user_prefs_user_id ON user_preferences(user_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_user_prefs_category ON user_preferences(category)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_user_prefs_confidence ON user_preferences(confidence DESC)`);

  // Cached contexts (Smart Cache - Turbo Mode)
  database.run(`CREATE TABLE IF NOT EXISTS cached_contexts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    model TEXT NOT NULL,
    system_prompt_hash TEXT NOT NULL,
    messages BLOB NOT NULL,
    last_message TEXT NOT NULL,
    hit_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL
  )`);

  database.run(`CREATE INDEX IF NOT EXISTS idx_cached_context_user ON cached_contexts(user_id)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_cached_context_last_used ON cached_contexts(last_used_at)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_cached_context_model ON cached_contexts(model)`);

  // Routing metrics (Auto-Evolve monitoring)
  database.run(`CREATE TABLE IF NOT EXISTS routing_metrics (
    id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    intent TEXT NOT NULL,
    latency_p50 INTEGER,
    latency_p95 INTEGER,
    latency_p99 INTEGER,
    cost_avg REAL,
    success_rate REAL,
    sample_count INTEGER DEFAULT 1,
    recorded_at INTEGER NOT NULL,
    UNIQUE(model, intent, recorded_at)
  )`);

  database.run(`CREATE INDEX IF NOT EXISTS idx_routing_metrics_model ON routing_metrics(model)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_routing_metrics_intent ON routing_metrics(intent)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_routing_metrics_recorded ON routing_metrics(recorded_at DESC)`);

  // Routing weights history (Auto-Evolve decisions)
  database.run(`CREATE TABLE IF NOT EXISTS routing_weights_history (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    weights BLOB NOT NULL,
    source TEXT NOT NULL,
    canary_improvement REAL,
    applied_at INTEGER
  )`);

  database.run(`CREATE INDEX IF NOT EXISTS idx_routing_weights_timestamp ON routing_weights_history(timestamp DESC)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_routing_weights_source ON routing_weights_history(source)`);

  // API Users for remote authentication
  database.run(`CREATE TABLE IF NOT EXISTS api_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    is_admin BOOLEAN DEFAULT 0,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER,
    is_active BOOLEAN DEFAULT 1
  )`);

  database.run(`CREATE INDEX IF NOT EXISTS idx_api_users_api_key ON api_users(api_key)`);
  database.run(`CREATE INDEX IF NOT EXISTS idx_api_users_username ON api_users(username)`);

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
