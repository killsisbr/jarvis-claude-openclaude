# API Reference - JARVIS Worker v5.0.0

**Documentação completa de endpoints HTTP e autenticação**

---

## 📋 Resumo de Endpoints

| Método | Endpoint | Descrição | Auth | Status |
|--------|----------|-----------|------|--------|
| `GET` | `/health` | Status do worker | ❌ | ✅ |
| `POST` | `/api/chat` | Enviar mensagem para processamento | ✅ Bearer | ✅ |
| `GET` | `/api/cost` | Custos do dia atual | ✅ Bearer | ✅ |
| `GET` | `/api/keys` | Status de API keys | ✅ Bearer | ✅ |
| `POST` | `/api/keys` | Criar/revogar chaves | ✅ Bearer | ✅ |

---

## 🔐 Autenticação

### Bearer Token Format

```
Authorization: Bearer sk-{username}-{timestamp}-{randomhex}
```

**Exemplo:**
```
Authorization: Bearer sk-user1-1716105600-a1b2c3d4e5f6g7h8
```

### Validação
- Tokens são saltos no SQLite (`~/.jarvis/worker.db`)
- Expiração: 30 dias (renovável)
- Revogação: Imediata após `DELETE` em `/api/keys`

### Headers Obrigatórios
```
Content-Type: application/json
Authorization: Bearer sk-...
```

---

## 🟢 GET `/health`

**Status do worker (sem autenticação)**

### Request
```bash
curl http://localhost:3000/health
```

### Response (200 OK)
```json
{
  "status": "healthy",
  "uptime": 86400,
  "timestamp": 1716105600000,
  "version": "5.0.0",
  "database": "connected",
  "cache": {
    "contexts": 42,
    "hitRate": 0.23
  },
  "metrics": {
    "totalQueries": 1250,
    "avgLatency": 1340,
    "avgCost": 0.0045
  }
}
```

### Status Codes
- `200` — Worker saudável
- `503` — Banco de dados indisponível
- `500` — Erro interno

---

## 💬 POST `/api/chat`

**Enviar mensagem e obter resposta**

### Request

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer sk-user1-..." \
  -H "Content-Type: application/json" \
  -d '{
    "user": "user1",
    "message": "Como fazer um servidor em Python?",
    "model": "claude-3-5-sonnet-20241022",
    "temperature": 0.7,
    "maxTokens": 1024
  }'
```

### Request Schema

```typescript
{
  user: string                    // ID único do usuário (obrigatório)
  message: string                 // Mensagem a processar (obrigatório)
  model?: string                  // Model ID (default: claude-3-5-sonnet-20241022)
  temperature?: number            // 0-2 (default: 0.7)
  maxTokens?: number              // Limite de tokens (default: 2048)
  systemPrompt?: string           // Override do system prompt padrão
  context?: object                // Contexto adicional para Smart Cache
}
```

### Response (200 OK)

```json
{
  "status": "success",
  "user": "user1",
  "model": "claude-3-5-sonnet-20241022",
  "message": "Para criar um servidor Python, você pode usar...",
  "usage": {
    "inputTokens": 145,
    "outputTokens": 287,
    "totalTokens": 432
  },
  "cost": 0.00128,
  "latency": 1345,
  "cacheHit": false,
  "metadata": {
    "learningsInjected": 2,
    "preferencesDetected": ["language:Python", "framework:Flask"],
    "similarityScore": 0.0
  },
  "timestamp": 1716105600000
}
```

### Response Schema

```typescript
{
  status: "success" | "error"
  user: string
  model: string
  message: string                 // Resposta da IA
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  cost: number                     // Custo em USD
  latency: number                  // Latência em ms
  cacheHit: boolean               // Se usou Smart Cache
  metadata: {
    learningsInjected: number
    preferencesDetected: string[]
    similarityScore: number        // Se veio do cache
  }
  timestamp: number               // Unix timestamp
  error?: string                  // Se status === "error"
}
```

### Status Codes

- `200` — Sucesso
- `400` — Requisição inválida (falta `user` ou `message`)
- `401` — Token inválido ou expirado
- `403` — Limite de taxa excedido
- `500` — Erro ao processar

### Exemplos

**Python:**
```python
import requests

response = requests.post(
    'http://localhost:3000/api/chat',
    headers={
        'Authorization': 'Bearer sk-user1-...',
        'Content-Type': 'application/json'
    },
    json={
        'user': 'user1',
        'message': 'Explica decorators em Python',
        'temperature': 0.8
    }
)

print(response.json())
```

**JavaScript:**
```javascript
const response = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer sk-user1-...',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        user: 'user1',
        message: 'Explica async/await em JS',
        temperature: 0.7
    })
});

const data = await response.json();
console.log(data);
```

**cURL:**
```bash
# Simples
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer sk-user1-..." \
  -H "Content-Type: application/json" \
  -d '{
    "user": "user1",
    "message": "Olá, como você está?"
  }'

# Com todos os parâmetros
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer sk-user1-..." \
  -H "Content-Type: application/json" \
  -d '{
    "user": "user1",
    "message": "Implementa um algoritmo de quicksort em TypeScript",
    "model": "claude-3-5-sonnet-20241022",
    "temperature": 0.5,
    "maxTokens": 1500
  }' | jq .
```

### Comportamento Especial

**Smart Cache:**
- Se message é similar (>75%) a uma anterior, retorna contexto cacheado
- `cacheHit: true` indica uso de Smart Cache
- Latência reduzida: <1ms vs 1-3s para miss

**Proactive Learning:**
- Detecta preferências automaticamente (linguagem, framework, estilo)
- Armazena em SQLite com confidence scores
- Injetado no próximo request do usuário

**Auto-Evolve:**
- Métricas coletadas automaticamente (latency, cost, success_rate)
- A cada 6h, skill analisa e ajusta routing weights
- Canary testing de 10% do traffic antes de aplicar

---

## 💰 GET `/api/cost`

**Custos acumulados no dia**

### Request

```bash
curl http://localhost:3000/api/cost \
  -H "Authorization: Bearer sk-user1-..."
```

### Response (200 OK)

```json
{
  "status": "success",
  "user": "user1",
  "costToday": 0.1245,
  "costThisWeek": 0.8430,
  "costThisMonth": 3.2150,
  "queriesCountToday": 125,
  "queriesCountThisWeek": 847,
  "queriesCountThisMonth": 3215,
  "breakdown": {
    "claude-3-5-sonnet-20241022": {
      "cost": 0.0875,
      "queries": 89,
      "avgCost": 0.000983
    },
    "claude-opus-4-7": {
      "cost": 0.0370,
      "queries": 36,
      "avgCost": 0.001028
    }
  },
  "averageLatency": 1245,
  "cacheHitRate": 0.18,
  "timestamp": 1716105600000
}
```

### Status Codes

- `200` — Sucesso
- `401` — Token inválido
- `500` — Erro ao calcular custos

---

## 🔑 GET `/api/keys`

**Listar e gerenciar chaves de API**

### Request

```bash
curl http://localhost:3000/api/keys \
  -H "Authorization: Bearer sk-user1-..."
```

### Response (200 OK)

```json
{
  "status": "success",
  "user": "user1",
  "keys": [
    {
      "key": "sk-user1-1716105600-a1b2c3d4e5f6g7h8",
      "createdAt": 1716105600000,
      "lastUsedAt": 1716192000000,
      "expiresAt": 1718784000000,
      "status": "active",
      "queriesUsed": 1245,
      "costUsed": 0.3450
    },
    {
      "key": "sk-user1-1715500800-z9y8x7w6v5u4t3s2",
      "createdAt": 1715500800000,
      "lastUsedAt": 1716192000000,
      "expiresAt": 1718179200000,
      "status": "active",
      "queriesUsed": 987,
      "costUsed": 0.2120
    }
  ],
  "totalCost": 0.5570,
  "totalQueries": 2232
}
```

### Status Codes

- `200` — Sucesso
- `401` — Token inválido
- `500` — Erro ao listar chaves

---

## 🔐 POST `/api/keys`

**Criar ou revogar chaves de API**

### Request - Criar Chave

```bash
curl -X POST http://localhost:3000/api/keys \
  -H "Authorization: Bearer sk-user1-..." \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "expiresIn": 2592000
  }'
```

### Request Schema

```typescript
{
  action: "create" | "revoke"
  expiresIn?: number              // Segundos (default: 30 dias = 2592000)
  keyToRevoke?: string             // (requerido se action === "revoke")
}
```

### Response (201 Created) - Criar

```json
{
  "status": "success",
  "action": "create",
  "key": "sk-user1-1716105600-n3w4k3y1d1g1t5",
  "createdAt": 1716105600000,
  "expiresAt": 1718697600000,
  "message": "Chave criada com sucesso. Guarde-a em um lugar seguro."
}
```

### Request - Revogar Chave

```bash
curl -X POST http://localhost:3000/api/keys \
  -H "Authorization: Bearer sk-user1-..." \
  -H "Content-Type: application/json" \
  -d '{
    "action": "revoke",
    "keyToRevoke": "sk-user1-1715500800-z9y8x7w6v5u4t3s2"
  }'
```

### Response (200 OK) - Revogar

```json
{
  "status": "success",
  "action": "revoke",
  "revokedKey": "sk-user1-1715500800-z9y8x7w6v5u4t3s2",
  "message": "Chave revogada com sucesso. Acesso será negado imediatamente."
}
```

### Status Codes

- `201` — Chave criada
- `200` — Chave revogada
- `400` — Requisição inválida
- `401` — Token inválido
- `404` — Chave não encontrada (revoke)
- `500` — Erro ao criar/revogar

---

## 🚨 Tratamento de Erros

### Erro Padrão

Todos os erros retornam no formato:

```json
{
  "status": "error",
  "message": "Descrição do erro",
  "code": "ERROR_CODE",
  "details": {
    "field": "description"
  },
  "timestamp": 1716105600000
}
```

### Códigos de Erro Comuns

| Código | HTTP | Descrição |
|--------|------|-----------|
| `INVALID_TOKEN` | 401 | Token inválido, expirado ou malformado |
| `MISSING_USER` | 400 | Campo `user` não fornecido |
| `MISSING_MESSAGE` | 400 | Campo `message` não fornecido |
| `RATE_LIMIT_EXCEEDED` | 429 | Limite de requisições excedido |
| `DATABASE_ERROR` | 500 | Erro ao acessar banco de dados |
| `PROVIDER_ERROR` | 502 | Erro ao comunicar com LLM provider |
| `INVALID_MODEL` | 400 | Model ID inválido |

### Exemplo de Erro

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json" \
  -d '{"user":"user1","message":"Olá"}'
```

Response (401):
```json
{
  "status": "error",
  "message": "Token inválido ou expirado",
  "code": "INVALID_TOKEN",
  "details": {
    "token": "Token não encontrado no banco de dados"
  },
  "timestamp": 1716105600000
}
```

---

## 🔄 Rate Limiting

- **Limite por token**: 100 requisições / minuto
- **Limite por usuário**: 500 requisições / minuto
- **Burst permitido**: até 10 requisições simultâneas

Resposta (429):
```json
{
  "status": "error",
  "message": "Rate limit excedido",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60,
  "timestamp": 1716105600000
}
```

---

## 📊 Modelos Suportados

| Model ID | Provedor | Custo (1K input) | Custo (1K output) |
|----------|----------|------------------|-------------------|
| `claude-3-5-sonnet-20241022` | Anthropic | $0.003 | $0.015 |
| `claude-opus-4-7` | Anthropic | $0.015 | $0.075 |
| `gpt-4o` | OpenAI | $0.005 | $0.015 |
| `deepseek-chat` | DeepSeek | $0.001 | $0.002 |

---

## 🎯 Casos de Uso Comuns

### 1. Chat Simples
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "user": "user1",
    "message": "Olá, me ajuda com um problema?"
  }'
```

### 2. Requisição com Model Específico
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "user": "user1",
    "message": "Escreve um poema sobre IA",
    "model": "claude-opus-4-7",
    "temperature": 0.9,
    "maxTokens": 500
  }'
```

### 3. Verificar Saúde do Worker
```bash
curl http://localhost:3000/health | jq .
```

### 4. Monitorar Custos
```bash
curl http://localhost:3000/api/cost \
  -H "Authorization: Bearer sk-..."
```

### 5. Criar Nova Chave (Rotação)
```bash
curl -X POST http://localhost:3000/api/keys \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "expiresIn": 2592000
  }' | jq .key
```

---

## 📝 Notas

- **Timeouts**: Padrão 30 segundos para cada requisição
- **Compressão**: Respostas > 1KB são gzip-comprimidas
- **Versioning**: API está em v1 (`/api/...`)
- **CORS**: Habilitado para localhost:3000-3009
- **WebSocket**: Não suportado (HTTP/1.1 poll ou fetch)

---

## 🔗 Links Relacionados

- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) — Feature breakdown detalhado
- [ARCHITECTURE.md](ARCHITECTURE.md) — Design técnico e data flow
- [GUIA_DEPLOYMENT_VPS.md](GUIA_DEPLOYMENT_VPS.md) — Deploy em produção
- [README.md](README.md) — Visão geral do projeto

---

**Última atualização**: 2026-05-19  
**Versão da API**: v1 (JARVIS Worker 5.0.0)
