# JARVIS Worker — Do KAIROS ao Funcionário WhatsApp

> Sumário do que é o KAIRO e, o que falta no JARVIS v5 para implementar o mode assitente
> e como construir o equivalente ao KAIROS para o JARVIS funcionário 24/7.

---

## O que é KAIROS?

KAIROS é o codename interno do **modo assistente/daemon** do OpenClaude original (Anthropic). É um modo de operação headless — sem terminal interativo — onde o Claude fica rodando 24/7 como um serviço, aceitando mensagens via bridge remota e respondendo automaticamente.

No código-fonte original, o KAIROS:
- Roda como um processo daemon (systemd/Python `assistant daemon`)
- Aceita input remoto via WebSocket / bridge
- Usa `BriefTool` (SendUserMessage) como canal de saída
- Tem agendamento de tarefas (cron) integrado
- Gerencia sessões persistentes com histórico
- Envia metadata própria (`kairosActive: true`) para analytics

---

## O que existe no JARVIS v5 (e o que falta)

### Já existe e pode ser reaproveitado

| Componente | Arquivo | Status |
|---|---|---|
| KeyPool com rotação de chaves | `src/services/api/keyPool.ts` | Completo |
| Smart Routing (5 categorias) | `src/services/api/smartRoutingBridge.ts` | Completo |
| Provider Resolver | `src/services/api/providerResolver.ts` | Completo |
| Cycle Recorder (log JSONL) | `src/services/api/cycleRecorder.ts` | Completo |
| Cost Tracker | `src/cost-tracker.ts` | Completo |
| Comando `/cost` | `src/commands/cost/cost.ts` | Completo |
| Cron scheduling | `src/tools/ScheduleCronTool/prompt.ts` | Habilitado (open builds) |
| Knowledge Graph (entidades/relações) | `src/utils/knowledgeGraph.ts` | Completo (por projeto) |
| Memdir (memória em markdown) | `src/memdir/` | Completo |
| BriefTool (SendUserMessage) | `src/tools/BriefTool/BriefTool.ts` | Completo |
| Bridge config | `src/bridge/bridgeConfig.ts` | Parcial (feita pra cloud) |

### Existe como stub / dead code (só portas de integração)

| Componente | Arquivo | Estado |
|---|---|---|
| assistant/index.ts | `src/assistant/index.ts` | **Não existe** no source snapshot |
| assistant/gate.ts | `src/assistant/gate.ts` | **Não existe** no source snapshot |
| assistant/systemPrompt.md | `src/assistant/systemPrompt.md` | **Não existe** no source snapshot |
| Modo daemon headless | `kairosActive` no state | Só a flag (`false &&`) |
| Remote bridge | `bridgeMain.ts` | Só a integração bridge |
| Session history API | `src/assistant/sessionHistory.ts` | Stub funcional (chama API Anthropic) |
| AssistantSessionChooser | `src/assistant/AssistantSessionChooser.tsx` | Stub vazio |

---

## Arquitetura do JARVIS Worker

```
┌─────────────────────────────────────────────────────┐
│                      VPS Linux                      │
│                                                      │
│  ┌──────────────────────────────┐                    │
│  │      WhatsApp Gateway        │                    │
│  │  (Evolution API / baileys)   │                    │
│  └─────────┬────────────────────┘                    │
│            │ webhook HTTP POST                       │
│            ▼                                         │
│  ┌──────────────────────────────┐                    │
│  │         Dispatcher           │                    │
│  │  - Roteia por usuário        │                    │
│  │  - Gerencia fila             │                    │
│  │  - Verifica sessão ativa     │                    │
│  └─────────┬────────────────────┘                    │
│            │                                         │
│  ┌─────────▼────────────────────┐  ┌──────────────┐  │
│  │      JARVIS Core (SDK)       │  │  SQLite DB   │  │
│  │  - ProviderResolver          │  │  - Sessões   │  │
│  │  - KeyPool                   │  │  - Budget    │  │
│  │  - SmartRouting              │  │  - Memória   │  │
│  │  - CostTracker               │  │  - Histórico │  │
│  │  - KnowledgeGraph            │  └──────────────┘  │
│  └─────────┬────────────────────┘                    │
│            │                                         │
│            ▼                                         │
│  ┌──────────────────────────────┐                    │
│  │      Response Handler        │                    │
│  │  - Formata resposta          │                    │
│  │  - Envia via WhatsApp        │                    │
│  │  - Extrai memórias (bg)      │                    │
│  └──────────────────────────────┘                    │
│                                                      │
│  ┌──────────────────────────────┐                    │
│  │      Background Jobs         │                    │
│  │  - Sentinela de custo        │                    │
│  │  - Relatório diário          │                    │
│  │  - Consolidação de memória   │                    │
│  │  - Healthcheck HTTP          │                    │
│  └──────────────────────────────┘                    │
└─────────────────────────────────────────────────────┘
```

---

## Plano de Implementação

### Fase 1 — Worker Headless (2 dias)

Extrair o core do JARVIS do terminal Ink/React para rodar como SDK headless.

**O que fazer:**
1. Identificar o ponto de entrada do loop principal (`src/main.tsx` → função `run()`)
2. Criar `src/worker/worker-core.ts` que expõe:
   ```typescript
   class JarvisWorker {
     async processPrompt(userMessage: string, context?: SessionContext): Promise<string>
     getCostTracker(): CostTracker
     getKeyPool(): KeyPool
     getMemory(): KnowledgeGraph
   }
   ```
3. O worker core importa os módulos existentes (KeyPool, SmartRouting, CostTracker, KnowledgeGraph) sem depender de Ink/React
4. HTTP healthcheck simples (`GET /health` → `{ status: "ok", uptime, sessions, cost_today }`)

**Arquivos novos:**
- `src/worker/worker-core.ts` — classe principal do worker
- `src/worker/server.ts` — servidor HTTP mínimo (Express ou http nativo)
- `src/worker/index.ts` — entrypoint `bun run src/worker/index.ts`

**Arquivos existentes reaproveitados:**
- `src/services/api/keyPool.ts` — sem alterações
- `src/services/api/smartRoutingBridge.ts` — sem alterações
- `src/services/api/providerResolver.ts` — sem alterações
- `src/services/api/cycleRecorder.ts` — sem alterações
- `src/cost-tracker.ts` — sem alterações
- `src/utils/knowledgeGraph.ts` — precisa de adaptação (schema global multi-usuário)

---

### Fase 2 — Worker Standalone (1 dia)

Fazer o worker rodar como processo independente.

**O que fazer:**
1. `src/worker/main.ts` — entrypoint que:
   - Carrega configuração ( `.env`, `settings.json`, pools de chave)
   - Inicializa KeyPools (Zen, NVIDIA, DeepSeek)
   - Inicializa ProviderResolver com routing
   - Inicializa KnowledgeGraph global
   - Inicializa servidor HTTP
   - Inicializa healthcheck
   - Fica escutando em `localhost:${PORT}`

2. Systemd service:
   ```ini
   [Unit]
   Description=JARVIS Worker
   After=network.target

   [Service]
   Type=simple
   User=jarvis
   WorkingDirectory=/opt/jarvis
   ExecStart=/usr/bin/bun run src/worker/main.ts
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```

---

### Fase 3 — WhatsApp Gateway (2 dias)

Conectar o worker ao WhatsApp.

**Opção A — Evolution API (recomendada):**
- Self-hosted via Docker
- Gerencia QR Code, multi-dispositivo, mídia
- Webhook POST para o worker com payload padronizado
- Vantagem: não precisa gerenciar conexão WhatsApp diretamente

**Opção B — Baileys (baixo nível):**
- Lib Node.js que implementa o protocolo WhatsApp Web
- Controle total, sem dependência externa
- Mais trabalho: gerenciar reconexão, QR Code, autenticação

**Implementação:**
```typescript
// src/worker/gateways/whatsapp.ts
interface WhatsAppGateway {
  sendMessage(to: string, text: string): Promise<void>
  onMessage(handler: (msg: WhatsAppMessage) => void): void
  start(): Promise<void>
  stop(): Promise<void>
}
```

---

### Fase 4 — Session Store + Memória (1 dia)

Persistência de conversas e memória do knowledge graph.

**SQLite (`~/.jarvis/memory.db`):**

```sql
-- Sessões por usuário
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_phone TEXT NOT NULL,
  status TEXT DEFAULT 'active',  -- active | expired
  context_json TEXT,              -- histórico compactado
  token_count INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Mensagens individuais
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL,              -- user | assistant
  content TEXT NOT NULL,
  tokens INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  metadata_json TEXT,              -- modelo usado, latency, etc
  created_at TEXT NOT NULL
);

-- Budget diário por usuário
CREATE TABLE budget_daily (
  user_phone TEXT NOT NULL,
  date TEXT NOT NULL,              -- YYYY-MM-DD
  requests INTEGER DEFAULT 0,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  PRIMARY KEY (user_phone, date)
);
```

**Memória do Knowledge Graph (adaptado do `knowledgeGraph.ts`):**

```sql
-- Entidades extraídas automaticamente
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,              -- decision | preference | project_state | user_profile | incident
  name TEXT NOT NULL,
  attributes TEXT,                 -- JSON
  user_phone TEXT,                 -- dono (NULL = global)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Relações entre entidades
CREATE TABLE relations (
  source_id TEXT NOT NULL REFERENCES entities(id),
  target_id TEXT NOT NULL REFERENCES entities(id),
  type TEXT NOT NULL,              -- depends_on | contradicts | supersedes | references
  PRIMARY KEY (source_id, target_id, type)
);

-- Regras de projeto/usuário
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  rule TEXT NOT NULL UNIQUE,
  user_phone TEXT,                 -- NULL = regra global
  source TEXT,                     -- de qual conversa veio
  created_at TEXT NOT NULL
);
```

---

### Fase 5 — Budget Controller + Segurança (1 dia)

**Budget Controller:**
```typescript
// src/worker/budget.ts
interface BudgetConfig {
  dailyLimitPerUser: number      // $X por usuário/dia
  dailyLimitGlobal: number       // $X total/dia
  alertAt: number                // 0.8 = alerta com 80%
}

class BudgetController {
  async check(userPhone: string): Promise<{
    allowed: boolean
    reason?: string
    costToday: number
    limit: number
  }>

  async record(userPhone: string, cost: number): Promise<void>
}
```

**Comandos do usuário via NLP:**
| Fala do usuário | Ação |
|---|---|
| "quanto gastei hoje" | BudgetController.check() → resposta formatada |
| "qual meu limite" | Mostra configuração do usuário |
| "lembra que..." | knowledgeGraph.addEntity() |
| "esquece aquilo" | knowledgeGraph.markForgotten() |
| "o que sabe sobre X" | knowledgeGraph.search() |
| "roda npm test" | Executa comando com sandbox (timeout 30s) |
| "relatório de ontem" | Busca budget + mensagens do dia anterior |

---

### Fase 6 — Sentinela + Relatórios (1 dia)

**Sentinela de custo** (roda a cada 5 min):
- Verifica gasto do dia vs limite
- Se > 80%: envia alerta "Você já gastou 80% do limite diário"
- Se estourou: trava requisições e avisa

**Sentinela de chaves** (roda a cada 1 min):
- Verifica KeyPool.health()
- Se chave em cooldown: tenta rotacionar
- Se muitas 429: muda pool prioritário

**Relatório diário** (roda meia-noite):
- "Resumo de hoje: R$ X, Y requisições, Z usuários"
- Top modelos usados
- Alertas de budget

**Healthcheck HTTP:**
```json
GET /health → {
  "status": "running",
  "uptime": 3600,
  "version": "v5.0.0",
  "sessions_active": 3,
  "cost_today": 0.47,
  "queries_today": 142,
  "pools": {
    "zen": { "active": 5, "cooldown": 0, "errors_429": 2 },
    "nvidia": { "active": 1, "cooldown": 0, "errors_429": 0 }
  },
  "queue_size": 0
}
```

---

### Fase 7 — Docker + Deploy (1 dia)

**Dockerfile:**
```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=install /app/node_modules ./node_modules
COPY . .
RUN bun build ./src/worker/main.ts --outdir ./dist

FROM base
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["bun", "run", "dist/main.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  jarvis-worker:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/root/.jarvis
      - /var/run/docker.sock:/var/run/docker.sock  # para sandbox
    env_file: .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## Roadmap Resumido

| Fase | O que | Dias | Depende de |
|------|-------|------|------------|
| 1 | Worker headless (extrair core do Ink) | 2 | — |
| 2 | Worker standalone + systemd | 1 | Fase 1 |
| 3 | WhatsApp Gateway (Evolution API) | 2 | Fase 2 |
| 4 | Session Store + Memória permanente | 1 | Fase 2 |
| 5 | Budget Controller + Segurança | 1 | Fase 4 |
| 6 | Sentinela + Relatórios automáticos | 1 | Fase 5 |
| 7 | Docker + Deploy na VPS | 1 | Fases 1-6 |
| **Total** | | **~9 dias** | |

---

## Pré-requisitos pra começar

1. VPS Linux (Ubuntu 22.04+, 2GB RAM, 20GB SSD)
   - Hetzner: ~€4/mês
   - DigitalOcean: ~$6/mês
   - Oracle Cloud: free tier
2. Domínio (opcional, para Evolution API com SSL)
3. Número de WhatsApp dedicado (pode ser eSIM/Claro Tim Vivo)
4. Chaves de API: Zen, NVIDIA, DeepSeek (já configuradas)
5. Docker e bun instalados na VPS

---

## Referências no Código

| O que | Onde |
|---|---|
| KeyPool | `src/services/api/keyPool.ts` |
| Smart Routing | `src/services/api/smartRoutingBridge.ts` |
| ProviderResolver | `src/services/api/providerResolver.ts` |
| Cycle Recorder | `src/services/api/cycleRecorder.ts` |
| Cost Tracker | `src/cost-tracker.ts` |
| Comando /cost | `src/commands/cost/cost.ts` |
| Knowledge Graph | `src/utils/knowledgeGraph.ts` |
| Memdir | `src/memdir/` |
| Cron Gate (já ativo) | `src/tools/ScheduleCronTool/prompt.ts` |
| BriefTool | `src/tools/BriefTool/BriefTool.ts` |
| Feature flag KAIROS | `src/main.tsx` (linhas 79-82, 1049-1090) |
| State kairosActive | `src/bootstrap/state.ts` |
| Stub AssistantSessionChooser | `src/assistant/AssistantSessionChooser.tsx` |
| Session History (stub) | `src/assistant/sessionHistory.ts` |
