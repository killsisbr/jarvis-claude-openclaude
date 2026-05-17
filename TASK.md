# JARVIS Worker — Task Tracker

> Construção do KAIROS: worker headless 24/7 com API REST + WhatsApp

**Início**: 2026-05-16  
**Última atualização**: 2026-05-16 (pós seleção CORE)

---

## STATUS GLOBAL

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Worker Headless (core + Express básico) | ✅ Concluído |
| 2 | Worker Standalone (main.ts + healthcheck completo) | ✅ Concluído |
| 3 | WhatsApp Baileys + Intent Router + Chat State Machine | ⏳ Pendente — CORE |
| 4 | Session Store SQLite + KnowledgeGraph + SpacedRep | ⏳ Pendente — CORE |
| 5 | Budget + Cache + Approval + Checkpoints + PlanMode | ⏳ Pendente — CORE |
| 6 | Sentinela + Cron embutido + Relatórios | ⏳ Pendente — CORE |
| 7 | Docker + Sandbox + Skills System | ⏳ Pendente |
| 8 | PC CLI Bridge (opcional, do JARVIS 5.0) | ⏳ Idea |

---

## MELHORIAS CORE APROVADAS (2026-05-16)

> Resultado da auditoria JARVIS 4.5 + 5.0. Tudo listado abaixo está **confirmado**
> para entrar nas Fases 3-6 (CORE). Documentos: [IDEIAS-JARVIS-4.5.md](docs/worker/IDEIAS-JARVIS-4.5.md),
> [IDEIAS-JARVIS-5.0.md](docs/worker/IDEIAS-JARVIS-5.0.md).

### Bloco essencial — TUDO entra no plano

| # | Melhoria | Fonte | Fase destino | Motivo |
|---|---|---|---|---|
| 1 | **Intent Router** (regex 11 cats PT-BR + LLM fallback) | 4.5 | Fase 3 | 90% das classificações grátis < 1ms |
| 2 | **Chat State Machine** (CRIADO→ATIVO→COMPLETO→FECHADO) | 4.5 | Fase 3 | Auto-close 24h, persistência por user |
| 3 | **ApprovalSystem** (Y/n + DANGER_LEVELS + timeout 5min) | 5.0 | Fase 5 | Pré-requisito antes de `/api/exec` |
| 4 | **Baileys WhatsApp** (50MB, sem Chromium) | 5.0 | Fase 3 | Substitui wwebjs (200MB) e Evolution API |
| 5 | **Checkpoints** (snapshots de arquivos + restore) | 5.0 | Fase 5 | Safety antes de edits destrutivos |
| 6 | **Plan Mode** (READONLY/SANDBOX/PRODUCTION) | 5.0 | Fase 5 | Controle de blast radius |
| 7 | **Cron embutido** (`schedule(name, ms, fn)`) | 4.5 | Fase 6 | Sem dep externa, padrão maduro |
| 8 | **Debounced saves** (universal) | 4.5 | Fases 4-6 | Zero I/O em hot path |

### Bloco bônus — entra na Fase 7+

| # | Melhoria | Fonte | Fase destino | Motivo |
|---|---|---|---|---|
| 9 | **Docker Sandbox** (`--network none` + mem/cpu) | 5.0 | Fase 7 | Necessário para `/api/exec` em prod |
| 10 | **Skill System** (pasta + hooks, API Anthropic-style) | 5.0 | Fase 7 | Extensibilidade sem tocar no core |
| 11 | **Spaced Repetition + Decay** (relevância cai) | 4.5 | Fase 4 | Auto-limpeza de learnings velhos |
| 12 | **Knowledge Graph BFS** (entidades + `findConnected`) | 4.5 | Fase 4 | Memória relacional multi-usuário |
| 13 | **Semantic Cache** (SHA-256 + TTL) | 4.5 | Fase 5 | ~30% economia LLM em uso típico |
| 14 | **WebSocket Bridge + fila offline** | 5.0 | Fase 8 | PC CLI bridge (opcional) |

### Descartado explicitamente (não revisitar)

- ❌ **Consciousness / metacognition** — sem benefício mensurável
- ❌ **Auto-Evolution / Self-Improver / DNA Evolver** — perigosos mesmo com pipeline 8 estágios
- ❌ **22 specialist agents** — excesso de granularidade, manutenção infernal
- ❌ **Swarm Learning via Git** — 430 LOC só de orchestration, ROI baixo single-tenant
- ❌ **opencode-zen "Big Pickle"** — proprietário, sem fallback testado
- ❌ **MCP/Discord/Telegram stubs** — já descartados na própria 4.5
- ❌ **148 scripts MJS de diagnóstico** — caos; 1-2 scripts bem feitos bastam

---

## PADRÕES DE ENGENHARIA OBRIGATÓRIOS

> Toda nova implementação deve seguir estes padrões (do JARVIS 4.5/5.0 e do OC).

1. **Debounced save** em todo módulo persistente (1s delay)
2. **Offline-first com timeout** em toda chamada externa
3. **`execFile` + allowlist** (NUNCA `exec()`) para qualquer execução de comando
4. **Módulos < 500 LOC** focados em uma responsabilidade
5. **State machine explícita** em qualquer fluxo de vida (sessões, tarefas, approvals)
6. **EventEmitter** para extensibilidade (sem reinventar event bus)
7. **Feature flags reais** em settings.json (sem `if (false)`)
8. **Sanitização de logs** — nunca logar tokens/senhas (usar `sanitizeParams()`)

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

## FASE 3 — WhatsApp Baileys + Intent Router + Chat State Machine

**Status**: ⏳ Pendente — CORE  
**Meta**: conectar ao WhatsApp via Baileys, classificar intents por regex, gerenciar sessões com state machine.

> **Melhorias CORE incluídas**: #1 Intent Router, #2 Chat State Machine, #4 Baileys.

### Tarefas

**Setup:**
- [ ] 🔥 `bun add @whiskeysockets/baileys qrcode-terminal`

**WhatsApp Gateway (Baileys — #4):**
- [ ] 🔥 `src/worker/gateways/whatsapp.ts` — interface `WhatsAppGateway`
- [ ] 🔥 `src/worker/gateways/baileys.ts` — implementação portada do JARVIS 5.0:
  - `useMultiFileAuthState` para persistência
  - Auto-admin assignment (primeira mensagem define admin)
  - Auto-reconnect exponential backoff (1s → 2s → 4s... max 30s, 5 tentativas)
  - Áudio: download → Whisper STT → transcrição
  - Imagem: download → Gemini Vision → análise
  - `sendDocument()` para anexos
  - `sendAlert()` para notificações proativas

**Intent Router (#1):**
- [ ] 🔥 `src/worker/intent-router.ts` — regex 11 categorias PT-BR (do JARVIS 4.5)
  - CREATE/FIX/DEPLOY/EXPLAIN/DEBUG/STATUS/ARCHITECT/REVIEW/SUPPORT/CLOSE/UNKNOWN
  - Fast path: regex < 1ms (90% dos casos)
  - Slow path: LLM fallback para os 10% ambíguos
  - `detectProject()` + `extractEntities()` (files/commands/paths/errors)

**Chat State Machine (#2):**
- [ ] 🔥 `src/worker/chat-session.ts` — state machine portada do 4.5
  - 6 estados: CRIADO/ANALISANDO/ATIVO/AGUARDANDO/COMPLETO/FECHADO
  - Auto-close 24h de inatividade
  - Auto-save a cada 30s
  - Reabertura de sessão fechada

**Orquestração:**
- [ ] `src/worker/messages.ts` — templates de mensagens centralizadas (TASK_START, WELCOME, HELP, etc.)
- [ ] `src/worker/dispatcher.ts` — orquestra: msg → IntentRouter → ChatSession → Worker → resposta
- [ ] `src/worker/server.ts` — adicionar `GET /api/whatsapp/qr` + `/api/whatsapp/status`
- [ ] Documentação (`docs/worker/FASE3-WHATSAPP.md` — atualizar para Baileys)

### Critério de aceite

- ✅ Mensagem no WhatsApp → JARVIS responde em < 5s
- ✅ Desconexão → reconexão automática (exponential backoff)
- ✅ Intent router classifica 90% por regex (sem LLM call)
- ✅ Sessão WhatsApp persiste entre restarts (multiFileAuthState)
- ✅ RAM total < 100MB (vs ~200MB do wwebjs)

---

## FASE 4 — Session Store SQLite + KnowledgeGraph + SpacedRep

**Status**: ⏳ Pendente — CORE  
**Meta**: persistência real de conversas, knowledge graph e learnings.

> **Melhorias CORE incluídas**: #8 Debounced saves. **Melhorias bônus**: #11 Spaced Repetition + Decay, #12 Knowledge Graph BFS.

### Tarefas

**Setup:**
- [ ] `bun add better-sqlite3 @types/better-sqlite3`

**Schema:**
- [ ] `src/worker/db/schema.ts` — schema SQLite com 7 tabelas:
  - sessions (chatId, state, currentProject, intent, idleSince, autoCloseAt)
  - messages (sessionId, role, content, tokens, cost, metadata)
  - budget_daily (user_phone, date, cost, tokens)
  - entities (knowledge graph nodes — id, type, properties, weight)
  - relations (knowledge graph edges — source, target, type, weight)
  - learnings (id, type, category, confidence, relevance, nextReviewAt)
  - learning_index (cross-reference + spaced repetition)

**CRUD + State Machine:**
- [ ] `src/worker/db/sessions.ts` — CRUD integrado com ChatSession state machine (Fase 3)

**Knowledge Graph BFS (#12):**
- [ ] `src/worker/db/memory.ts` — `findConnected(nodeId, maxDepth=2)` com weight tracking
- [ ] `src/worker/memory-extractor.ts` — extração automática pós-resposta (Haiku)

**Spaced Repetition + Decay (#11):**
- [ ] `src/worker/db/learnings.ts` — Pipeline propose/validate/register
  - REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60]
  - DECAY_RATE = 0.02 (2% por dia inativo)
  - Garbage collection: relevance < 0.05 + 90 dias inativo + LOW conf → delete

**Debounced Saves (#8) — padrão universal:**
- [ ] 🔥 `src/worker/auto-save.ts` — batch writes 1s delay para todos os módulos persistentes

**Docs:**
- [ ] Documentação (`docs/worker/FASE4-SQLITE.md`)

### Critério de aceite

- Histórico persiste entre restarts (LocalAuth + SQLite)
- Knowledge graph BFS retorna entidades relacionadas em 2 hops
- Spaced repetition agenda reviews (1d, 3d, 7d, 14d, 30d, 60d)
- Sessões auto-save a cada 30s (não a cada mensagem)

---

## FASE 5 — Budget + Cache + Approval + Checkpoints + PlanMode

**Status**: ⏳ Pendente — CORE  
**Meta**: controle de gastos + cache de respostas + segurança em mudanças destrutivas.

> **Melhorias CORE incluídas**: #3 ApprovalSystem, #5 Checkpoints, #6 Plan Mode. **Melhorias bônus**: #13 Semantic Cache.

### Tarefas

**Budget Controller:**
- [ ] `src/worker/budget.ts` — BudgetController com limite por usuário + global
- [ ] Alerta a 80% + bloqueio automático ao estourar

**Semantic Cache (#13):**
- [ ] `src/worker/response-cache.ts` — file-based cache
  - SHA-256 do prompt (lowercase + trim)
  - TTL por categoria (status=5min, code=1h, explain=24h)
  - LRU eviction > 1000 entries
  - Stats: hits/misses/hit_rate

**ApprovalSystem (#3) — pré-requisito para `/api/exec`:**
- [ ] 🔥 `src/worker/approval-system.ts` — Y/n com DANGER_LEVELS portado do 5.0
  - 4 níveis: low/medium/high/critical (high+critical pedem aprovação)
  - sanitizeParams() para mascarar tokens/senhas em logs
  - waitForApproval(id, timeout=5min)
  - History de 100 approvals
  - EventEmitter (approved/denied/requested)

**Checkpoints (#5) — antes de edits destrutivos:**
- [ ] 🔥 `src/worker/checkpoints.ts` — snapshots de arquivos portado do 5.0
  - create(name, files) → checkpointId
  - restore(checkpointId) → restaura arquivos
  - BranchManager opcional para múltiplos estados
  - Persistência JSON em `~/.jarvis/checkpoints/`

**Plan Mode (#6) — controle de blast radius:**
- [ ] 🔥 `src/worker/plan-mode.ts` — 4 modos de operação portado do 5.0
  - ANALYSIS: só leitura + network (read-only research)
  - READONLY: só leitura, sem network, sem MCP
  - SANDBOX: write + bash + sem network (testes seguros)
  - PRODUCTION: tudo liberado
  - `manager.checkPermission(action, target)` antes de cada tool
  - Integrado com ApprovalSystem (PRODUCTION + critical → aprovação)

**Docs:**
- [ ] Documentação (`docs/worker/FASE5-SECURITY.md`)

### Critério de aceite

- ✅ Usuário bloqueado ao atingir limite diário
- ✅ Cache hit rate > 20% em uso típico
- ✅ Ação `critical` (delete dir, exec destrutivo) pede Y/n via API
- ✅ Edição de arquivo cria checkpoint automaticamente
- ✅ Plan mode READONLY bloqueia 100% das writes

---

## FASE 6 — Cron embutido + Sentinelas + Relatórios

**Status**: ⏳ Pendente — CORE  
**Meta**: monitoramento pró-ativo + cron jobs internos sem dep externa.

> **Melhorias CORE incluídas**: #7 Cron embutido (`schedule(name, ms, fn)`).

### Tarefas

**Cron Scheduler (#7):**
- [ ] 🔥 `src/worker/cron-scheduler.ts` — CronSystem portado do JARVIS 4.5
  - API: `schedule(name, ms, fn)` / `cancel(name)` / `list()`
  - Sem dep externa (só `setInterval`)
  - Logging automático de execuções
  - Error handling isolado (1 job não derruba outros)
  - `lastRun` tracking por job

**Sentinelas (handlers dos jobs):**
- [ ] `src/worker/sentinels.ts` — implementação dos jobs default:
  - `health-check` (60s): alerta se CPU/RAM/disk > limite
  - `key-health-check` (1min): rotaciona pool em 429
  - `cost-sentinel` (5min): alerta se gasto > limite
  - `memory-consolidation` (4h): extração de aprendizados via Haiku
  - `daily-report` (24h meia-noite): resumo WhatsApp do dia
  - `spaced-repetition-decay` (24h): aplica decay nos learnings (Fase 4)

**Server endpoints:**
- [ ] `src/worker/server.ts` — adicionar `GET /api/cron` (lista jobs + lastRun + status)

**Docs:**
- [ ] Documentação (`docs/worker/FASE6-SENTINELAS.md`)

### Critério de aceite

- Sentinela detecta 429 e rotaciona pool automaticamente
- Relatório diário enviado à meia-noite
- Cron jobs sobrevivem a errors individuais
- `/api/cron` lista status de todos os jobs

---

## FASE 7 — Docker + Deploy + Sandbox + Skills

**Status**: ⏳ Pendente  
**Meta**: containerização, deploy, sandbox para `/api/exec`, sistema de plugins.

> Auditoria 5.0 adicionou: Docker Sandbox (descartável para cada exec),
> Skill System (Anthropic-style — extensibilidade sem tocar no core).

### Tarefas

**Deploy:**
- [ ] `Dockerfile` multi-stage para o worker
- [ ] `docker-compose.yml` (worker only — Baileys é Node nativo, sem Evolution API)
- [ ] Script `scripts/setup-vps.sh` (Ubuntu + bun + node)
- [ ] `systemd` service `jarvis-worker.service`

**Sandbox (do JARVIS 5.0):**
- [ ] `src/worker/sandbox.ts` — Docker container descartável
  - Image: `jarvis-sandbox:latest`
  - `--network none` (sem internet)
  - Memory/CPU limits (512m/0.5)
  - `runCommand(cmd)` → `{stdout, stderr, exitCode}`
  - Auto-cleanup
- [ ] `src/worker/server.ts` — adicionar `POST /api/exec` com sandbox
- [ ] Integração com ApprovalSystem (Fase 5)

**Skill System (do JARVIS 5.0):**
- [ ] `src/worker/skills/registry.ts` — SkillRegistry
  - load() escaneia `worker/skills/*/skill.js`
  - Hooks: onStartup/onShutdown/onMessage/beforeExecute/afterExecute
  - findByCommand() para roteamento
- [ ] `src/worker/skills/example/skill.js` — skill template

**Documentação:**
- [ ] `docs/worker/FASE7-DEPLOY.md`

### Critério de aceite

- ✅ `docker-compose up` inicia worker em < 30s
- ✅ Worker reinicia com `restart: unless-stopped`
- ✅ `POST /api/exec` roda em sandbox com timeout
- ✅ Skills custom carregam de `worker/skills/`

---

## FASE 8 — PC CLI Bridge (OPCIONAL, do JARVIS 5.0)

**Status**: ⏳ Idea  
**Meta**: cliente CLI local que conecta na VPS via WebSocket.

> Inspirado em `pc-cli/` do JARVIS 5.0. Permite controlar a VPS de qualquer
> terminal (Windows/Linux) com `jarvis ask "..."`. Útil para uso pessoal,
> opcional para multi-tenant.

### Tarefas (se decidir implementar)

- [ ] `pc-cli/` — projeto Node separado, instala globalmente
- [ ] `pc-cli/bin/cli.js` — entrypoint `jarvis`
- [ ] Comandos:
  - `jarvis ask "..."` — pergunta direta
  - `jarvis chat` — REPL interativo
  - `jarvis listen` — stream de eventos (alertas, logs)
  - `jarvis status` — health da VPS
  - `jarvis fetch <path>` — extrair arquivo da VPS
- [ ] `pc-cli/lib/ws-client.js` — cliente WebSocket criptografado
- [ ] `src/worker/server.ts` — adicionar WebSocket endpoint
- [ ] Auth via token (`WS_SECRET` em .env)
- [ ] Fila offline (`MESSAGE_QUEUE` quando PC desconectado)
- [ ] Notificações OS nativas (Windows balloon, Linux notify-send)

### Critério de aceite

- ✅ `jarvis ask "..."` no PC chega na VPS e volta < 2s
- ✅ PC desconecta + reconecta → mensagens da fila são entregues
- ✅ Alerta crítico (CPU > 90%) gera notification no PC

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
