# JARVIS v5 — Plano Mestre de Arquitetura

> **Premissa**: catalogar todas as ideias do JARVIS-001 (versões 4.x/5.x), aprender com os erros de execução, e desenhar uma arquitetura **organizada, testável e sem código morto** para o v5.

**Base**: OpenClaude 0.11.0 (já zero-telemetry validado)
**Status**: Especificação — pronta para sprints de implementação
**Última atualização**: 2026-05-15

---

## SUMÁRIO

- [Parte A — Auditoria crítica do JARVIS-001](#parte-a--auditoria-crítica-do-jarvis-001)
- [Parte B — Catálogo de 14 ideias](#parte-b--catálogo-de-14-ideias)
- [Parte C — Princípios de design v5](#parte-c--princípios-de-design-v5)
- [Parte D — Roadmap em 6 sprints](#parte-d--roadmap-em-6-sprints)

---

## Parte A — Auditoria crítica do JARVIS-001

### A.1 — O que funcionou bem

| # | Item | Por que funcionou |
|---|------|-------------------|
| 1 | **Stubs do analytics** (logEvent NO-OP) | Pequeno escopo, alteração local — fácil de validar |
| 2 | **Hook Chains** | API declarativa em JSON, runtime conservador (cooldown, depth guard, dedup) |
| 3 | **Knowledge Graph** | Modelo de domínio claro (nó/aresta), persistência simples (JSON) |
| 4 | **Zen Key Rotator** | Problema bem definido (rate limit) → solução enxuta (round-robin + cooldown) |
| 5 | **Context Anchors** | Sinal explícito para o modelo (`[SYSTEM: MEMORY COMPRESSION ACTIVE]`) |
| 6 | **Multi-account Swarm** (cookies) | Resolveu rate-limit do Claude.ai antes do Zen existir |

### A.2 — O que falhou e por quê

| Falha | Sintoma | Causa raiz |
|-------|---------|-----------|
| **DS4 patterns como código morto** | 7 módulos prontos, 0 chamados em `query.ts` | Implementaram **módulos isolados** em vez de **vertical slices** |
| **Documentação enganosa** | "Zero Telemetry" no DOC, Datadog ativo no código | Sem CI guard validando claims |
| **`SleepTool: null`** no registry | Modelo nunca pôde invocar hibernação | Stub criado antes da ferramenta |
| **InactivityTimer só p/ teammate** | Modo CLI nunca hiberna | Guard `JARVIS_PROVIDER_MANAGED_BY_HOST` esquecido |
| **Cache miss alto (26%)** | Custo de input muito acima do necessário | ContextCache não integrado |
| **`if (false)` blocos** (64+) | Features prontas mas desativadas em produção | Sem feature-flag runtime → flag = literal `false` |
| **Proxy Swarm via CDP** (browser headless) | Frágil — quebra com mudanças DOM do Claude.ai | Solução de bypass, não solução de produto |
| **DNA_MASTER_OVERRIDES de telemetria** | Mascara o problema sem resolver | "Force-enable" sem entender o que cada flag faz |

### A.3 — Padrão comum de falha

> **Engenharia paralela sem integração**: o time construiu 30+ módulos brilhantes em isolamento, mas nunca completou o "último km" de wiring no pipeline real (`query.ts`, `toolOrchestration`). Resultado: documentação rica + código sofisticado + benefício real ≈ 0.

**Solução no v5**: cada feature precisa de **commit único** que inclui (1) módulo, (2) integração no pipeline, (3) teste E2E que prova o benefício, (4) métrica medida no CI.

---

## Parte B — Catálogo de 14 ideias

Cada ideia tem o mesmo template:
- **Origem**: doc no JARVIS-001
- **Problema**
- **Status no JARVIS-001**
- **Design proposto para v5**
- **Critério de aceite** (sem ele, não merge)

---

### #1 — SHA-1 Keyed Context Cache

- **Origem**: `ENGINEERING_DS4.md` §1, `DS4_HIBERNATION_SYNERGY.md` Lacuna #1
- **Problema**: reenviar histórico inteiro em cada turno → custo O(N × ctx)
- **Status no JARVIS-001**: 🔴 `ContextCache` existe, **nunca chamado em query.ts**
- **Design v5**:
  - Localização: `src/jarvis/context-cache.ts`
  - Wiring: **mesmo commit** modifica `src/query.ts` para chamar `lookup()` antes de cada request
  - Boundary trim: remove últimas 2 mensagens do hash (estabilidade BPE)
  - Eviction: `(hits+1) × tokens / fileSize`, não LRU puro
- **Critério de aceite**:
  - `query.test.ts`: dado 50-msg history idêntico em 2 turnos consecutivos, segundo turno tem `cache_read_tokens > 0`
  - Métrica exposta em `/cache-probe`
  - CI fail se cobertura desse caminho cair

---

### #2 — Prompt Checkpoint (prefix stability)

- **Origem**: `ENGINEERING_DS4.md` §7, `DS4_HIBERNATION_SYNERGY.md` Lacuna #2
- **Problema**: addendum (DNA/stats/timestamps) muda a cada turno e quebra cache de prefix
- **Status no JARVIS-001**: 🔴 módulo pronto, nunca chamado
- **Design v5**:
  - 3 estados: `identical` | `extension` | `divergence`
  - `identical` → skip request inteiro (resposta vazia OK)
  - `extension` → manda apenas delta, marca cache breakpoint
  - `divergence` → rebuild + força cache miss intencional
- **Critério de aceite**:
  - Teste: 3 turnos com adendum estável → 3º turno marca `prompt_unchanged: true`
  - Comando `/prompt-stability` mostra estado atual

---

### #3 — Tool Replay Memory

- **Origem**: `ENGINEERING_DS4.md` §5, `DS4_HIBERNATION_SYNERGY.md` Lacuna #3
- **Problema**: variação de serialização de tool output quebra prefix cache
- **Status no JARVIS-001**: 🔴 pronto, nunca chamado
- **Design v5**:
  - Wrap em `runTools()` em `services/tools/toolOrchestration.ts`
  - Hash de `(toolName, normalizedArgs)` → output byte-perfect
  - TTL configurável (default 24h)
  - **Idempotência**: só cacheia ferramentas marcadas `idempotent: true` (Read, Grep, Glob)
- **Critério de aceite**:
  - Read do mesmo arquivo 2× = mesmo output exato (compare bytes)
  - Bash **nunca** é cacheado (cobertura testada)

---

### #4 — Conversation Pruner + Semantic Distillation

- **Origem**: `FASE16_MEMORY_SINGULARITY.md`
- **Problema**: histórico cresce linear → estoura janela e custo
- **Status no JARVIS-001**: ✅ existe, ❓ não auditado se está realmente plugado
- **Design v5**:
  - Trigger: `tokenCount > settings.pruneThreshold` (default 30k)
  - Preserva últimas 5 msgs sempre
  - Distillação: 1 chamada a modelo barato (Haiku/Qwen 7B) que produz:
    - Resumo estratégico (200 tokens)
    - Lista de "fatos persistentes" (bullets)
    - Lista de "artefatos criados" (paths)
  - Salva em `.jarvis/knowledge/<sessionId>/turn-<N>.json`
  - Insere âncora: `[CONTEXT COMPRESSED — use KnowledgeSearch to retrieve specifics]`
- **Critério de aceite**:
  - Sessão de 100 msgs: prompt enviado ao modelo principal ≤ 15k tokens
  - Smoke test: pruning não quebra tool calls em andamento

---

### #5 — KnowledgeSearchTool (RAG do próprio histórico)

- **Origem**: `FASE16_MEMORY_SINGULARITY.md` §4
- **Problema**: depois de pruning, modelo precisa recuperar detalhes
- **Status no JARVIS-001**: ✅ implementado
- **Design v5**:
  - Tool name: `KnowledgeSearch`
  - Args: `{ query: string, sessionId?: string, topK?: number }`
  - Backend: embedding local (xenova/transformers já está em deps) + cosine sim
  - Retorna trechos com timestamps e contexto
- **Critério de aceite**: dado 50-msg history compactado, query "qual era o nome da função X" retorna o turno relevante em top-3

---

### #6 — Speculative Router (classificação rápida)

- **Origem**: `ENGINEERING_DS4.md` §2
- **Problema**: decidir qual agent/modelo usar é gargalo (2-3s)
- **Status no JARVIS-001**: 🔴 nunca chamado
- **Design v5**:
  - Tiny model local (qwen2.5:0.5b via Ollama)
  - Confiança ≥ 0.9 → aceita draft
  - 0.7 ≤ conf < 0.9 → cross-check com keyword matcher
  - < 0.7 → fallback p/ modelo principal
- **Critério de aceite**:
  - p50 de classificação < 80ms
  - Acurácia ≥ 85% medida em fixture de 100 prompts rotulados

---

### #7 — Smart Model Routing (cost-aware)

- **Origem**: CHANGELOG v0.6, `LLM-Orchestration-Guide.md`
- **Problema**: usar Sonnet para tudo é caro; Haiku falha em hard tasks
- **Status no JARVIS-001**: 🟡 parcial — primitivo existe, não totalmente integrado
- **Design v5**:
  - Mapping declarativo em `settings.json`:
    ```json
    "modelRouting": {
      "explore": "haiku",
      "plan": "sonnet",
      "code": "sonnet",
      "summarize": "haiku",
      "default": "sonnet"
    }
    ```
  - Auto-upgrade: se modelo barato retorna erro de complexidade → repete com strong
  - Tracking: emite `routing_decision` event para o cost-sentinel
- **Critério de aceite**:
  - 30% das requisições devem usar Haiku em uma sessão típica de exploração
  - Custo médio mensurado < 60% de baseline "tudo Sonnet"

---

### #8 — Zen Key Rotator (pool de keys gratuitas)

- **Origem**: `LLM-Orchestration-Guide.md`, `agents-and-optimizations-v2.md` OPT-1..4
- **Problema**: rate limits de free tiers
- **Status no JARVIS-001**: ✅ funcional
- **Design v5**:
  - Localização: `src/services/api/keyPool.ts` (renomeado — Zen é só 1 backend)
  - Suporta múltiplos pools simultâneos: Zen, OpenRouter, Groq free, etc.
  - Round-robin por pool, fallback entre pools
  - Per-agent tracking: `getKey(agentLabel, poolName)`
  - 429 → cooldown 60s, removido da rotação
  - Pode ler de env: `ZEN_API_KEY_1..10`, `GROQ_API_KEY_1..3`, etc.
- **Critério de aceite**:
  - Teste: 10 calls simultâneas com 5 keys → cada key recebe 2 calls
  - 429 em key 3 → key 3 fica out por 60s

---

### #9 — Cost Sentinel agent

- **Origem**: `agents-and-optimizations-v2.md`, `implementation_plan_agents_v2.md` AGENT-1
- **Problema**: usuário não vê o custo até o fim do mês
- **Status no JARVIS-001**: ✅ definido como spec, ❓ não auditado
- **Design v5**:
  - Agent definido em `.jarvis/agents/cost-sentinel.md`
  - Modelo: Haiku (overhead mínimo)
  - Trigger: a cada 50 requests OU 10 min
  - READ-ONLY (consome `keyPool.getStats()`)
  - Output em EventBus: `cost.alert` (high burn), `cost.projection` (hourly)
  - Comando `/cost` mostra dashboard
- **Critério de aceite**:
  - Após 100 requests, `/cost` mostra projeção horária
  - Alert dispara quando burn rate > 80% do limite

---

### #10 — Self-Evolve (knowledge persistence)

- **Origem**: `agents-and-optimizations-v2.md` AGENT-3, `implementation_plan_agents_v2.md`
- **Problema**: mesma classe de erro é resolvida 10× sem aprendizado persistido
- **Status no JARVIS-001**: ✅ definido
- **Design v5**:
  - Disparo: após `fix` bem-sucedido (detectado por hook `PostToolUse` em Edit/Write seguido por test pass)
  - Modelo: inherit (usa o mesmo do turno principal)
  - Output:
    ```json
    {
      "pattern": "regex-or-prose",
      "trigger": "quando acontece X",
      "solution": "aplicar Y",
      "files": ["relative/path.ts"],
      "confidence": 0.85,
      "createdAt": "2026-05-15T10:30:00Z",
      "supersedes": []
    }
    ```
  - Salva em `.jarvis/learnings/<hash>.json`
  - **Carregamento**: na boot, indexa todos os learnings → injeta top-5 relevantes ao system prompt
- **Critério de aceite**:
  - Após 3 sessões com mesmo fix, 4ª sessão tem learning no prompt
  - Confidence escalável (incrementa se padrão se confirma)

---

### #11 — Security Audit agent

- **Origem**: `implementation_plan_agents_v2.md` AGENT-4
- **Problema**: vulnerabilidades só descobertas em produção
- **Status no JARVIS-001**: ✅ definido (spec)
- **Design v5**:
  - Modelo: Sonnet
  - Trigger: comando `/security-audit` OU CI workflow
  - READ-ONLY estrito
  - Checklist: SQLi, XSS, CSRF, secrets em .env, npm audit, headers HTTP
  - Output: lista priorizada CRITICAL > HIGH > MEDIUM > LOW
  - Formato SARIF para integração com GitHub Code Scanning
- **Critério de aceite**:
  - Roda em < 60s em projeto pequeno
  - Detecta 100% das 10 vulns plantadas em fixture

---

### #12 — Hook Chains (self-healing mesh)

- **Origem**: `hook-chains.md`
- **Problema**: erros de tool causam interrupção do fluxo
- **Status no JARVIS-001**: ✅ implementado bem (gates conservadores, schema bem definido)
- **Design v5**:
  - **Manter como está** — esta foi a feature melhor desenhada
  - Defaults: `disabled` (opt-in)
  - Adicionar: web UI em `/hook-chains` para visualizar rules ativas e dispatches recentes
- **Critério de aceite**: já tem testes — manter cobertura ≥ 90%

---

### #13 — Multimodal (Voice + Vision + Audio paste)

- **Origem**: `MULTIMEDIA_VOICE.md`, `LLM-Orchestration-Guide.md` Vision Pipeline
- **Problema**: input só por texto
- **Status no JARVIS-001**: ✅ implementado (PTT + audio clipboard)
- **Design v5**:
  - Voice: 5 backends (Anthropic, OpenAI Whisper, whisper.cpp local, Azure, Google) — **default: whisper.cpp local** (privacidade)
  - Vision: `VisionTool` que aceita screenshot ou path de imagem
  - Audio paste: `Ctrl+V` em arquivo .mp3/.wav → transcrição automática
  - **Decoupled**: cada modalidade é plugin separado, opcional
- **Critério de aceite**:
  - Voice funciona offline com whisper.cpp
  - Vision: dado screenshot, agent descreve elementos UI com nomes

---

### #14 — Hibernação + Inactivity Timer + Away Summary

- **Origem**: `DS4_HIBERNATION_SYNERGY.md` Lacunas #4, #5
- **Problema**: sessões abertas indefinidamente, sem checkpoint
- **Status no JARVIS-001**: 🔴 `SleepTool: null`, timer só para teammate
- **Design v5**:
  - `SleepTool` real (não null) que invoca `hibernate({ durationMs?, reason })`
  - `hibernate()` orquestra:
    1. `contextCache.persist()`
    2. `toolReplay.persistToDisk()`
    3. `promptCheckpoint.snapshot()`
    4. Pausa loop, inicia AutoDream em background
    5. Aguarda input OU timer
  - `wake()` faz restore + away_summary
  - **InactivityTimer ativo SEMPRE** (não só teammate), default 30min
- **Critério de aceite**:
  - Sleep + Wake mantém estado idêntico (snapshot hash bate)
  - Inativo por 30min → hibernação automática + retoma sem perda

---

## Parte C — Princípios de design v5

### C.1 — Regra de ouro: **vertical slice ou nada**

Toda feature é PR único contendo:

1. **Módulo** (a classe/função nova)
2. **Integração** no pipeline real (`query.ts` / `toolOrchestration.ts` / etc.)
3. **Teste E2E** que prova o benefício end-to-end
4. **Métrica** medida e exposta (em `/status` ou comando dedicado)
5. **Doc** atualizada (1 parágrafo no README, não doc novo)

Sem qualquer um dos 5 → **PR não merge**.

### C.2 — Anti-padrão proibido: "código morto sofisticado"

PR-blocker no CI:

```yaml
- name: Block dead code
  run: |
    # Toda classe exportada em src/jarvis/*.ts deve ser referenciada em src/query.ts ou src/services/
    bun run scripts/check-no-dead-modules.ts
```

Se um módulo novo não tem chamador no pipeline → fail.

### C.3 — Documentação = código

Sempre que um doc afirma um benefício mensurável, o teste E2E deve **provar essa métrica**. Exemplos:

- "40-60% economia de tokens" → teste compara tokens antes/depois em fixture estável
- "p50 < 80ms" → benchmark commitado, CI verifica
- "Zero telemetry" → workflow já criado (`verify-zero-telemetry.yml`)

### C.4 — Feature flags reais, não literais

Erro do JARVIS-001: `if (false)` espalhado pelo código.

Regra v5:

```typescript
// ❌ NUNCA
if (false) { ... }

// ✅ SEMPRE
if (settings.experimental?.contextCollapse ?? true) { ... }
```

Cada flag tem default explícito no `settings/defaults.ts` e tipo em `settings/types.ts`.

### C.5 — Settings sobre env vars

JARVIS-001 tem 60+ env vars (`JARVIS_FORCE_HIBERNATE`, `JARVIS_PROVIDER_MANAGED_BY_HOST`, etc.).

v5: usar `~/.jarvis/settings.json` versionado, env vars **só para secrets** (API keys).

### C.6 — Telemetria está banida (já é)

CI guard já bloqueia regressão. Adicionar: doc principal afirma "zero telemetry" com link pro workflow.

### C.7 — Privacidade first

Defaults para opções com trade-off privacidade:
- Voice STT: `whisper.cpp local` (não Anthropic cloud)
- Vision: local quando possível
- Embeddings: xenova/transformers local (não OpenAI)

---

## Parte D — Roadmap em 6 sprints

Cada sprint = ~1 semana de foco. Ordem por **valor/dependência**.

### Sprint 1 — Quick wins de economia (1 semana)

> **Meta**: economia de 40-60% em tokens com mudanças mínimas e bem testadas.

| # | Tarefa | Esforço | Origem |
|---|--------|---------|--------|
| 1.1 | Smart Model Routing (settings + auto-upgrade) | 6h | Ideia #7 |
| 1.2 | Cost Sentinel agent (Haiku, dashboard `/cost`) | 4h | Ideia #9 |
| 1.3 | Key Pool (ZenKey renomeado, multi-pool) | 6h | Ideia #8 |
| 1.4 | Ativar `CONTEXT_COLLAPSE` flag (já existe em OC) | 30min | OC existing |

**Critério de aceite do sprint**: 1 sessão de demo mostra `/cost` com economia ≥ 40% vs baseline.

### Sprint 2 — DS4 wiring (1 semana)

> **Meta**: integrar os 3 padrões DS4 valiosos no pipeline real (sem deixar código morto).

| # | Tarefa | Esforço | Origem |
|---|--------|---------|--------|
| 2.1 | ContextCache + integração em `query.ts` + teste E2E | 1d | Ideia #1 |
| 2.2 | PromptCheckpoint + integração + teste | 1d | Ideia #2 |
| 2.3 | ToolReplayMemory + integração em `toolOrchestration` | 1d | Ideia #3 |
| 2.4 | Comando `/cache-probe` mostra hit rate | 2h | — |
| 2.5 | CI guard `check-no-dead-modules.ts` | 3h | Princípio C.2 |

**Critério de aceite**: dado fixture de 50 turnos, cache_read_tokens > 70% do total de input.

### Sprint 3 — Memory Singularity (1-2 semanas)

> **Meta**: sessões longas sem estouro de janela, com recuperação semântica.

| # | Tarefa | Esforço | Origem |
|---|--------|---------|--------|
| 3.1 | ConversationPruner (trigger 30k) | 1d | Ideia #4 |
| 3.2 | Semantic Distillation (Haiku call) | 1d | Ideia #4 |
| 3.3 | KnowledgeSearchTool (embedding local) | 2d | Ideia #5 |
| 3.4 | Persistência em `.jarvis/knowledge/` | 4h | — |
| 3.5 | Comando `/memory-stats` | 2h | — |

**Critério de aceite**: sessão de 100 msgs com prompt ≤ 15k tokens; query semântica recupera turno relevante.

### Sprint 4 — Speculative + Worker Pool (1 semana)

> **Meta**: paralelismo seguro, classificação rápida.

| # | Tarefa | Esforço | Origem |
|---|--------|---------|--------|
| 4.1 | Speculative Router (qwen 0.5b via Ollama) | 1d | Ideia #6 |
| 4.2 | Worker Pool com backpressure + priority | 1d | DS4 §6 |
| 4.3 | Fixture de 100 prompts rotulados para benchmark | 4h | — |
| 4.4 | Integração no router de agents | 1d | — |

**Critério de aceite**: classificação p50 < 80ms, acurácia ≥ 85%.

### Sprint 5 — Agentes + Hibernação (1-2 semanas)

> **Meta**: agentes especializados ativos + ciclo de hibernação completo.

| # | Tarefa | Esforço | Origem |
|---|--------|---------|--------|
| 5.1 | Self-Evolve agent (hook PostToolUse + learnings dir) | 2d | Ideia #10 |
| 5.2 | Security Audit agent (checklist SARIF) | 2d | Ideia #11 |
| 5.3 | SleepTool real + ciclo hibernate/wake | 2d | Ideia #14 |
| 5.4 | InactivityTimer sempre ativo + AwaySummary | 1d | Ideia #14 |

**Critério de aceite**: hibernação 30min → wake mantém estado; 3 sessões com fix idêntico → 4ª usa learning.

### Sprint 6 — Multimodal + polish (1 semana)

> **Meta**: voz e visão, depois shipping.

| # | Tarefa | Esforço | Origem |
|---|--------|---------|--------|
| 6.1 | Voice STT (whisper.cpp local default) | 2d | Ideia #13 |
| 6.2 | Vision pipeline (screenshot + VisionTool) | 1d | Ideia #13 |
| 6.3 | Audio paste (Ctrl+V mp3/wav) | 1d | Ideia #13 |
| 6.4 | Documentação final + tutorial | 1d | — |
| 6.5 | Release v5.0.0-rc1 | 0.5d | — |

**Critério de aceite**: demo end-to-end mostra voz → comando → tool → resposta com voz local funcional offline.

---

## Apêndice — Ideias **conscientemente descartadas**

Algumas ideias do JARVIS-001 **não vão para o v5** com justificativa:

| Ideia descartada | Por que |
|------------------|---------|
| **Proxy Swarm via CDP** (Chrome headless do Claude.ai) | Frágil, depende de bypass de anti-bot. Substituído por: Zen Key Pool + multi-provider via API oficial |
| **Multi-account cookies** | Mesmo motivo. Use API keys de provedores múltiplos |
| **DNA_MASTER_OVERRIDES** (force-enable de feature flags) | Substituído por: settings.json com defaults explícitos e tipados |
| **Auto-Save Parser** (`// === FILE:` marker) | Substituído por: tool `Write` nativa (já existe no OC), modelo emite tool_use estruturado |
| **`start-jarvis.bat` com seletor de modo** | Substituído por: `jarvis --profile <nome>` e profiles em settings |
| **Mimo Proxy fallback** | Mimo não tem rate limit problemático; usar como provider normal se necessário |
| **WhatsApp Bridge headless** | Adiar — não é core, projeto separado |

---

## Apêndice — Checklist para implementador

Antes de abrir PR para qualquer feature do catálogo:

- [ ] Módulo novo tem teste unitário (≥ 80% cobertura local)
- [ ] Integração no pipeline real está incluída no MESMO PR
- [ ] Teste E2E prova o benefício declarado
- [ ] Métrica está exposta em `/status` ou comando dedicado
- [ ] README ou doc da feature atualizado (1 parágrafo)
- [ ] CI roda `verify-zero-telemetry.yml` e passa
- [ ] CI roda `check-no-dead-modules.ts` e passa
- [ ] Nenhuma env var nova adicionada (use settings)
- [ ] Defaults preservam privacidade (local > cloud quando possível)

---

**Mantenedor**: JARVIS v5 Core
**Próxima revisão**: ao fim de cada sprint
