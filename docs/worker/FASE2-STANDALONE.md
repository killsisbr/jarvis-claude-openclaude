# Fase 2 — Worker Standalone

> Processo independente com carregamento completo de configuração, smart routing e key pools.

**Status**: Implementado  
**Data**: 2026-05-16

---

## Objetivo

Mover o worker da prototipagem (Fase 1: env vars mínimas) para produção (Fase 2: config completa).

**O que muda:**
- `config.ts` — carrega `settings.json` + env vars + defaults inteligentes
- `main.ts` — entrypoint de produção com inicialização de pools e routing
- `bun run worker` usa `main.ts` (não `index.ts`)
- Healthcheck expõe pool stats em tempo real

---

## Configuração (settings.json)

Localização: `~/.jarvis/settings.json` ou `.openclaude-profile.json` (legacy)

**Exemplo mínimo:**

```json
{
  "smartRouting": {
    "enabled": true,
    "targets": {
      "simple": "deepseek-chat",
      "reasoning": "claude-sonnet-4-5",
      "code": "claude-sonnet-4-5",
      "vision": "claude-sonnet-4-5"
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
      "model": "claude-sonnet-4-5",
      "rotation": "round-robin",
      "cooldown_ms": 60000
    }
  }
}
```

**Campos principais:**

| Campo | Tipo | Descrição |
|---|---|---|
| `smartRouting.enabled` | bool | Ativar roteamento inteligente |
| `smartRouting.targets` | obj | Modelo por categoria (simple/reasoning/code/vision) |
| `agentModels` | obj | Definição de providers com keys e base URLs |

---

## Carregamento de API Keys (env vars)

O pattern `api_keys_env` suporta wildcards:

```env
# Expand para múltiplas chaves
ZEN_API_KEY_1=zen-abc...
ZEN_API_KEY_2=zen-def...
ZEN_API_KEY_3=zen-ghi...

DEEPSEEK_API_KEY_1=sk-...
DEEPSEEK_API_KEY_2=sk-...
```

O `config.ts` detecta e agrupa automaticamente:
- `ZEN_API_KEY_*` → array `['zen-abc...', 'zen-def...', 'zen-ghi...']`
- `DEEPSEEK_API_KEY_*` → array `['sk-...', 'sk-...']`

---

## Inicialização de KeyPools

Na startup do `main.ts`:

1. Carrega `settings.json`
2. Para cada entrada em `agentModels`:
   - Expande `api_keys_env` via env vars
   - Cria `KeyPool` com rotação e cooldown
   - Registra em cache compartilhado (usado pelo smartRouting)

**Resultado**: SmartRouting tem pools de chave prontos para usar.

---

## Pool Health

O `/health` agora retorna:

```json
{
  "status": "running",
  "pools": [
    {
      "name": "zen",
      "total_keys": 3,
      "active_keys": 3,
      "cooldown_keys": 0,
      "errors_429_last_hour": 0
    },
    {
      "name": "deepseek",
      "total_keys": 2,
      "active_keys": 2,
      "cooldown_keys": 0,
      "errors_429_last_hour": 0
    }
  ]
}
```

Chamada do `/api/chat` retorna:

```json
{
  "reply": "...",
  "category": "code",
  "target": "zen-pool:claude-sonnet-4-5",
  "pool_used": "zen",
  "key_rotation": "zen-key-2/3"
}
```

---

## Scripts npm

```bash
# Produção
bun run worker

# Desenvolvimento (watch mode)
bun run worker:dev
```

---

## Fallback

Se `settings.json` não existir, usa fallback com env vars:

```env
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=deepseek-chat
```

Isso torna o worker funcional mesmo sem `settings.json`.

---

## Próxima fase

[Fase 3 — WhatsApp Gateway](./FASE3-WHATSAPP.md): conectar worker ao WhatsApp via Evolution API.
