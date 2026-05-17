# FASE 4 — SQLite + KnowledgeGraph + SpacedRep

**Status**: ✅ Implementado  
**Data**: 2026-05-16  
**Linhas adicionadas**: ~865 LOC

---

## Visão Geral

Fase 4 adiciona **persistência real** ao JARVIS Worker:
- **Session History**: Conversas persistem entre restarts
- **Knowledge Graph**: Entidades + relações para contexto
- **Spaced Repetition**: Learnings com decay automático
- **Auto-Save**: Debounced batch writes (1s delay)

### Arquitetura

```
Dispatcher (Fase 3)
      ↓ (ChatSession + mensagens)
  Auto-Save (batch 1s)
      ↓
  SQLite (better-sqlite3)
      ↓ (7 tabelas)
  ~/.jarvis/worker.db
```

---

## Componentes Implementados

### 1. Database Schema (`src/worker/db/schema.ts`)

**7 Tabelas com índices + transações:**

#### `sessions`
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  state TEXT CHECK(state IN ('CRIADO', 'ANALISANDO', 'ATIVO', 'AGUARDANDO', 'COMPLETO', 'FECHADO')),
  currentProject TEXT,
  currentIntent TEXT,
  idleSince INTEGER,
  autoCloseAt INTEGER,
  createdAt INTEGER NOT NULL,
  lastActiveAt INTEGER NOT NULL
)
```

**Uso**: Rastreia estado de cada conversa do usuário.

#### `messages`
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL REFERENCES sessions(id),
  role TEXT CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens INTEGER,
  cost REAL,
  metadata TEXT,  -- JSON
  timestamp INTEGER NOT NULL
)
```

**Uso**: Histórico completo de mensagens.

#### `budget_daily`
```sql
CREATE TABLE budget_daily (
  user_phone TEXT,
  date TEXT,
  cost REAL DEFAULT 0,
  tokens INTEGER DEFAULT 0,
  PRIMARY KEY (user_phone, date)
)
```

**Uso**: Tracking de gastos diários por usuário (Fase 5).

#### `entities` (Knowledge Graph nodes)
```sql
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT,  -- person, place, concept, error, file
  properties TEXT,  -- JSON
  weight REAL DEFAULT 1.0,
  extractedAt INTEGER,
  lastAccessedAt INTEGER
)
```

#### `relations` (Knowledge Graph edges)
```sql
CREATE TABLE relations (
  id TEXT PRIMARY KEY,
  source TEXT REFERENCES entities(id),
  target TEXT REFERENCES entities(id),
  type TEXT,  -- describes, causes, related_to
  weight REAL DEFAULT 1.0,
  extractedAt INTEGER,
  UNIQUE(source, target, type)
)
```

#### `learnings` (Spaced Repetition)
```sql
CREATE TABLE learnings (
  id TEXT PRIMARY KEY,
  type TEXT,
  category TEXT,
  content TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,  -- 0-1
  relevance REAL DEFAULT 1.0,   -- decays 2% per day
  reviewCount INTEGER DEFAULT 0,
  nextReviewAt INTEGER NOT NULL,
  lastReviewAt INTEGER,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
)
```

**Intervals**: [1, 3, 7, 14, 30, 60] days

#### `learning_index` (Cross-reference)
```sql
CREATE TABLE learning_index (
  id TEXT PRIMARY KEY,
  learningId TEXT REFERENCES learnings(id),
  userId TEXT,
  lastReviewAt INTEGER,
  nextReviewAt INTEGER,
  reviewOrder INTEGER,
  UNIQUE(learningId, userId)
)
```

---

### 2. Auto-Save Pattern (`src/worker/auto-save.ts`)

Generic debounced batch writer:

```typescript
const autoSave = new AutoSave(async (fns) => {
  for (const fn of fns) {
    await fn();
  }
}, { delayMs: 1000 });

// Enqueue saves
await autoSave.enqueue(async () => {
  saveSession(sessionId, session);
});

// Flush on shutdown
await autoSave.shutdown();
```

**Features:**
- 1s delay (configurable)
- Batches up to 100 items
- Auto-retry on error
- Graceful flush on shutdown

---

### 3. Session CRUD (`src/worker/db/sessions.ts`)

```typescript
// Get or create
const session = getOrCreateSession(userId);  // loads from DB if exists

// Save state + messages
saveSession(sessionId, session);
saveMessage(sessionId, "user", content, tokens, cost);

// Query history
const messages = getMessages(sessionId);
const count = getMessageCount(sessionId);
const tokens = getTotalTokens(sessionId);

// Cleanup
evictExpiredSessions();  // close sessions idle > 24h
closeSessions(sessionIds);
```

---

### 4. Knowledge Graph (`src/worker/db/memory.ts`)

**Add entities:**
```typescript
addEntity({
  id: "e-123",
  type: "error",
  properties: { message: "Cannot find module" },
  weight: 0.8
});
```

**Link entities:**
```typescript
linkEntities("e-123", "e-456", "causes", 0.9);
```

**BFS pathfinding:**
```typescript
const related = findConnected("e-123", maxDepth = 2);
// Returns: [{entity, distance, path, weight}, ...]
// Sorted by weight descending
```

**Extract from text:**
```typescript
const entities = extractEntitiesFromText(userMessage, userId);
// Returns entities found in message (quotes, paths, errors, etc.)
```

---

### 5. Spaced Repetition (`src/worker/db/learnings.ts`)

**Register learning:**
```typescript
const learning = proposeLearning({
  type: "error_pattern",
  category: "typescript",
  content: "Type error: unknown type XYZ",
  confidence: 0.7,
  relevance: 1.0
});

registerLearning(learning);
```

**Review pipeline:**
```typescript
const due = getReviewDue(userId, limit = 10);

for (const item of due) {
  // Show to user, get feedback
  const successful = await askUser(item.content);
  
  // Update scheduling
  updateLearningReview(item.id, successful);
  // Confidence increases/decreases
  // nextReviewAt recalculated
}
```

**Decay + GC:**
```typescript
// Run daily (Fase 6 sentinel)
applyDecay();  // relevance *= (1 - 0.02)^days_inactive
garbageCollect();  // remove old + irrelevant items
```

---

## Integração (Fase 4 Changes)

### `worker-core.ts`
```typescript
// Initialize DB on startup
constructor(config: WorkerConfig) {
  // ...
  getDatabase();  // Creates schema if needed
}
```

### `dispatcher.ts`
```typescript
// Auto-save sessions + messages
const autoSave = new AutoSave(...)

await autoSave.enqueue(async () => {
  sessionDb.saveSession(dbSessionId, session);
});

// Flush on shutdown
await dispatcher.shutdown();  // -> autoSave.shutdown()
```

### `main.ts`
```typescript
// Close DB gracefully
try {
  closeDatabase();
} catch (err) {
  console.error('[shutdown] DB error:', err);
}
```

---

## Database File Location

```
~/.jarvis/worker.db
```

Plus WAL mode files:
```
~/.jarvis/worker.db-shm
~/.jarvis/worker.db-wal
```

---

## Performance

| Operation | Target | Notes |
|-----------|--------|-------|
| Session save | < 10ms | Batched every 1s |
| Entity lookup | < 5ms | Indexed by type |
| BFS traversal | < 50ms | Max 100 results |
| Learning review | < 2ms | Indexed by nextReviewAt |

---

## Acceptance Criteria ✅

- ✅ Sessions persist across restarts
- ✅ Message history recovers from DB
- ✅ Knowledge graph BFS finds related entities
- ✅ Spaced repetition schedules reviews
- ✅ Auto-save batches writes (1s delay)
- ✅ Database auto-initializes on startup
- ✅ Graceful shutdown flushes queue
- ✅ Transaction safety (FK + atomicity)

---

## Testing

### Manual Flow

```bash
# 1. Start worker
bun run worker
# Output: "[schema] ✓ Database schema initialized"

# 2. Send WhatsApp message
# "criar um arquivo chamado hello.ts"

# 3. Check session was saved
sqlite3 ~/.jarvis/worker.db "SELECT * FROM sessions LIMIT 1;"

# 4. Check messages were saved
sqlite3 ~/.jarvis/worker.db "SELECT role, COUNT(*) FROM messages GROUP BY role;"

# 5. Stop worker (Ctrl+C)
# Output: "[shutdown] ✓ Banco de dados fechado"

# 6. Start again
bun run worker

# 7. Verify session restored
sqlite3 ~/.jarvis/worker.db "SELECT state FROM sessions WHERE userId='<phone>';"
# Should show: COMPLETO or FECHADO (from previous session)
```

### Query Examples

```sql
-- Sessions by state
SELECT state, COUNT(*) FROM sessions GROUP BY state;

-- Message count per user
SELECT userId, COUNT(*) as msgs FROM sessions s
  JOIN messages m ON s.id = m.sessionId
  GROUP BY userId;

-- Daily cost
SELECT date, SUM(cost) as total FROM budget_daily
  WHERE date = date('now')
  GROUP BY date;

-- Learnings due for review
SELECT id, content FROM learnings
  WHERE nextReviewAt <= datetime('now');

-- Entity graph density
SELECT COUNT(DISTINCT source) as nodes,
       COUNT(*) as edges
  FROM relations;
```

---

## Troubleshooting

### Database locked
```
error: database is locked
```
**Solution**: Only one worker process at a time. Check for stale processes:
```bash
lsof | grep worker.db
```

### Schema version mismatch
Database auto-migrates on startup via `CREATE TABLE IF NOT EXISTS`. Schema changes require manual migration (Fase 5+).

### Corrupted database
```bash
sqlite3 ~/.jarvis/worker.db "PRAGMA integrity_check;"
```

If corrupted, delete and restart (will rebuild from scratch):
```bash
rm ~/.jarvis/worker.db*
bun run worker
```

---

## Metrics

| Metric | Value |
|--------|-------|
| **Schema tables** | 7 |
| **Indexes** | 12+ (auto) |
| **Typical DB size (1 week)** | 10-50MB |
| **Session TTL** | 2h (memory) → persisted |
| **Message retention** | Unlimited (until GC) |
| **Learning decay** | 2% per day |
| **Review intervals** | [1,3,7,14,30,60] days |

---

## Próximas Fases

### Fase 5 — Budget + Approval + Checkpoints
- Use `budget_daily` table for spending limits
- Approval prompts based on `learnings` confidence
- Checkpoint snapshots (files + DB state)

### Fase 6 — Sentinelas (Cron)
- Cost sentinel (5min) — check budget_daily
- Learning sentinel (24h) — apply decay + GC
- Health sentinel (60s) — check DB health

### Fase 7 — Docker + Deploy
- Backup `worker.db` on deploy
- Restore from backup on new instance
- Database snapshots for rollback

---

## Files Created

```
src/worker/db/
├── schema.ts       (140 LOC) - SQLite init + helpers
├── sessions.ts     (210 LOC) - Session CRUD
├── memory.ts       (200 LOC) - Knowledge graph + BFS
└── learnings.ts    (240 LOC) - Spaced repetition

src/worker/
└── auto-save.ts    (75 LOC)  - Debounced batch writer

Modified:
├── worker-core.ts  (+3 LOC)  - Initialize DB
├── dispatcher.ts   (+30 LOC) - Auto-save integration
└── main.ts         (+10 LOC) - Close DB on shutdown
```

**Total Fase 4**: ~865 LOC core + integrations
