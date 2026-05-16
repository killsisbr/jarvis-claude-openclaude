# JARVIS Funcionário

> Um processo Node.js headless rodando 24/7 em VPS que aceita input via WhatsApp,
> processa com o JARVIS Core, responde de volta, e ainda expõe API REST + Dashboard web.

---

## Sumário

- [Arquitetura](#arquitetura)
- [Capacidades do Funcionário](#capacidades-do-funcionário)
- [API REST](#api-rest)
- [Dashboard Web](#dashboard-web)
- [Armazenamento (SQLite)](#armazenamento-sqlite)
- [Memória Permanente](#memória-permanente)
- [Planos de Implementação](#planos-de-implementação)
- [Aproveitamento do JARVIS v5](#aproveitamento-do-jarvis-v5)

---

## Arquitetura

```
WhatsApp ──→ Webhook ──→ Dispatcher ──→ JARVIS Core ──→ LLM
                  │                        │
                  ▼                        ▼
           Dashboard Web ←── API REST ←───┘
                                    │
                               Background Jobs
                          (sentinela, cron, extrator)
```

- **Worker**: Node.js + Express, headless (sem Ink/React)
- **DB**: SQLite (`~/.jarvis/memory.db`)
- **Gateway**: Evolution API (WhatsApp) ou HTTP direto
- **Deploy**: Docker + systemd na VPS

---

## Capacidades do Funcionário

### 1. Chat Direto (Pergunta → Resposta)

Usuário envia texto no WhatsApp (ou web) → JARVIS processa via LLM → responde.

O que pode responder:
- Dúvidas técnicas sobre o projeto (código, arquitetura, docs)
- Consultas ao playbook (`docs/PLAYBOOK.md`) ou documentação
- "O que esse trecho de código faz?"
- "Como configurar o provider X?"
- "Qual o status do smart routing?"

### 2. Relatórios e Monitoramento

Comandos em linguagem natural que retornam dados formatados:

| Fala do usuário | Resposta |
|---|---|
| "quanto gastei hoje" | Gasto por pool + total do dia |
| "status das chaves" | Quantas ativas, quantas em cooldown |
| "modelos disponiveis" | Lista de modelos e pools |
| "relatorio da semana" | Gasto acumulado, top modelos, média de tokens |
| "custo por usuario" | Gasto por usuário no período |

### 3. Execução Remota com Sandbox

JARVIS roda comandos na VPS dentro de container Docker descartável com timeout.

```
/exec npm test
/exec git pull
/exec bun run build
```

**Segurança:**
- Timeout 30s automático
- Container descartável (morre após o comando)
- Lista branca de comandos (sem `rm -rf`, `sudo`, etc.)
- Comandos destrutivos pedem confirmação no WhatsApp antes de executar

### 4. Gerenciamento de Projeto via NLP

| Fala | Ação |
|---|---|
| "cria uma branch chamada hotfix/login" | `git checkout -b hotfix/login` |
| "faz um commit com 'corrige bug no login'" | `git add -A && git commit -m "..."` |
| "abre um PR dessa branch" | `gh pr create` |
| "me mostra os commits de hoje" | `git log --since=00:00` |

### 5. Memória Permanente (Knowledge Graph)

O JARVIS aprende com o uso — salva decisões, preferências, e estado do projeto.

| Fala | Ação |
|---|---|
| "lembra que o deploy so pode depois das 22h" | Salva regra no knowledge graph |
| "o que eu decidi sobre a lib X?" | Busca entidades + relações |
| "esquece a regra do deploy" | Marca como forgotten |
| "o que mudou desde ontem?" | Busca entidades atualizadas no período |

### 6. Sentinela (Alertas Pró-Ativos)

O JARVIS não espera você perguntar — ele avisa:

| Evento | Ação |
|---|---|
| Gasto do dia passou de $X | "Você gastou $X hoje (limite: $Y)" |
| Chave entrou em cooldown | "Chave ZEN-03 em cooldown até 14:30. Rotacionei pra ZEN-04" |
| Muitos erros 429 | "Pool NVIDIA com 5 erros 429 em 3 min. Desativando por 10 min" |
| Branch desatualizada | "main está 3 commits atrás do origin" |
| Deploy quebrou | "GitHub Action falhou no teste de integração" |

### 7. Agendamento (Cron)

Roda ações automáticas em horários definidos:

```
"me manda um resumo todo dia as 8h"       → cron diário
"se o gasto passar de $5 me avisa"        → sentinela de budget
"verifica se tem commit sem PR a cada 2h" → varredura automática
```

Reaproveita o `ScheduleCronTool` já existente no JARVIS (gate já ativo em open builds).

### 8. Múltiplos Workers (Time)

Um número de WhatsApp = um perfil com autorizações diferentes:

| Número | Perfil | Acesso |
|---|---|---|
| 11 9XXXX-1001 | **Dev** | Código, branches, PRs, execução |
| 11 9XXXX-1002 | **Gerente** | Relatórios, custos, planejamento (sem execução) |
| 11 9XXXX-1003 | **Suporte** | Docs, playbook, dúvidas (sem execução, sem git) |

Todos compartilham o mesmo pool de chaves e key pool. Cada um carrega system prompt diferente.

### O que ele NÃO faz (por design)

| Não faz | Motivo |
|---|---|
| Acessar a internet | Sem permissão de rede fora APIs específicas |
| Rodar comandos sem timeout | Container kill automático em 30s |
| Deletar arquivos | Lista negra de comandos destrutivos |
| Esquecer decisões | Memória permanente (a menos que você peça para esquecer) |
| Atender dois ao mesmo tempo | Fila FIFO por usuário |

---

## API REST

Tudo passa pela API REST. O WhatsApp é só mais um cliente. Depois você adiciona Telegram, webhook do GitHub, ou um curl de script.

```
POST /api/chat            → enviar mensagem para o worker
GET  /api/chat/:session   → histórico de uma sessão
GET  /api/cost            → dados de custo (hoje / semana / mês)
GET  /api/cost/by-model   → gasto por modelo
GET  /api/cost/by-pool    → gasto por provedor (Zen, NVIDIA, DeepSeek)
GET  /api/keys            → status de todas as chaves
GET  /api/keys/:pool      → status detalhado de um pool
GET  /api/health          → status do worker (uptime, sessões, fila)
GET  /api/logs            → logs de requisições (com filtro por data/provedor)
POST /api/exec            → rodar comando no sandbox
GET  /api/memory/search   → buscar no knowledge graph
POST /api/memory          → salvar entidade manualmente
GET  /api/config          → configuração atual
POST /api/config          → alterar configuração (pools, limites, webhooks)
```

### Exemplo de uso

```bash
# Perguntar algo
curl -X POST http://jarvis:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"user": "551199999999", "message": "quanto gastei hoje"}'

# Resposta:
{
  "session": "abc123",
  "reply": "Hoje: $0.47 (Zen: $0.30, DeepSeek: $0.17). 142 requisições.",
  "cost": 0.47,
  "model": "deepseek-chat",
  "tokens": { "input": 45200, "output": 1200 }
}

# Ver status
curl http://jarvis:3000/api/health

# Resposta:
{
  "status": "running",
  "uptime": 3600,
  "version": "v5.0.0",
  "sessions_active": 3,
  "cost_today": 0.47,
  "queries_today": 142,
  "queue_size": 0
}
```

---

## Dashboard Web

Páginas HTML servidas pelo Express (sem framework JS — HTML + htmx ou template engine).

| Rota | Conteúdo |
|---|---|
| `/` | Dashboard principal: gasto do dia, status das chaves, últimas mensagens |
| `/chat` | Interface de conversa no browser (compartilha histórico com WhatsApp) |
| `/cost` | Gráficos de gasto por hora/dia/semana, por provedor, por modelo |
| `/keys` | Gerenciamento de chaves: status, cooldown timer, ativar/desativar |
| `/logs` | Logs do worker com busca e filtro |
| `/memory` | Busca no knowledge graph, decisões salvas, regras ativas |
| `/config` | Configuração visual: pools de chave, limites de budget, webhooks, system prompts |

**Filosofia**: API first, web depois. O dashboard é complementar — o funcionário já funciona só com a API + WhatsApp. As páginas existem pra você ver o que está acontecendo, não pra operar o worker.

---

## Armazenamento (SQLite)

Banco único `~/.jarvis/memory.db`:

```sql
-- Sessões por usuário
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_phone TEXT NOT NULL,
  status TEXT DEFAULT 'active',  -- active | expired
  context_json TEXT,             -- histórico compactado
  token_count INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Mensagens individuais
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL,             -- user | assistant
  content TEXT NOT NULL,
  tokens INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  metadata_json TEXT,             -- modelo usado, latência, etc
  created_at TEXT NOT NULL
);

-- Budget diário por usuário
CREATE TABLE budget_daily (
  user_phone TEXT NOT NULL,
  date TEXT NOT NULL,             -- YYYY-MM-DD
  requests INTEGER DEFAULT 0,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  PRIMARY KEY (user_phone, date)
);

-- Entidades do knowledge graph (extraídas automaticamente)
CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,             -- decision | preference | project_state | user_profile | incident
  name TEXT NOT NULL,
  attributes TEXT,                -- JSON
  user_phone TEXT,                -- dono (NULL = global)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Relações entre entidades
CREATE TABLE relations (
  source_id TEXT NOT NULL REFERENCES entities(id),
  target_id TEXT NOT NULL REFERENCES entities(id),
  type TEXT NOT NULL,             -- depends_on | contradicts | supersedes | references
  PRIMARY KEY (source_id, target_id, type)
);

-- Regras de projeto/usuário
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  rule TEXT NOT NULL UNIQUE,
  user_phone TEXT,                -- NULL = regra global
  source TEXT,                    -- de qual conversa veio
  created_at TEXT NOT NULL
);
```

---

## Memória Permanente

Depois que o JARVIS responde uma mensagem, um processo em background analisa a conversa e extrai memórias automaticamente (com o modelo mais barato, DeepSeek).

**Extrator automático:**
```
Input: "Não usa mais a lib X, tava dando problema de performance"

Output:
  → entity: { type: "decision", name: "lib X", attributes: { status: "deprecated", reason: "performance" } }
  → rule: "Don't use lib X"
  → relation: "lib X" → "performance" (depends_on)
```

**Recall no prompt:**
Antes de processar cada mensagem, o JARVIS busca no knowledge graph:
1. Extrai keywords da mensagem
2. Busca entidades e regras relacionadas
3. Monta bloco de contexto no system prompt

**Decaimento:**
Job semanal que compacta entidades não acessadas em 30 dias e expurga não acessadas em 60 dias.

---

## Planos de Implementação

### Fase 1 — API REST + Worker Headless (2 dias)

Extrair o core do JARVIS do terminal Ink/React e expor via Express.

- `src/worker/worker-core.ts` — classe `JarvisWorker` com `processPrompt()`, `getCostTracker()`, `getKeyPool()`
- `src/worker/server.ts` — servidor Express com rotas `/api/chat`, `/api/health`, `/api/cost`, `/api/keys`
- `src/worker/index.ts` — entrypoint `bun run src/worker/index.ts`
- Reaproveita KeyPool, SmartRouting, CostTracker, CycleRecorder sem alterações

### Fase 2 — Dashboard Web (2 dias)

Páginas HTML puras servidas pelo Express.

- `src/worker/web/index.html` — dashboard principal
- `src/worker/web/chat.html` — interface de conversa
- `src/worker/web/cost.html` — gráficos de gasto
- `src/worker/web/config.html` — configuração visual
- Template engine (EJS) ou HTML + htmx para dinamismo

### Fase 3 — WhatsApp Gateway (2 dias)

Conectar ao WhatsApp via Evolution API (self-hosted) ou baileys.

- Webhook POST do WhatsApp → Dispatcher → JARVIS Core → resposta de volta
- Gerenciamento de sessão por número de telefone
- Reconexão automática

### Fase 4 — Budget Controller + Segurança (1 dia)

- Limite diário por usuário ($X)
- Limite global ($X)
- Alerta a 80%
- Bloqueio automático quando estourar

### Fase 5 — Sentinela + Relatórios + Memória (2 dias)

- Sentinela de custo (a cada 5 min)
- Sentinela de chaves (a cada 1 min)
- Relatório diário (meia-noite)
- Extrator automático de memória (pós-resposta)
- Decaimento semanal de entidades

### Fase 6 — Docker + Deploy (1 dia)

- Dockerfile com multi-stage build
- docker-compose com worker + Evolution API
- Script de setup da VPS (Ubuntu + Docker + bun)
- systemd service

**Total estimado: ~10 dias**

---

## Aproveitamento do JARVIS v5

| Componente | Arquivo | Uso no Worker |
|---|---|---|
| KeyPool | `src/services/api/keyPool.ts` | Gerenciamento de chaves com rotação e cooldown |
| Smart Routing | `src/services/api/smartRoutingBridge.ts` | Classificar pergunta e rotear pro modelo certo |
| Provider Resolver | `src/services/api/providerResolver.ts` | Resolver qual provedor atende a categoria |
| Cycle Recorder | `src/services/api/cycleRecorder.ts` | Log de cada chamada para auditoria |
| Cost Tracker | `src/cost-tracker.ts` | Cálculo de custo por requisição |
| Knowledge Graph | `src/utils/knowledgeGraph.ts` | Base do sistema de memória (adaptar pra multi-usuário) |
| ScheduleCronTool | `src/tools/ScheduleCronTool/prompt.ts` | Agendamento de tarefas (já ativo em open builds) |
| BriefTool | `src/tools/BriefTool/BriefTool.ts` | Canal de saída do modelo (SendUserMessage) |

O KAIROS (modo assistente do OpenClaude original) não está disponível no source snapshot — só existem stubs e feature flags desativadas. Este plano substitui o KAIROS do zero com Express + API REST + WhatsApp.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js + Bun |
| HTTP Server | Express |
| Database | SQLite (better-sqlite3) |
| Template | EJS ou HTML + htmx |
| WhatsApp | Evolution API (Docker) ou baileys |
| Sandbox | Docker (container descartável) |
| Deploy | Docker + systemd |
| VPS | Linux 2GB RAM (Hetzner €4, DigitalOcean $6, Oracle free) |
