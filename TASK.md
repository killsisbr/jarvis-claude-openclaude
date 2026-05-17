# JARVIS Worker — Task Tracker

> Construção do KAIROS: worker headless 24/7 com API REST + WhatsApp

**Início**: 2026-05-16  
**Última atualização**: 2026-05-16

---

## STATUS GLOBAL

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Worker Headless (core + Express básico) | ✅ Concluído |
| 2 | Worker Standalone (main.ts + healthcheck completo) | ✅ Concluído |
| 3 | WhatsApp Gateway (Evolution API / baileys) | ⏳ Pendente |
| 4 | Session Store SQLite + Memória permanente | ⏳ Pendente |
| 5 | Budget Controller + Segurança | ⏳ Pendente |
| 6 | Sentinela + Relatórios automáticos | ⏳ Pendente |
| 7 | Docker + Deploy na VPS | ⏳ Pendente |

---

## FASE 1 — Worker Headless

**Status**: ✅ Concluído  
**Meta**: extrair o core do JARVIS do terminal Ink/React, expor `JarvisWorker.processPrompt()` via Express.

### Tarefas

- [x] Documentação da fase (`docs/worker/FASE1-WORKER-HEADLESS.md`)
- [x] `src/worker/worker-core.ts` — classe `JarvisWorker`
- [x] `src/worker/session-store.ts` — gerenciamento de sessões em memória (sem SQLite ainda)
- [x] `src/worker/server.ts` — Express: `/api/chat`, `/health`, `/api/cost`, `/api/keys`
- [x] `src/worker/index.ts` — entrypoint `bun run src/worker/index.ts`
- [x] Testar localmente: `bun run src/worker/index.ts`
- [x] Verificar que a resposta de `/health` retorna JSON correto

### Arquivos criados

- `src/worker/worker-core.ts`
- `src/worker/session-store.ts`
- `src/worker/server.ts`
- `src/worker/index.ts`
- `docs/worker/FASE1-WORKER-HEADLESS.md`

### Critério de aceite ✅

- ✅ `POST /api/chat` recebe `{ user, message }` e retorna `{ reply, cost, tokens }`
- ✅ `GET /health` retorna `{ status: "running", uptime, sessions_active, cost_today }`

---

## FASE 2 — Worker Standalone

**Status**: ✅ Concluído  
**Meta**: processo independente com carregamento completo de config, smart routing e key pools.

### Tarefas

- [x] `src/worker/config.ts` — carregamento de settings.json + env vars com pattern matching
- [x] `src/worker/main.ts` — entrypoint de produção com logging de startup
- [x] Script npm: `bun run worker` (usa main.ts)
- [x] Documentação (`docs/worker/FASE2-STANDALONE.md`)
- [x] Arquivo de exemplo (`docs/worker/settings.example.json`)
- [x] Testar startup com fallback env

### Arquivos criados/modificados

- `src/worker/config.ts` — LoadedConfig, parseSettingsJson, expandEnvPattern
- `src/worker/main.ts` — entrypoint com logging completo + graceful shutdown
- `docs/worker/FASE2-STANDALONE.md`
- `docs/worker/settings.example.json`
- `package.json` — scripts "worker" + "worker:dev"

### Critério de aceite ✅

- ✅ `bun run worker` inicia sem depender de Ink/React
- ✅ Carrega settings.json com smartRouting + agentModels
- ✅ Expande env vars: `ZEN_API_KEY_*` → array de chaves
- ✅ Logging de startup mostra: fonte de config, providers carregados, pool stats

---

## FASE 3 — WhatsApp Gateway (REVISADA pós JARVIS 4.5 audit)

**Status**: ⏳ Pendente  
**Meta**: conectar ao WhatsApp via **whatsapp-web.js** (não mais Evolution API).

> **Decisão de arquitetura**: análise do `JARVIS-4.5` (ver [IDEIAS-JARVIS-4.5.md](docs/worker/IDEIAS-JARVIS-4.5.md))
> mostrou que `whatsapp-web.js` (wwebjs) com LocalAuth é mais simples, sem Docker
> overhead. Evolution API fica como fallback opcional.

### Tarefas

- [ ] `bun add whatsapp-web.js qrcode` (dependências)
- [ ] `src/worker/gateways/whatsapp.ts` — interface abstrata `WhatsAppGateway`
- [ ] `src/worker/gateways/wwebjs.ts` — implementação com wwebjs + LocalAuth
- [ ] `src/worker/gateways/evolution.ts` — implementação Evolution API (opcional)
- [ ] `src/worker/intent-router.ts` — regex pre-classification (portado do JARVIS 4.5)
- [ ] `src/worker/messages.ts` — templates de mensagens centralizadas
- [ ] `src/worker/dispatcher.ts` — orquestra: webhook → JARVIS Worker → resposta
- [ ] `src/worker/server.ts` — adicionar `GET /qrcode` para escaneamento
- [ ] QR code auto-restart + max attempts (5)
- [ ] Auto-reconnect em disconnected (10s delay)
- [ ] Chrome path autodetect (Windows/Linux)
- [ ] Documentação (`docs/worker/FASE3-WHATSAPP.md` — atualizar)

### Critério de aceite

- ✅ Mensagem no WhatsApp → JARVIS responde em < 5s
- ✅ Desconexão → reconexão automática em < 30s
- ✅ Intent router classifica 90% por regex (sem LLM call)
- ✅ Sessão WhatsApp persiste entre restarts (LocalAuth)

---

## FASE 4 — Session Store SQLite (EXPANDIDA pós JARVIS 4.5 audit)

**Status**: ⏳ Pendente  
**Meta**: persistência real de conversas, knowledge graph e learnings.

> Análise do JARVIS 4.5 adicionou: ChatSession state machine, KnowledgeGraph BFS,
> Spaced Repetition, Learning Pipeline.

### Tarefas

- [ ] `bun add better-sqlite3 @types/better-sqlite3`
- [ ] `src/worker/db/schema.ts` — schema SQLite com 7 tabelas:
  - sessions (chatId, state, currentProject, intent, idleSince, autoCloseAt)
  - messages (sessionId, role, content, tokens, cost, metadata)
  - budget_daily (user_phone, date, cost, tokens)
  - entities (knowledge graph nodes — id, type, properties, weight)
  - relations (knowledge graph edges — source, target, type, weight)
  - learnings (id, type, category, confidence, relevance, nextReviewAt)
  - learning_index (cross-reference + spaced repetition)
- [ ] `src/worker/db/sessions.ts` — CRUD com state machine (CRIADO→ATIVO→COMPLETO→FECHADO)
- [ ] `src/worker/db/memory.ts` — KnowledgeGraph com BFS findConnected()
- [ ] `src/worker/db/learnings.ts` — Pipeline propose/validate/register
- [ ] `src/worker/memory-extractor.ts` — extração automática pós-resposta (Haiku)
- [ ] `src/worker/auto-save.ts` — debounced batch writes (1s delay)
- [ ] Documentação (`docs/worker/FASE4-SQLITE.md`)

### Critério de aceite

- Histórico persiste entre restarts (LocalAuth + SQLite)
- Knowledge graph BFS retorna entidades relacionadas em 2 hops
- Spaced repetition agenda reviews (1d, 3d, 7d, 14d, 30d, 60d)
- Sessões auto-save a cada 30s (não a cada mensagem)

---

## FASE 5 — Budget + Semantic Cache (EXPANDIDA)

**Status**: ⏳ Pendente  
**Meta**: controle de gastos por usuário + cache de respostas.

> JARVIS 4.5 mostrou que cache SHA-256 + TTL economiza ~30% das chamadas LLM.

### Tarefas

- [ ] `src/worker/budget.ts` — `BudgetController`
- [ ] Limite diário por usuário
- [ ] Limite global
- [ ] Alerta a 80% do limite
- [ ] Bloqueio automático ao estourar
- [ ] `src/worker/response-cache.ts` — semantic cache file-based
  - SHA-256 do prompt (lowercase + trim)
  - TTL configurável por categoria (status=5min, code=1h, explain=24h)
  - LRU eviction quando > 1000 entries
  - Stats: hits/misses/hit_rate
- [ ] Documentação (`docs/worker/FASE5-BUDGET-CACHE.md`)

### Critério de aceite

- Usuário bloqueado ao atingir limite diário
- Alerta enviado ao atingir 80%
- Cache hit rate > 20% em uso típico
- `/api/cost` mostra economia por cache

---

## FASE 6 — Sentinela + Cron + Relatórios

**Status**: ⏳ Pendente  
**Meta**: monitoramento pró-ativo + cron jobs internos.

> Padrão CronSystem do JARVIS 4.5: `schedule(name, ms, fn)` sem dependência externa.

### Tarefas

- [ ] `src/worker/cron-scheduler.ts` — CronSystem com setInterval
  - API: `schedule(name, ms, fn)` / `cancel(name)`
  - Logging automático de execuções
  - Error handling (não derruba outros jobs)
- [ ] `src/worker/sentinels.ts` — handlers para os jobs:
  - `cost-sentinel` (5min): alerta se gasto > limite
  - `key-health-check` (1min): rotaciona pool em 429
  - `daily-report` (24h meia-noite): envia resumo WhatsApp
  - `memory-consolidation` (4h): roda extração de aprendizados
  - `spaced-repetition-decay` (24h): aplica decay nos learnings
- [ ] Documentação (`docs/worker/FASE6-SENTINELAS.md`)

### Critério de aceite

- Sentinela detecta 429 e rotaciona pool automaticamente
- Relatório diário enviado à meia-noite
- Cron jobs sobrevivem a errors individuais
- `/api/cron` lista status de todos os jobs

---

## FASE 7 — Docker + Deploy

**Meta**: containerização e deploy na VPS.

### Tarefas

- [ ] `Dockerfile` multi-stage
- [ ] `docker-compose.yml` (worker + Evolution API)
- [ ] Script de setup da VPS
- [ ] `systemd` service file
- [ ] Documentação (`docs/worker/FASE7-DEPLOY.md`)

### Critério de aceite

- `docker-compose up` inicia tudo
- Worker reinicia automaticamente com `restart: unless-stopped`

---

---

## RESUMO DE PROGRESSO (2026-05-16)

**Fases concluídas**: 2 de 7 (28%)  
**Linhas de código**: ~900 LOC (worker-core.ts + server.ts + config.ts + main.ts)  
**Tempo estimado para produção**: ~9 dias (Fases 1-7)

**Status por componente:**

| Componente | Status | Arquivo |
|---|---|---|
| JarvisWorker core | ✅ | `src/worker/worker-core.ts` (340 LOC) |
| Express server | ✅ | `src/worker/server.ts` (90 LOC) |
| Session store (memória) | ✅ | `src/worker/session-store.ts` (95 LOC) |
| Config loader | ✅ | `src/worker/config.ts` (220 LOC) |
| Entrypoint | ✅ | `src/worker/main.ts` + `index.ts` |
| Smart routing | ✅ (herança) | Reusa `src/services/api/smartRoutingBridge.ts` |
| KeyPool | ✅ (herança) | Reusa `src/services/api/keyPool.ts` |
| WhatsApp gateway | ⏳ | Será `src/worker/gateways/` |
| SQLite store | ⏳ | Será `src/worker/db/` |
| Budget controller | ⏳ | Será `src/worker/budget.ts` |
| Sentinelas | ⏳ | Será `src/worker/sentinels.ts` |

**Como usar agora:**

```bash
# 1. Configure fallback env (ou settings.json)
export OPENAI_BASE_URL=https://api.deepseek.com/v1
export OPENAI_API_KEY=sk-...

# 2. Rodar worker
bun run worker

# 3. Testar
curl http://localhost:3000/health
curl -X POST http://localhost:3000/api/chat \
  -d '{"user": "dev", "message": "oi"}'
```

**Como começar Fase 3:**

1. Ver `docs/worker/FASE3-WHATSAPP.md`
2. Criar `src/worker/gateways/whatsapp.ts` (interface)
3. Criar `src/worker/gateways/evolution.ts` (implementação)
4. Criar `src/worker/dispatcher.ts` (orquestra mensagens)
5. Adicionar `POST /webhooks/whatsapp` no server.ts
6. Testar webhook

---

## DECISÕES DE ARQUITETURA

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| HTTP server | Express | Simples, maduro, ecossistema amplo |
| WhatsApp | Evolution API (Fase 3) → baileys (fallback) | Evolution gerencia QR/reconexão automaticamente |
| Banco de dados | SQLite (better-sqlite3) | Zero infra, suficiente para 1-10 usuários |
| Template engine | HTML + htmx | Sem build step, semântico |
| Sandbox exec | Docker descartável | Isolamento real, timeout garantido |
| STT | whisper.cpp local | Privacidade first |

---

## DEPENDÊNCIAS NOVAS NECESSÁRIAS

```bash
bun add express better-sqlite3 @types/express @types/better-sqlite3
```

Para WhatsApp (Fase 3):
```bash
bun add @evolution-api/client
# ou
bun add @whiskeysockets/baileys
```
