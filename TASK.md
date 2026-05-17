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

## FASE 3 — WhatsApp Gateway

**Status**: ⏳ Pendente  
**Meta**: conectar ao WhatsApp via Evolution API (self-hosted) ou baileys.

### Tarefas

- [ ] `src/worker/gateways/whatsapp.ts` — interface abstrata `WhatsAppGateway`
- [ ] `src/worker/gateways/evolution.ts` — implementação Evolution API
- [ ] `src/worker/dispatcher.ts` — orquestra: webhook → JARVIS Worker → resposta
- [ ] `src/worker/server.ts` — adicionar rota `POST /webhooks/whatsapp`
- [ ] Gerenciamento de sessão por número de telefone
- [ ] Reconexão automática
- [ ] Documentação (`docs/worker/FASE3-WHATSAPP.md`)
- [ ] docker-compose.yml com Evolution API

### Critério de aceite

- ✅ Mensagem no WhatsApp → JARVIS responde em < 5s
- ✅ Desconexão → reconexão automática em < 30s
- ✅ Webhook POST `/webhooks/whatsapp` processa correctamente

---

## FASE 4 — Session Store SQLite

**Meta**: persistência real de conversas e memória.

### Tarefas

- [ ] `src/worker/db/schema.ts` — schema SQLite
- [ ] `src/worker/db/sessions.ts` — CRUD de sessões e mensagens
- [ ] `src/worker/db/memory.ts` — knowledge graph multi-usuário
- [ ] `src/worker/memory-extractor.ts` — extração automática pós-resposta
- [ ] Documentação (`docs/worker/FASE4-SQLITE.md`)

### Critério de aceite

- Histórico persiste entre restarts
- Query semântica retorna entidade correta

---

## FASE 5 — Budget Controller

**Meta**: controle de gastos por usuário com alertas.

### Tarefas

- [ ] `src/worker/budget.ts` — `BudgetController`
- [ ] Limite diário por usuário
- [ ] Alerta a 80% do limite
- [ ] Bloqueio automático ao estourar
- [ ] Documentação (`docs/worker/FASE5-BUDGET.md`)

### Critério de aceite

- Usuário bloqueado ao atingir limite diário
- Alerta enviado ao atingir 80%

---

## FASE 6 — Sentinela + Relatórios

**Meta**: monitoramento pró-ativo e relatórios automáticos.

### Tarefas

- [ ] `src/worker/sentinels.ts` — sentinela de custo + chaves
- [ ] Relatório diário (meia-noite)
- [ ] Alertas de 429 e cooldown
- [ ] Documentação (`docs/worker/FASE6-SENTINELAS.md`)

### Critério de aceite

- Sentinela detecta 429 e rotaciona pool automaticamente
- Relatório diário enviado à meia-noite

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
