# Integração Remote Worker no CLI Principal

## Overview

A integração permite que o CLI principal use um Remote JARVIS Worker opcionalmente, caindo para processamento local se não configurado.

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│ main.tsx / entrypoint                                    │
│  ↓                                                       │
│ loadRemoteWorkerConfig() / shouldUseRemoteWorker()      │
│  ↓                                                       │
│ executeQuery(request, remoteConfig, localExecutor)      │
│  ├─→ Remote? → callRemoteWorker()                       │
│  └─→ Local?  → localExecutor()                          │
│  ↓                                                       │
│ formatQueryResponse() → Output ao usuário                │
└─────────────────────────────────────────────────────────┘
```

## Arquivos Criados

### 1. `src/config/remoteWorkerConfig.ts`
Gerencia configuração de remote worker:
- Lê de `~/.jarvis/remote-worker-config.json`
- Lê de env vars: `JARVIS_REMOTE_URL`, `JARVIS_REMOTE_KEY`
- Função `shouldUseRemoteWorker()` com override `--use-local`

### 2. `src/services/queryEngineWrapper.ts`
Wrapper que roteia queries:
- `executeQuery()` - alterna entre remote/local
- `testRemoteWorkerConnection()` - verifica saúde
- `formatQueryResponse()` - formata output unificado

### 3. `src/services/remote-worker.ts` (já existe)
Cliente HTTP para remote worker

## Padrão de Integração

### Em main.tsx / QueryEngine

```typescript
// 1. No início de main() / cli initialization
import { loadRemoteWorkerConfig, shouldUseRemoteWorker } from '../config/remoteWorkerConfig'
import { executeQuery, testRemoteWorkerConnection } from '../services/queryEngineWrapper'

const remoteConfig = shouldUseRemoteWorker(process.argv) 
  ? loadRemoteWorkerConfig() 
  : null

// 2. Testar conexão (opcional - para feedback ao usuário)
if (remoteConfig) {
  const health = await testRemoteWorkerConnection(remoteConfig)
  if (!health.healthy) {
    console.warn(`⚠️  Remote worker unhealthy: ${health.error}`)
  }
}

// 3. Ao processar query
const response = await executeQuery(
  {
    userId: session.userId,
    message: userMessage,
    conversationHistory: messages,
    model: selectedModel
  },
  remoteConfig,
  async (req) => {
    // Fallback: processamento local (QueryEngine atual)
    return await localQueryEngine.process(req)
  }
)

// 4. Exibir resposta
console.log(formatQueryResponse(response))
```

## Configuração do Usuário

### Via Arquivo (Persistente)

```bash
bun remote-cli.ts --config
# Cria ~/.jarvis/remote-worker-config.json
```

### Via Env Vars (Temporário)

```bash
export JARVIS_REMOTE_URL=http://vps.example.com:3000
export JARVIS_REMOTE_KEY=sk-username-timestamp-hex
jarvis
```

### Via CLI Flag (Override)

```bash
# Forçar local mesmo com remote configurado
jarvis --use-local "sua pergunta"

# Em main.tsx: shouldUseRemoteWorker(args) detecta --use-local
```

## Exemplos de Uso

### Configuração Inicial

```bash
$ jarvis

# Detecta remote config em ~/.jarvis/remote-worker-config.json
# 📡 Usando Remote Worker (http://vps.example.com:3000)
# Conectado via API key: sk-lucas-...
```

### Fallback para Local

```bash
$ jarvis --use-local

# Ignora remote config
# 🖥️  Usando Processamento Local
```

### Teste de Conexão

```bash
# Em queryEngineWrapper.ts
const health = await testRemoteWorkerConnection(remoteConfig)

if (!health.healthy) {
  console.warn(`⚠️  Remote worker unavailable (${health.error})`)
  console.log(`   Falling back to local processing`)
  // executa localExecutor automaticamente
}
```

## Response Format Unificado

Independente de remote ou local:

```json
{
  "reply": "Resposta do AI...",
  "model": "claude-opus",
  "tokens": {
    "input": 150,
    "output": 320
  },
  "cost": 0.005632,
  "latency_ms": 1250,
  "source": "remote"  // ou "local"
}
```

## Integração com Startup Screen

Em `src/components/StartupScreen.tsx`:

```typescript
import { loadRemoteWorkerConfig } from '../config/remoteWorkerConfig'

function printStartupScreen(model: string) {
  const remoteConfig = loadRemoteWorkerConfig()
  
  if (remoteConfig.enabled) {
    console.log(`📡 Remote Worker: ${remoteConfig.url}`)
    console.log(`   API Key: ${remoteConfig.apiKey ? '••••••••••' : '(none)'}`)
  } else {
    console.log(`🖥️  Local Processing`)
  }
  
  console.log(`🧠 Model: ${model}`)
  // ... rest of startup screen
}
```

## Monitoramento / Observabilidade

### Log de Source

```typescript
// src/services/api/logUsage.ts
const logEvent = {
  query_source: response.source, // 'remote' ou 'local'
  remote_latency: response.latency_ms,
  remote_model: response.model,
  cost: response.cost
}
```

### Métricas

```typescript
// Sugestão: adicionar ao telemetry
const metrics = {
  remote_worker_enabled: !!remoteConfig,
  remote_worker_healthy: (await testRemoteWorkerConnection(remoteConfig)).healthy,
  fallback_to_local: response.source === 'local' && remoteConfig !== null
}
```

## Tratamento de Erros

```typescript
// Em executeQuery
try {
  return await callRemoteWorker(remoteConfig, userId, message)
} catch (error) {
  // 1. Tentar fallback local se disponível
  if (localExecutor) {
    console.warn('⚠️  Remote worker failed, using local')
    return await localExecutor(request)
  }
  
  // 2. Se não há fallback, propagar erro
  throw new Error(`Remote worker unavailable: ${error.message}`)
}
```

## Próximas Etapas

1. **Integração em main.tsx**
   - Importar funções de remote config
   - Chamar shouldUseRemoteWorker() cedo no flow
   - Adicionar remote config ao startup screen

2. **Integração em QueryEngine**
   - Envolver processamento com executeQuery()
   - Adicionar healthcheck opcional

3. **Integração em Telemetry**
   - Log de query_source (remote/local)
   - Métricas de latência remota
   - Contagem de fallbacks

4. **Documentação**
   - Adicionar seção de remote worker ao README
   - Exemplos de uso
   - Troubleshooting

## Testes

```typescript
// src/services/queryEngineWrapper.test.ts
test('routes to remote when configured', async () => {
  const response = await executeQuery(
    { userId: 'user1', message: 'test' },
    { url: 'http://localhost:3000', apiKey: 'sk-...' },
    localExecutor
  )
  expect(response.source).toBe('remote')
})

test('falls back to local on remote error', async () => {
  const response = await executeQuery(
    { userId: 'user1', message: 'test' },
    { url: 'http://invalid.local', apiKey: 'sk-...' },
    localExecutor
  )
  expect(response.source).toBe('local')
})
```
