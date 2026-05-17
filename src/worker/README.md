# JARVIS Worker — API REST Headless

O worker é um processo independente que roda 24/7 e expõe o JARVIS via HTTP, sem terminal interativo.

**Versão**: v5.0.0-worker (Fases 1-2 implementadas)

---

## Quickstart

### 1. Rodar com fallback (env vars)

```bash
export OPENAI_BASE_URL=https://api.deepseek.com/v1
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=deepseek-chat
export WORKER_PORT=3000

bun run worker
```

Resposta esperada:
```
╔════════════════════════════════════════╗
║   JARVIS Worker v5.0.0 (Headless)     ║
║   Zero-Telemetry AI Coding Agent       ║
╚════════════════════════════════════════╝

[startup] Carregando configuração...
[config] Configuração carregada
  Fonte: env-fallback
  Fallback: https://api.deepseek.com/v1 | deepseek-chat
[startup] ✓ JarvisWorker pronto
[startup] ✓ Servidor rodando em http://localhost:3000
```

### 2. Testar

```bash
# Health check
curl http://localhost:3000/health

# Enviar mensagem
curl -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"user": "dev", "message": "oi"}'

# Ver custo
curl http://localhost:3000/api/cost
```

---

## Configuração Avançada (settings.json)

Copiar exemplo:
```bash
cp docs/worker/settings.example.json ~/.jarvis/settings.json
```

Editar com seus providers:
```json
{
  "smartRouting": {
    "enabled": true,
    "targets": {
      "simple": "deepseek-chat",
      "code": "claude-sonnet-4-5",
      "reasoning": "claude-sonnet-4-5"
    }
  },
  "agentModels": {
    "deepseek": {
      "base_url": "https://api.deepseek.com/v1",
      "api_keys_env": "DEEPSEEK_API_KEY_*",
      "model": "deepseek-chat"
    },
    "zen": {
      "base_url": "https://api.zenops.io/v1",
      "api_keys_env": "ZEN_API_KEY_*",
      "model": "claude-sonnet-4-5"
    }
  }
}
```

Expandir env vars:
```bash
export ZEN_API_KEY_1=zen-key-1
export ZEN_API_KEY_2=zen-key-2
export ZEN_API_KEY_3=zen-key-3
export DEEPSEEK_API_KEY_1=sk-...

bun run worker
```

O worker carrega automaticamente:
- `~/.jarvis/settings.json` (novo)
- `.openclaude-profile.json` (legacy)
- Fallback: env vars

---

## Rotas HTTP

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/health` | Status do worker + uptime + pool stats |
| `POST` | `/api/chat` | Enviar mensagem e receber resposta |
| `GET` | `/api/cost` | Custo do dia + estatísticas |
| `GET` | `/api/keys` | Status dos pools de chave |

### POST /api/chat

**Request:**
```json
{
  "user": "seu-user-id",
  "message": "qual é o custo de usar DeepSeek?"
}
```

**Response:**
```json
{
  "session": "seu-user-id-1715946000000",
  "reply": "DeepSeek custa X por token...",
  "cost": 0.0015,
  "model": "deepseek-chat",
  "tokens": {
    "input": 120,
    "output": 45
  },
  "latency_ms": 1200,
  "category": "reasoning"
}
```

### GET /health

```json
{
  "status": "running",
  "uptime": 3600,
  "version": "v5.0.0-worker",
  "sessions_active": 2,
  "cost_today": 0.47,
  "queries_total": 142,
  "queue_size": 0
}
```

### GET /api/cost

```json
{
  "cost_today": 0.47,
  "queries_today": 142,
  "sessions_active": 2,
  "pools": [
    {
      "name": "zen",
      "active_keys": 3,
      "cooldown_keys": 0,
      "total_keys": 3
    },
    {
      "name": "deepseek",
      "active_keys": 2,
      "cooldown_keys": 0,
      "total_keys": 2
    }
  ]
}
```

---

## Scripts npm

```bash
# Produção (uma vez)
bun run worker

# Desenvolvimento (watch mode, reinicia ao detectar mudanças)
bun run worker:dev

# Test das rotas (em outro terminal)
curl http://localhost:3000/health
```

---

## Arquitetura

```
         ┌─────────────────────────────┐
         │  HTTP Client (curl, JS, etc) │
         └──────────────┬──────────────┘
                        │
                        ▼
         ┌─────────────────────────────┐
         │     Express (server.ts)      │
         │  GET /health, POST /api/chat │
         └──────────────┬──────────────┘
                        │
                        ▼
         ┌─────────────────────────────┐
         │    JarvisWorker (core.ts)    │
         │  processPrompt() / getStats()│
         └──────────────┬──────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
      SmartRoute   KeyPool        CycleRecorder
      Classify    Rotate keys     Log routing
                                   (JSONL)
         │              │              │
         └──────────────┼──────────────┘
                        │
                        ▼
         ┌─────────────────────────────┐
         │   HTTP call to LLM Provider  │
         │   (OpenAI-compatible API)    │
         └─────────────────────────────┘
```

---

## Próximas Fases

- **Fase 3**: WhatsApp Gateway (Evolution API)
- **Fase 4**: SQLite Session Store
- **Fase 5**: Budget Controller + Alertas
- **Fase 6**: Sentinelas + Relatórios
- **Fase 7**: Docker + Deploy na VPS

Ver `TASK.md` e `docs/worker/FASE*.md` para detalhes.

---

## Troubleshooting

### `OPENAI_BASE_URL não definida`

```bash
export OPENAI_BASE_URL=https://api.deepseek.com/v1
export OPENAI_API_KEY=sk-...
```

### `settings.json` não encontrada, usando fallback

Normal — o worker roda com fallback env vars. Para usar smart routing:
```bash
mkdir -p ~/.jarvis
cp docs/worker/settings.example.json ~/.jarvis/settings.json
# Editar com seus providers
bun run worker
```

### Porta já em uso

```bash
WORKER_PORT=3001 bun run worker
```

### Logs muito silenciosos

O worker loga em nível de startup/erro. Para debug, editar `src/worker/main.ts` e adicionar console.log.

---

## Desenvolvimento

```bash
# Build check
bun build src/worker/main.ts --target bun

# Lint (tsc)
bun run typecheck

# Testes (quando existirem)
bun test src/worker/**/*.test.ts
```

---

## Zero Telemetry

O worker **não** faz nenhuma chamada para fora além de:
- Provider de LLM (baseURL do settings.json ou env var)
- WhatsApp/Evolution API (Fase 3+)

**Verificado**: `verify:privacy` passa.

---

**Mantido por**: JARVIS v5 Core  
**Última atualização**: 2026-05-16
