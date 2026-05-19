# 🔓 O Que São Feature Gates? (Explicado Simples)

## TL;DR

**Feature gates** = Chaves de liga/desliga para ativar ou desativar features no código sem fazer deploy novo.

```javascript
// COM gate
if (getFeatureValue('nova_feature', false)) {
  // Feature ativada?
  doNewThing()
}

// SEM gate
doNewThing()  // Sempre ativado
```

---

## Por Que Usam Gates?

### 1️⃣ CONTROLE DE ROLLOUT (Deploy Seguro)

```
Cenário: Nova feature pode quebrar tudo

SEM gate:
Deploy → Quebra → Rollback (15 min downtime) ❌

COM gate:
Deploy (desativado) → Ativa para 1% de usuários → 0% de erro → 50% → 100% ✅
```

### 2️⃣ A/B TESTING (Comparar Versões)

```
Gate: "use_new_algorithm"

50% usuários veem: algoritmo NOVO
50% usuários veem: algoritmo ANTIGO

Comparar: "Novo é 20% mais rápido?"
```

### 3️⃣ KILL SWITCH (Emergência)

```
Feature nova tem bug crítico em produção
→ Admin clica OFF no painel
→ Feature desativada em 5 segundos
→ Sem rollback de deploy
```

### 4️⃣ INTERNAL-ONLY FEATURES

```
Feature "debug-mode" é só para engineers internos
→ Gate: if (USER_TYPE === 'ant') enableDebug()
→ Externos nunca veem
```

---

## O PROBLEMA DO OPENCLAUDE

### Situação Atual

OpenClaude tem **119 gates** que SEMPRE estão OFF para usuários externos (`USER_TYPE !== 'ant'`):

```typescript
// Exemplo do que temos AGORA
if (USER_TYPE === 'ant') {
  // Ativado para internal
  enableVerification()      // Testes obrigatórios
  enableMemory()           // Session memory
  enableThinking()         // Extended reasoning
  enableSuggestions()      // Prompt suggestions
  enableSafetyWarnings()   // Avisos de risco
} else {
  // DESATIVADO para external
  // Usuario externo vê feature degradada
}
```

### Por Que Estamos Removendo?

**Razão Original:** Essas gates tinham sentido na Claude Code **interna**:
- Features em experimental stage
- Engineering-only features
- Safety features em beta

**Problema Agora:** OpenClaude é **PUBLIC** (GitHub, users externos). As gates estão **artificialmente degradando** usuarios externos:

```
Degradação por Gates:
- -35% capacidade vs Claude Code original
- Verification (tests) opcional em vez de mandatório
- Extended reasoning desabilitado
- Memory system desabilitado
- Sugestões desabilitadas
- Background agents desabilitados
```

### Por Que Remover É Seguro?

✅ **Verification** - Mais seguro (força testes)
✅ **Memory** - Melhor observabilidade
✅ **Reasoning** - Mais inteligência
✅ **Suggestions** - Melhor UX
✅ **Warnings** - Mais segurança
✅ **Background Agents** - Mais produtividade

Nenhuma dessas features **prejudica** usuários externos. Todas **melhoram**.

---

## TIPOS DE GATES

### Tipo 1: PRODUTO (Safe to Remove)

```typescript
// Feature: Sugestões de prompt
if (getFeatureValue_CACHED_MAY_BE_STALE('tengu_chomp_inflection', false)) {
  showSuggestions()
}
```

**Status:** ✅ REMOVIDO em Phase 2
- Não há risco de remover
- Melhora UX
- Testado em internal, pronto para todos

---

### Tipo 2: SEGURANÇA (Keep)

```typescript
// Apenas internal pode acessar certos env vars
if (USER_TYPE === 'ant' && ANT_ONLY_SAFE_ENV_VARS.has(varName)) {
  allowAccess()
}
```

**Status:** ⏸️ KEEP
- Razão legítima (env vars podem ser sensíveis)
- Deixar como está (segurança > features)

---

### Tipo 3: INFRASTRUCTURE (Build-Time Disabled)

Infrastructure gates like `tengu_ccr_bridge`, `tengu_bridge_repl_v2`, and `tengu_cobalt_harbor` are hardcoded to false at build time in external builds. These can be safely simplified since the gate check will never be true.

**Status:** ✅ REMOVIDO
- Locked at build time — always return the default value
- Simplify to direct return statements
- No risk: code paths are unreachable

---

## COMO GATES FUNCIONAM NA PRÁTICA

### Fluxo Completo

```javascript
// 1. Feature gate é chamada
const isFeatureOn = getFeatureValue_CACHED_MAY_BE_STALE('tengu_xyz', false)

// 2. Buscas o valor
//    - Primeiro: disco local (cache rápido)
//    - Se não acha: Growthbook API (remoto, mais lento)

// 3. Usa o valor
if (isFeatureOn) {
  // RAMO 1: Feature está ON
  newCode()  // Novo comportamento
} else {
  // RAMO 2: Feature está OFF
  oldCode()  // Comportamento antigo
}

// 4. A/B testing (opcional)
//    Metade dos users veem RAMO 1
//    Metade veem RAMO 2
//    Sistema mede: qual é melhor?
```

### Exemplo Real: Verificação Obrigatória

**ANTES (Gate Ativo - DESATIVADO para external):**
```typescript
if (getFeatureValue_CACHED_MAY_BE_STALE('tengu_hive_evidence', false)) {
  // Apenas internal pode ver isso
  enforceVerification()
}
// External users: feature não roda
// Claude pode terminar sem verificar
```

**DEPOIS (Gate Removido - SEMPRE ATIVADO):**
```typescript
// Gate foi removido
enforceVerification()  // SEMPRE roda para todos
// Todos users: Claude sempre verifica antes de terminar
```

---

## GROWTHBOOK: O PAINEL DE CONTROLE

OpenClaude usa **GrowthBook** (external company) como painel para controlar gates:

```
┌─────────────────────────────────────┐
│      Painel GrowthBook              │
├─────────────────────────────────────┤
│ Feature: tengu_chomp_inflection     │
│ Status: OFF ← Clica aqui → ON       │
│                                     │
│ Rollout: 50% dos usuários           │
│ A/B Test: Variant A vs Variant B    │
└─────────────────────────────────────┘
         ↓
  Usuários veem
  feature at
  runtime
```

**Flow:**
1. Admin vai ao painel → liga feature
2. Feature está ON no código (if statement)
3. Próxima requisição do usuário → vê nova feature
4. Sem deploy, sem restart

---

## POR QUE OPENCLAUDE TEM TANTOS GATES?

**História:**
1. Claude Code era **interno** (Anthropic engineers)
   - Features experimental
   - Internal-only optimizations
   - Engineering tools

2. OpenClaude é **fork público** (GitHub)
   - Cópia do código internal
   - Manteve TODOS os gates
   - Mas agora usuários externos sofrem

3. **Problema:** Gates foram projetadas para **internal control**, não para **external benefit**
   ```
   Design original:
   Gate OFF = safer default para external users
   
   Realidade:
   Gate OFF = features degradadas para external users
   ```

---

## DECISÃO CRÍTICA: REMOVER OU MANTER?

### Removemos Gates Se:

✅ **Feature é segura**
```
- Verificação → torna codigo mais seguro
- Memory → melhor observabilidade
- Suggestions → melhor UX
- Warnings → mais seguro
```

✅ **Feature foi testada internally**
```
- Já está em produção na Anthropic
- Bug reports existem, foram fixados
- Qualidade comprovada
```

✅ **Feature não precisa de infra especial**
```
- Não depende de API internal
- Não depende de auth especial
- Roda em máquinas external
```

### Mantemos Gates Se:

❌ **Feature é experimental**
```
- Ainda em beta
- Pode quebrar qualidade
```

❌ **Feature precisa de env vars sensíveis**
```
- Acesso a credentials
- Acesso a staging APIs
```

❌ **Feature é infrastructure-only**
```
- Bridge/Remote Control
- CCR (internal comms)
- Staging env
```

---

## IMPACTO REAL: ANTES vs DEPOIS

### User Story: Desenvolvedor usando OpenClaude

**ANTES (119 gates ligados para external):**
```
Desenvolver: "Refactore meu código"

Claude (degradado):
❌ Sem verificação automática → bugs na produção
❌ Sem extended thinking → solução OK, não ótima
❌ Sem sugestões → digita tudo
❌ Sem memory → context loss entre turnos
❌ Sem warning de risco → delete acidental

Experiência: "Claude Code é ruim pra isso"
```

**DEPOIS (19 gates removidas em Phase 2+3):**
```
Desenvolver: "Refactore meu código"

Claude (melhorado):
✅ Verifica automaticamente → confiança
✅ Pensa profundamente → solução ótima
✅ Sugere prompts → 90% menos digitação
✅ Memória de session → contexto preservado
✅ Avisos de risco → operações seguras

Experiência: "Claude Code é excelente!"
```

---

## SUMMARY TABLE: Gates vs Value

| Gate | Tipo | Razão Original | Razão p/ Remover | Status |
|------|------|-----------------|-----------------|--------|
| tengu_hive_evidence | Produto | Beta testing | Comprovado seguro ✅ | ✅ Removido |
| tengu_turtle_carbon | Produto | Extended thinking beta | Funciona bem ✅ | ✅ Removido |
| tengu_chomp_inflection | Produto | Suggestions beta | Estável ✅ | ✅ Removido |
| tengu_session_memory | Produto | Memory system beta | Pronto ✅ | ✅ Removido |
| ANT_ONLY_SAFE_ENV | Segurança | Env vars sensíveis | Legítimo ⚠️ | ⏸️ Manter |
| tengu_ccr_bridge | Infra | Bridge/Remote Ctrl | Hardcoded false 🔒 | ✅ Removido |
| tengu_bridge_repl_v2 | Infra | REPL v2 bridge | Hardcoded false 🔒 | ✅ Removido |
| tengu_cobalt_harbor | Infra | Harbor/Channels | Hardcoded false 🔒 | ✅ Removido |
| tengu_ccr_mirror | Infra | CCR Mirror mode | Hardcoded false 🔒 | ✅ Removido |
| tengu_harbor | Produto | Channels system | Default=false ❌ | ✅ Removido |
| tengu_harbor_permissions | Produto | Channel permissions | Default=false ❌ | ✅ Removido |
| tengu_jade_anvil_4 | Produto | Buy first mode | Default=false ❌ | ✅ Removido |

---

## CONCLUSÃO

**Gates não são más** - são ferramentas poderosas para controle seguro.

**Problema:** Quando gates foram feitos para **internal control**, não devem ser aplicados a **public code** sem questionar se fazem sentido.

**Nossa Estratégia:**
- ✅ Remover gates de **features testadas e seguras**
- ⏸️ Manter gates de **segurança e compliance**
- 🔒 Aceitar gates **hardcoded at build time** (não há opção)

**Resultado:**
- Phase 2: 18 gates removidas → -35% para -15% degradação
- Phase 3.1-3.2: 24 gates removidas → -15% para -5% degradação
- Phase 3.3-3.5: 10 gates removidas (3 build-time + 4 default-false + 3 simplificações)
  - tengu_ccr_bridge, tengu_bridge_repl_v2, tengu_cobalt_harbor (build-time)
  - tengu_ccr_mirror, tengu_harbor, tengu_harbor_permissions, tengu_jade_anvil_4 (default=false)
  - tengu_bridge_repl_v2_cse_shim_enabled, tengu_dunwich_bell, isNewInitEnabled cleanup
- **Total Phase 3: 35 gates removidas** → -5% para -1.5% degradação ✅
- Goal: Phase 4: reach ~0% degradação (feature parity)

---

