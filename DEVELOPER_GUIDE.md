# Developer Guide - JARVIS Worker v5.0.0

**Como estender, testar e debugar o JARVIS Worker**

---

## 📁 Estrutura do Projeto

```
jarvis-claude-openclaude/
├── src/
│   ├── worker/
│   │   ├── worker-core.ts           # Motor principal
│   │   ├── main.ts                  # Entry point HTTP
│   │   ├── cron-scheduler.ts        # Job scheduler
│   │   ├── services/
│   │   │   ├── smart-cache.ts
│   │   │   ├── preference-extractor.ts
│   │   │   └── ...test.ts
│   │   ├── db/
│   │   │   ├── schema.ts
│   │   │   ├── preferences.ts
│   │   │   ├── cached-contexts.ts
│   │   │   ├── routing-metrics.ts
│   │   │   └── ...test.ts
│   │   ├── skills/
│   │   │   ├── skill-registry.ts
│   │   │   ├── auto-evolve/
│   │   │   │   ├── skill.js
│   │   │   │   └── skill.test.ts
│   │   │   └── ...
│   │   └── config/
│   └── ...
├── tests/
│   ├── integration/
│   ├── unit/
│   └── ...
├── package.json
├── bunfig.toml
└── ...
```

---

## 🚀 Setup Local

```bash
# 1. Instalar dependências
npm install

# 2. Setup .env
cp .env.example .env
# Editar com suas chaves API

# 3. Rodar servidor
npm run dev
# http://localhost:3000

# 4. Testar
npm test
```

### Scripts Disponíveis

```json
{
  "dev": "bun run --watch src/worker/main.ts",
  "test": "bun test",
  "test:watch": "bun test --watch",
  "lint": "eslint src/ --fix",
  "build": "bun build src/worker/main.ts",
  "worker": "bun src/worker/main.ts"
}
```

---

## 🧪 Testes

```bash
# Todos
bun test

# Arquivo específico
bun test src/worker/services/smart-cache.test.ts

# Watch mode
bun test --watch

# Com coverage
bun test --coverage
```

### Padrão de Teste

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

describe('SmartCache', () => {
  let cache: SmartCache

  beforeEach(() => {
    cache = new SmartCache()
  })

  afterEach(async () => {
    await cache.cleanup()
  })

  it('returns cached context on high similarity', async () => {
    const context = { userId: 'user1', messages: [...] }
    await cache.cacheContext(context)

    const retrieved = await cache.getCachedContext(
      'user1',
      'similar message',
      'model1',
      'hash1'
    )

    expect(retrieved).toBeDefined()
    expect(retrieved?.hitCount).toBeGreaterThan(0)
  })
})
```

---

## 🔧 Como Adicionar Nova Skill

```typescript
// src/worker/skills/minha-skill/skill.ts

export default {
  name: 'minha-skill',
  description: 'O que faz',
  version: '1.0.0',

  async onStartup() {
    // Setup
  },

  async onMessage(message: string, userId: string) {
    // Processa mensagem
    return { customField: 'data' }
  },

  async onCron(jobName: string) {
    if (jobName !== 'minha-skill') return
    // Executar tarefa periódica
  },

  async beforeExecute(request: any) {
    // Modificar antes de chamar LLM
    return request
  },

  async afterExecute(response: any) {
    // Processar resposta
    return response
  },

  async onShutdown() {
    // Cleanup
  }
}
```

---

## 🗄️ Como Adicionar Tabela DB

```typescript
// src/worker/db/schema.ts
const MY_TABLE_SCHEMA = `
  CREATE TABLE my_table (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INT NOT NULL,
    UNIQUE(user_id, data)
  );
  CREATE INDEX idx_my_table_user_id ON my_table(user_id);
`

export function initializeSchema(db: Database) {
  // ... existing
  db.exec(MY_TABLE_SCHEMA)
}
```

```typescript
// src/worker/db/my-table.ts
const db = new Database(process.env.DB_PATH)

export async function insertRecord(record: MyTableRecord): Promise<void> {
  const stmt = db.prepare(`
    INSERT INTO my_table (id, user_id, data, created_at)
    VALUES (?, ?, ?, ?)
  `)
  stmt.run(record.id, record.userId, record.data, record.createdAt)
}

export async function getRecordsByUser(userId: string) {
  const stmt = db.prepare(`
    SELECT * FROM my_table WHERE user_id = ?
  `)
  return stmt.all(userId)
}
```

---

## 🐛 Debug

**Logger:**
```typescript
console.log('[module-name] Starting...')
console.error('[module-name] Error:', err.message)
```

**Inspecionar DB:**
```bash
sqlite3 ~/.jarvis/worker.db
sqlite> SELECT * FROM user_preferences;
sqlite> .quit
```

**Node Inspector:**
```bash
node --inspect src/worker/main.ts
# chrome://inspect
```

---

## 📐 Convenções

**Nomenclatura:**
- Classes: `PascalCase`
- Funções: `camelCase`
- Constantes: `UPPER_SNAKE_CASE`
- Arquivos: `kebab-case.ts`

**Imports:**
```typescript
// Preferir named exports
export function myFunction() {}
export class MyClass {}

// Default apenas para skills
export default { name: 'my-skill' }
```

**Error Handling:**
```typescript
try {
  const result = await db.query(...)
} catch (err) {
  console.error('[module] Error:', err.message)
  throw new Error(`Failed: ${err.message}`)
}
```

**Comments:**
```typescript
// Apenas quando WHY não é óbvio

// ❌ Evitar (óbvio)
// Loop through users
for (const user of users) {

// ✅ Bom (explica porquê)
// Jaccard > 0.75 reduz false positives em cache
const similarity = calculateJaccard(msg1, msg2)
if (similarity < 0.75) return null
```

---

## 📚 Recursos

- [ARCHITECTURE.md](ARCHITECTURE.md) — Design técnico
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) — Features e testes
- [API_REFERENCE.md](API_REFERENCE.md) — Endpoints HTTP
- [src/worker/worker-core.ts](src/worker/worker-core.ts) — Motor
- [src/worker/skills/auto-evolve/skill.js](src/worker/skills/auto-evolve/skill.js) — Exemplo skill

---

**Última atualização**: 2026-05-19  
**Versão**: 5.0.0
