# 🏗️ Análise de Sistemas de Desenvolvimento - OpenClaude v5.0

**Data:** 2026-05-19  
**Status:** Fase 7 Completa, Fase 8 em Planejamento  
**Scope:** KAIROS, Docker, Skills, Event Bus, Sentinels

---

## 📌 Sumário Executivo

OpenClaude possui **2 pilares principais** de desenvolvimento:

### 1️⃣ **Claude Code CLI** (Frontend)
- TUI (Terminal User Interface) com React/Ink
- Model selection system
- Session management
- Integration com múltiplos providers

### 2️⃣ **JARVIS Worker** (Backend - KAIROS)
- Headless AI agent (Multi-Session)
- WhatsApp gateway
- Plan Mode + Approval System
- Containerizado com Docker

---

## 🔧 KAIROS - JARVIS Worker v5.0

### Arquitetura

```
┌─────────────────────────────────────────────────┐
│          JARVIS Worker (Headless)               │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Express Server (:3000)                  │  │
│  │  - /api/chat (multi-session)             │  │
│  │  - /api/approve (approval workflow)      │  │
│  │  - /api/exec (sandbox)                   │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Message Processing Pipeline             │  │
│  │  ├─ WhatsApp Gateway (Baileys)           │  │
│  │  ├─ Intent Router (classify message)     │  │
│  │  ├─ Chat Session Manager                 │  │
│  │  └─ Message Dispatcher                   │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Supporting Systems                      │  │
│  │  ├─ KeyPool (provider rotation)          │  │
│  │  ├─ Budget Controller (daily limits)     │  │
│  │  ├─ Plan Mode Manager (4 levels)         │  │
│  │  ├─ Approval System (workflow)           │  │
│  │  └─ Checkpoint Manager (snapshots)       │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Background Services (Sentinels)         │  │
│  │  ├─ CostMonitor (24/7)                   │  │
│  │  ├─ KeyPoolMonitor (24/7)                │  │
│  │  ├─ SessionMonitor (24/7)                │  │
│  │  ├─ DatabaseMonitor (24/7)               │  │
│  │  └─ ErrorMonitor (24/7)                  │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Infrastructure                          │  │
│  │  ├─ SQLite Database (persistência)       │  │
│  │  ├─ EventBus (pub/sub)                   │  │
│  │  ├─ CronScheduler (5 jobs)               │  │
│  │  ├─ SandboxManager (Docker)              │  │
│  │  └─ SkillRegistry (plugin system)        │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Fases Implementadas

#### ✅ **Fase 1-2: Core Worker (Fundação)**
**Objetivo:** Router de APIs com rotação de providers  
**Componentes:**
- `JarvisWorker` - Orquestrador principal
- `KeyPool` - Rotação entre providers (Claude, OpenAI, local LLM)
- `IntentRouter` - Classifica tipo de mensagem
- `ChatSession` - Gerencia contexto por usuário
- SQLite com auto-save

**Arquivos:** `worker-core.ts`, `config.ts`, `intent-router.ts`

---

#### ✅ **Fase 3-4: WhatsApp + Message Dispatch**
**Objetivo:** Integração multi-canal  
**Componentes:**
- `BaileysGateway` - WhatsApp via Baileys
- `MessageDispatcher` - Roteamento baseado em intent
- `AutoSave` - Persistência automática

**Arquivos:** `gateways/baileys.ts`, `dispatcher.ts`, `auto-save.ts`

---

#### ✅ **Fase 5: Approval + Budget + PlanMode**
**Objetivo:** Governança e controle de custo  
**Componentes:**
- `ApprovalSystem` - Workflow de aprovações em 4 níveis
- `BudgetController` - Limite diário por usuário ($)
- `CheckpointManager` - Snapshots do estado da sessão
- `PlanModeManager` - 4 níveis: dev → audit → operate → execute

**Endpoints:**
```bash
POST /api/approve/:id
POST /api/deny/:id
GET  /api/budget/:userId
PUT  /api/budget/:userId/limit
GET  /api/mode
PUT  /api/mode
GET  /api/checkpoints
POST /api/checkpoints/:id/restore
```

**Arquivos:** `approval.ts`, `budget.ts`, `plan-mode.ts`, `checkpoints.ts`

---

#### ✅ **Fase 6: Cron + Sentinels + EventBus**
**Objetivo:** Monitoramento 24/7 + Automação  
**Componentes:**
- `CronScheduler` - 5 jobs background (cleanup, cache, reports)
- `Sentinels` - 5 monitores contínuos:
  - **CostMonitor** - Detecta uso anormal
  - **KeyPoolMonitor** - Falhas de provider
  - **SessionMonitor** - Sessões inativas
  - **DatabaseMonitor** - Saúde SQLite
  - **ErrorMonitor** - Taxa de erros
- `EventBus` - Pub/sub centralizado

**Entidade:** "Sentinela" = monitor + responder

**Exemplo:**
```
CostMonitor detecta pico de custo → 
EventBus.emit('alert.cost') → 
SlackNotifier.send() + AutoCheckpoint.create()
```

**Arquivos:** `cron-scheduler.ts`, `sentinels.ts`, `event-bus.ts`

---

#### ✅ **Fase 7: Docker + Sandbox + Skills (COMPLETA)**
**Objetivo:** Execução isolada + Plugin system  
**Componentes:**
- `Dockerfile` - Multi-stage, oven/bun:latest
- `docker-compose.yml` - Orquestração com health check
- `SandboxManager` - Executa código isolado
  - `--network none` (sem internet)
  - `--memory 512MB`
  - `--cpus 0.5`
  - `--timeout 30s`
- `SkillRegistry` - Sistema de plugins com 5 lifecycle hooks
- 3 skills de exemplo: example, cost-monitor, auto-checkpoint

**Skills Lifecycle Hooks:**
```typescript
onLoad() → onStartup() → onMessage() → onStop() → onUnload()
```

**Endpoint:** `POST /api/exec` ($50/execução)

**Performance:**
- Docker build: ~90s (cached)
- Container startup: 8-10s
- /api/exec: 200-500ms

**Arquivos:** `sandbox.ts`, `skills/registry.ts`, `Dockerfile`

---

## 📋 Fase 8: CLI Hot-Reload Skills (Planejado)

**Objetivo:** Developer experience para skill development

**Comandos:**
```bash
jarvis skill create <name>          # Scaffold novo skill
jarvis skill test <path>            # Teste local
jarvis skill list                   # Listar carregadas
jarvis skill watch <path>           # Hot-reload via WebSocket
```

**Estimativa:** 3-4 horas

---

## 🗄️ Estrutura de Dados

### SQLite Schema

```sql
-- Chat Sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT,
  created_at DATETIME,
  last_message_at DATETIME,
  message_count INT,
  total_tokens INT
);

-- Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT,
  content TEXT,
  created_at DATETIME,
  tokens INT
);

-- Learnings (Memory)
CREATE TABLE learnings (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  content TEXT,
  created_at DATETIME,
  relevance FLOAT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Approvals
CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  request_type TEXT,
  status TEXT,
  requested_at DATETIME,
  resolved_at DATETIME
);

-- Checkpoints
CREATE TABLE checkpoints (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  state BLOB,
  created_at DATETIME
);

-- Budget (daily tracking)
CREATE TABLE budget_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE,
  cost DECIMAL(10,2),
  tokens INT
);
```

### Vector DB (Orama)

```typescript
VectorStore {
  learnings: {
    id, user_id, content, embedding[], created_at, relevance
  },
  sessions: {
    id, summary, embedding[], user_id
  }
}
```

---

## 🎯 Endpoints Disponíveis

### Health & Status
```bash
GET  /health                    # Health check
GET  /api/cost                  # Total spent (format: $X.XX)
GET  /api/keys                  # Status de providers
GET  /api/whatsapp/status       # WhatsApp connection
GET  /api/whatsapp/qr           # QR Code para pairing
GET  /api/cron                  # Job status
```

### Chat & Processing
```bash
POST /api/chat                  # Send message
     {
       userId: string,
       message: string,
       sessionId?: string,
       mode?: 'dev' | 'audit' | 'operate' | 'execute'
     }
```

### Approval Workflow
```bash
GET  /api/approvals/pending     # Pendentes
POST /api/approve/:id           # Aprovar
POST /api/deny/:id              # Rejeitar
```

### Budget Management
```bash
GET  /api/budget/:userId        # Use hoje
GET  /api/budget/all/today      # Total sistema
PUT  /api/budget/:userId/limit  # Set limit ($/day)
```

### Plan Mode
```bash
GET  /api/mode                  # Modo atual
PUT  /api/mode                  # Trocar (dev→audit→...)
```

### Checkpoints
```bash
GET  /api/checkpoints           # List all
POST /api/checkpoints           # Save snapshot
POST /api/checkpoints/:id/restore  # Restore
```

### Sandbox Execution
```bash
POST /api/exec                  # Run code
     {
       code: string,
       language: string,  # js|py|sh
       timeout?: number,
       environment?: Record<string,string>
     }
```

---

## 🔌 Integração de Sistemas

### Event Flow
```
WhatsApp Message
    ↓
MessageDispatcher.handle()
    ↓
IntentRouter.classify()
    ↓ (matches intent)
JarvisWorker.processMessage()
    ↓
EventBus.emit('message.processed')
    ↓ (50 listeners possible)
├─ SkillRegistry.onMessage()
├─ Sentinels.onMessage()
├─ AutoSave.persist()
└─ EventLog.record()
    ↓
Response sent to WhatsApp
```

### Provider Failover
```
Request from /api/chat
    ↓
KeyPool.selectKey() {
  1. Try Primary (Claude API)
  2. If fail: cooldown 30min
  3. Try Secondary (OpenAI)
  4. If fail: cooldown 15min
  5. Try Tertiary (Local Ollama)
  6. If all fail: return error
}
```

---

## 📊 Performance Metrics

| Métrica | Valor | Notas |
|---------|-------|-------|
| Health check | <50ms | Em memória |
| Chat request | 500-2000ms | Depende do provider |
| Sandbox exec | 200-500ms | Após Docker startup |
| Container startup | 8-10s | From scratch |
| Docker build | ~90s | Cached: ~15s |
| Skill load | <500ms | Por skill |
| Message dispatch | <100ms | Router + DB |
| Approval workflow | <50ms | DB query |

---

## 🧪 Testing Strategy

### Unit Tests
- `worker-core.test.ts` - Core logic
- `intent-router.test.ts` - Intent classification
- `budget.test.ts` - Cost calculations
- `plan-mode.test.ts` - Mode transitions

### Integration Tests
- `dispatcher-integration.test.ts` - Full message flow
- `sandbox-integration.test.ts` - Code execution
- `approval-workflow.test.ts` - Approval pipeline

### E2E Tests
- `worker.e2e.test.ts` - Real WhatsApp message
- `docker-e2e.test.ts` - Full containerized flow

---

## 🚀 Deployment

### Local Development
```bash
# Start worker
bun run worker

# Start with Docker
docker-compose up --build

# Test endpoint
curl http://localhost:3000/health
```

### Production
```bash
# Build image
docker build -t openclaude:latest .

# Run container
docker run -e OPENAI_API_KEY=$KEY \
           -e WORKER_PORT=3000 \
           -p 3000:3000 \
           openclaude:latest

# Health checks
curl http://localhost:3000/health
curl http://localhost:3000/api/cost
```

### Environment Variables
```bash
# API Keys
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://...
OPENAI_MODEL=gpt-4

# Server
WORKER_PORT=3000
NODE_ENV=production

# WhatsApp
BAILEYS_AUTO_LOGIN=true
BAILEYS_SESSION_DIR=./sessions

# Database
DATABASE_PATH=./data/worker.db
VECTOR_DB_PATH=./data/vector.db

# Custom
JARVIS_SYSTEM_PROMPT="Custom instructions..."
```

---

## 🛠️ Desenvolvimento Futuro

### Próximas Prioridades

1. **Fase 8: CLI Hot-Reload Skills** (3-4h)
   - Scaffold generator
   - Hot-reload via WebSocket
   - Skill marketplace integration

2. **SMS/Telegram Integration** (4-5h)
   - SMS gateway (Twilio)
   - Telegram bot API
   - Multi-channel routing

3. **Advanced Monitoring** (6-8h)
   - Prometheus metrics
   - Grafana dashboards
   - Performance profiling

4. **Model Fine-tuning** (10-12h)
   - Training data collection
   - LoRA adaptation
   - Custom model deployment

### Architecture Improvements
- [ ] Multi-region deployment (AWS/GCP)
- [ ] Kubernetes orchestration
- [ ] Message queue (RabbitMQ/Redis)
- [ ] Load balancing
- [ ] Rate limiting per user
- [ ] Advanced caching (Redis)

---

## 📚 Documentação Relacionada

- `docs/worker/FASE7-DOCKER.md` - Docker setup (23KB)
- `TASK.md` - Progresso de fases
- `src/worker/*.ts` - Código fonte comentado
- `scripts/worker-*.sh` - Helper scripts

---

## ✨ Resumo

**KAIROS (JARVIS Worker) é um AI agent headless production-ready que:**

✅ Processa mensagens multi-canal (WhatsApp)  
✅ Roteia entre múltiplos providers com failover  
✅ Gerencia budget e approvals  
✅ Executa código em sandbox isolado  
✅ Permite extensão via plugins (Skills)  
✅ Monitora 24/7 com sentinelas  
✅ Persiste estado com snapshots  
✅ Containerizado e pronto para scale

**Pronto para:** Produção em escala, múltiplos usuários, casos de uso complexos

**Não requer:** Claude Code CLI, GUI, TUI — totalmente headless

---

**Status:** Fase 7 ✅ Completa  
**Próximo:** Fase 8 em planejamento  
**Estimativa:** 3-4 semanas para Fase 8 + production hardening
