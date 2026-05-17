# Rotate Swap — Failover Inteligente entre Providers

## Ideia Central

No `jarvis.bat` (ou `start-jarvis.bat`), em vez de escolher **um** provider fixo, ter um sistema de rotação automática com fallback:

```
                    ┌─ 1º NVIDIA NIM         (fluxo principal, gratuito)
Rotate Chain ───────┼─ 2º Zen OpenCode       (fallback se NVIDIA cair)
                    ├─ 3º Groq LPU           (fallback rápido/barato)
                    └─ 4º Erro amigável      (todos exauridos)

Especialista:
  Coding → DeepSeek (hard route, sempre vai pro especialista)
```

**Mas com uma camada extra:** DeepSeek **exclusivo para código** — quando a query é classifiada como "coding", rota direto pro DeepSeek, independente do chain principal.

## Arquitetura Proposta

### Fluxo de Decisão

```
Query do usuário
       │
       ▼
┌──────────────────┐
│ Classificador    │ ← smart routing: coding / creative / analytical / simple / cheap
│ (já existe!)     │
└──────┬───────────┘
       │
       ├── "coding" ──────────────► DeepSeek (especialista em código)
       │
       └── demais categorias ────► Rotate Chain
                                        │
                                   ┌─────▼──────┐
                                   │ NVIDIA NIM  │ ← primário
                                   └─────┬──────┘
                                         │ falhou? (erro 5xx, rate limit, timeout)
                                         ▼
                                   ┌─────▼──────┐
                                   │ Zen OpenCode│ ← 1º fallback
                                   └─────┬──────┘
                                         │ falhou?
                                         ▼
                                   ┌─────▼──────┐
                                   │ Groq LPU    │ ← 2º fallback (rápido, barato)
                                   └─────┬──────┘
                                         │ falhou?
                                         ▼
                                   ┌─────▼──────┐
                                   │ Erro amigável│ ← todos exauridos
                                   └────────────┘
```

### O que já existe no JARVIS v5

| Componente | Status | Localização |
|---|---|---|
| **Smart Routing (5 categorias)** | ✅ Funcionando | `src/services/api/smartRoutingBridge.ts` |
| **Cycle Recorder** (monitora erros) | ✅ Funcionando | `src/services/api/cycleRecorder.ts` |
| **KeyPool** (rotação de chave única) | ✅ Funcionando | `src/services/api/keyPool.ts` |
| **Provider Resolver** | ✅ Funcionando | `src/services/api/providerResolver.ts` |
| **Model Discovery** | ✅ Funcionando | `src/integrations/discoveryService.ts` |

### O que precisa ser criado

| Componente | Descrição |
|---|---|
| **Rotate Chain** | Lista ordenada de providers com fallback automático |
| **Failure Detector** | Detecta 429 (rate limit), 5xx, timeout, e erros de auth |
| **Circuit Breaker** | Se um provider falhou N vezes, pula ele por X minutos |
| **Feedback Loop** | Se Zen respondeu bem numa categoria, prioriza ele na próxima similar |
| **Config DSL** | Formato de config no `.env` ou settings.json |

## Config DSL (proposta)

```env
# Rotate chain: ordem de fallback
ROTATE_CHAIN=nvidia,zen,groq

# Limites
ROTATE_CIRCUIT_BREAKER_THRESHOLD=3    # falhas consecutivas antes de pular
ROTATE_CIRCUIT_BREAKER_COOLDOWN=300   # segundos antes de tentar de novo
ROTATE_CATEGORY_ROUTES=auto            # ou manual: coding=deepseek,cheap=groq

# Keys (já existem, mas essenciais pro rotate)
NVIDIA_API_KEY=...
ZEN_API_KEY_1=...
GROQ_API_KEY=...
DEEPSEEK_API_KEY=...
```

## Fluxo Detalhado

```
1. Query chega
2. Classificiador smart routing → categoria
3. Se categoria == "coding" → DeepSeek direto (pula chain)
4. Se outra categoria → entra na Rotate Chain
5. Tenta provider #1 (NVIDIA):
   ├── Sucesso → retorna resposta
   └── Falha (erro/429/timeout) →
       ├── Registra falha no Circuit Breaker
       ├── Se circuit breaker abriu (3 falhas consecutivas) →
       │   └── Marca como "morto" por 5 min
       └── Tenta provider #2 (Zen):
           ├── Sucesso → retorna
           └── Falha → tenta #3 (Groq)...
6. Se todos falharam → erro amigável com status dos providers
```

## Onde implementar

### 1. `src/services/rotate/RotateChain.ts` (novo)
- Array ordenado de providers com timeout/circuit-breaker
- `tryNext()` → experimenta o próximo provider vivo
- `reportFailure(providerId)` → registra falha, abre circuit se necessário
- `reportSuccess(providerId)` → fecha circuit, reseta contador

### 2. `src/services/rotate/circuitBreaker.ts` (novo)
- Estado por provider: `closed` / `open` / `half-open`
- Threshold configurável via env
- Cooldown automático

### 3. Integração no `src/query.ts`
- O hook de smart routing atual (linha ~753) já faz `trySmartRoute()`
- Se smart routing retorna `null` ou falha, em vez de cair no provider default, entra na Rotate Chain
- Se a categoria é "coding", força DeepSeek como target

### 4. `jarvis.bat` (ou novo `start-jarvis.bat`)
- Lê `ROTATE_CHAIN` do `.env`
- Seta `CLAUDE_CODE_USE_OPENAI=1` + `OPENAI_BASE_URL` (como faz hoje)
- Mas em vez de fixar num provider, ativa o Rotate Chain que sobrescreve o `baseURL`/`apiKey` na hora da query

## Decisões de Design (finais)

| Questão | Decisão |
|---|---|
| Ordem do chain | **Fixa**: NVIDIA (primário) → Zen (1º fallback) → Groq (2º fallback) |
| DeepSeek exclusivo pra código? | **Hard route**: toda query classificada como "coding" vai direto pro DeepSeek, sem passar pelo chain |
| Multi-categoria (ex: coding+analytical) | **Prioriza analytical** → chain normal. Se a categoria dominante não for coding, usa o chain. |
| Cache de respostas na troca? | Histórico permanece intacto. Inconsistência entre modelos é **aceitável** — o usuário é notificado da troca. |
| Custo | Favorecer **grátis > barato > caro**: NVIDIA (grátis) → Zen (pago) → Groq (barato) |
| Detecção de falha | 429 → pula provider **só nesta query**. 5xx → abre circuit breaker. 401 → **permanente** (config problem). Timeout > 30s → pula provider. |
| Notificação ao usuário | **Sim, sempre** — quando um provider cai e outro assume, mostra notificação no terminal |
| Ordem dinâmica futura? | Reservado para v2. Por enquanto, ordem fixa. |

## Implementação

### Estrutura de arquivos

```
src/services/rotate/
├── index.ts              # Barrel exports
├── circuitBreaker.ts     # Circuit breaker 3 estados
├── RotateChain.ts        # Chain ordenado com failover
└── factory.ts            # Factory a partir de env vars
```

### Componentes criados

#### `circuitBreaker.ts`
- Estados: `closed` (normal) → `open` (falhas excedidas) → `half-open` (sonda após cooldown)
- Threshold configurável via env `ROTATE_CIRCUIT_BREAKER_THRESHOLD=3`
- Cooldown configurável via env `ROTATE_CIRCUIT_BREAKER_COOLDOWN=300` (segundos)
- `openPermanent()` para erros 401/403 (auth problem)
- Callback `onStateChange` para notificar mudanças de estado

#### `RotateChain.ts`
- Lista ordenada de `ProviderEntry` (cada um com seu `CircuitBreaker`)
- `tryNext()` → encontra o próximo provider vivo
- `findNextAlive(startAt)` → pula providers com circuito aberto
- `reportFailure(error)` → classifica o erro e age:
  - `auth` → `openPermanent()` (não adianta tentar de novo)
  - `server-error` / `transient` → incrementa contador de falhas
  - `rate-limit` / `timeout` → não conta pro threshold, pula só nesta query
- `reportSuccess()` → reseta contador de falhas
- `getStatus()` → diagnóstico de todos os providers

#### `factory.ts`
- `parseRotateConfig(env)` → lê `ROTATE_CHAIN` do env, ou **auto-detecta** provedores com chave configurada
- `buildProvidersFromConfig(config)` → monta `ProviderEntryConfig[]` com defaults por provider
- `createRotateChainFromEnv()` → one-shot: cria o chain do env
- Auto-detection: se `ROTATE_CHAIN` não está setado mas `NVIDIA_API_KEY` existe, monta chain automaticamente

### Integrações

#### `smartRoutingBridge.ts`
- `trySmartRoute()` aceita `rotateChain` opcional
- Quando `rotateChain` presente e categoria **não** é "code"/"vision":
  - Usa o provider ativo do chain como `ProviderOverride` (baseURL + apiKey + model)
  - Retorna target `rotate:nvidia,zen,groq` para logging
- Quando categoria é "code": hard route pro DeepSeek (comportamento original)

#### `query.ts`
- Instancia `RotateChain` no início do `queryLoop` via `createRotateChainFromEnv()`
- Se `ROTATE_CHAIN` não está no env e nenhum provider detectado → `null` (sem rotate)
- Passa `rotateChain` para `trySmartRoute()` a cada turno
- `reportFailure(error)` no `catch` do `callModel` — se o provider atual falha, chain avança
- `reportSuccess()` antes de `return { reason: 'completed' }` — fecha circuit breaker

#### `jarvis.bat`
- Adicionado modo `rotate`: `jarvis.bat rotate`
- Lê variáveis `ROTATE_*` do `.env` (adicionado ao `findstr`)
- Seta `ROTATE_MODE=1` e pula seleção de provider fixo

#### `start-jarvis.bat`
- Nova opção **\[R] Rotate Mode** no menu interativo
- Valida provedores configurados, avisa sobre chaves faltando
- Chama `jarvis.bat rotate` com as env vars carregadas

### Fluxo completo

```
start-jarvis.bat → opção R
  → carrega .env (ZEN_API_KEY_1, NVIDIA_API_KEY, ROTATE_CHAIN, etc.)
  → chama jarvis.bat rotate
    → node bin/jarvis --dangerously-skip-permissions
      → queryLoop()
        → createRotateChainFromEnv()  ← lê ROTATE_CHAIN do process.env
        → trySmartRoute({ rotateChain })
          ├── categoria "code" → DeepSeek (hard route)
          └── outra categoria → rotateChain.getActiveProvider()
        → callModel(providerOverride)
          ├── sucesso → rotateChain.reportSuccess()
          └── erro → rotateChain.reportFailure() + chain.tryNext()
```

### Env vars

```env
# Rotate chain: ordem de fallback (ou auto-detectado pelas chaves)
ROTATE_CHAIN=nvidia,zen,groq

# Limites do circuit breaker
ROTATE_CIRCUIT_BREAKER_THRESHOLD=3    # falhas consecutivas
ROTATE_CIRCUIT_BREAKER_COOLDOWN=300   # segundos de cooldown

# Chaves dos providers
NVIDIA_API_KEY=nvapi-...
ZEN_API_KEY_1=sk-...                  # até ZEN_API_KEY_5
GROQ_API_KEY=gsk_...
DEEPSEEK_API_KEY=sk-...               # hard route para coding

# URLs e modelos (opcionais - têm defaults)
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/llama-3.1-nemotron-70b-instruct
ZEN_BASE_URL=https://opencode.ai/zen/v1
ZEN_MODEL=big-pickle
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.3-70b-versatile
```

## Próximos passos (v2)

1. Testar com `start-jarvis.bat` → opção **R**
2. Dashboard `/rotate` command para ver estado dos circuit breakers
3. Feedback loop: se Zen respondeu bem em "creative", priorizar ele na próxima query similar
4. Ordem dinâmica baseada em latência/custo histórico
