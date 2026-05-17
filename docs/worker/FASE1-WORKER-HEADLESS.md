# Fase 1 — Worker Headless

> Extrair o core do JARVIS do terminal Ink/React e expor via Express.

**Status**: Implementado  
**Data**: 2026-05-16

---

## Objetivo

O OpenClaude original roda com Ink (React para terminal). O worker headless remove essa dependência e expõe a mesma lógica via HTTP, permitindo que qualquer cliente (WhatsApp, web, curl) interaja com o JARVIS.

---

## Arquitetura

```
                        ┌─────────────────┐
    POST /api/chat  ──→ │    server.ts    │
    GET  /health    ──→ │    (Express)    │
    GET  /api/cost  ──→ └────────┬────────┘
    GET  /api/keys               │
                                 ▼
                        ┌─────────────────┐
                        │  worker-core.ts │
                        │  JarvisWorker   │
                        └────────┬────────┘
                                 │
                   ┌─────────────┼──────────────┐
                   ▼             ▼              ▼
            KeyPool       SmartRouting    CycleRecorder
        (key rotation)   (categorize)    (JSONL log)
                   │             │
                   └─────────────┘
                                 │
                                 ▼
                        LLM via HTTP (OpenAI-compat)
```

---

## Arquivos

### `src/worker/worker-core.ts`

Classe `JarvisWorker` — faz tudo que o loop Ink faz, sem UI.

**Interface pública:**

```typescript
class JarvisWorker {
  async processPrompt(userMessage: string, sessionId: string): Promise<WorkerResponse>
  getStats(): WorkerStats
  getKeyPoolStats(): PoolStats[]
  getCostToday(): number
}

type WorkerResponse = {
  reply: string
  sessionId: string
  cost: number
  model: string
  tokens: { input: number; output: number }
  latencyMs: number
  category: string   // routing category (explore/plan/code/summarize/default)
}
```

**O que acontece internamente em `processPrompt()`:**

1. Recupera a sessão (histórico de mensagens)
2. Chama `trySmartRoute()` para classificar o turno e resolver provider
3. Faz a chamada HTTP ao LLM via endpoint OpenAI-compat
4. Registra o ciclo em `CycleRecorder`
5. Atualiza contadores de custo
6. Retorna a resposta formatada

### `src/worker/session-store.ts`

Gerenciamento de sessões em memória (Fase 1 — sem SQLite).

- Cria sessão por `userId`
- Mantém histórico de mensagens `{ role, content }[]`
- TTL de 2 horas (sessão expira se inativa)

### `src/worker/server.ts`

Servidor Express com as rotas:

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status do worker |
| POST | `/api/chat` | Enviar mensagem |
| GET | `/api/cost` | Custo do dia |
| GET | `/api/keys` | Status dos pools de chave |

### `src/worker/index.ts`

Entrypoint: inicializa JarvisWorker + Express + escuta na porta.

---

## Como rodar

```bash
# instalar dependências (se ainda não instalou)
bun install

# rodar o worker
bun run src/worker/index.ts

# testar
curl http://localhost:3000/health

curl -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"user": "dev", "message": "oi, tudo bem?"}'
```

---

## Configuração

O worker usa as mesmas variáveis de ambiente do JARVIS principal:

```env
# Provider principal (fallback)
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_API_KEY=sk-...

# Smart routing (opcional)
JARVIS_SMART_ROUTING=true

# Zen Key Pool
ZEN_API_KEY_1=zen-...
ZEN_API_KEY_2=zen-...

# Porta do worker
WORKER_PORT=3000
```

---

## Limitações desta fase

- Sessões em memória (perdidas ao reiniciar) → resolvido na Fase 4 (SQLite)
- Sem autenticação nas rotas → resolvido na Fase 5
- Sem WhatsApp → resolvido na Fase 3
- Um worker por processo → suficiente para 1-10 usuários simultâneos

---

## Próxima fase

[Fase 2 — Worker Standalone](./FASE2-STANDALONE.md): adicionar `main.ts` de produção com carregamento completo de config e script npm dedicado.
