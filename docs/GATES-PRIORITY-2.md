# Priority 2 Gates — MCP + Tool Search Improvements

**Data**: 2026-05-20
**Status**: Roadmap para implementacao

---

## Overview

Apos remover a gate do `--proactive` (Priority 1 URGENT), a proxima onda deve ser Priority 2:
remover gates que desbloqueiam melhorias no sistema de MCP e busca de tools.

**Impact estimado**: MEDIUM — melhora UX e funcionalidade avancada

---

## Gate 1: MCP Connection Management (3 gates)

**File**: `src/services/mcp/useManageMCPConnections.ts`

**Lines**: 171, 179, 472

### Line 171 — Channel handling

```typescript
// BEFORE
(false || false) &&
  channelCallbacks &&
  // ... channel notification code
```

**What it does**: Permite que MCPs enviem notificacoes "push" (inbound messages).

**Impact**: BAIXO — sem channels, MCPs ainda funcionam normalmente

**Keep or Remove**: **KEEP gateado** — channels e propriedade Anthropic

---

### Line 179 — Channel event subscriptions

```typescript
if (false || false) {
  // Subscribe to channel events
  const unsubscribe = connection.onChannelEvent?.(...)
}
```

**Impact**: BAIXO — não afeta MCP core

**Keep or Remove**: **KEEP gateado**

---

### Line 472 — Channel disconnect handling

```typescript
if (false || false) {
  // Custom channel disconnect logic
}
```

**Impact**: BAIXO

**Keep or Remove**: **KEEP gateado**

---

**Conclusion**: Todas as 3 gates de MCP sao sobre CHANNELS (propriedade). **Leave as is.**

---

## Gate 2: Brief Command (1 gate)

**File**: `src/commands/brief.ts:51`

```typescript
isEnabled: () => {
  if (false || false) {
    return getBriefConfig().enable_slash_command
  }
  return false
}
```

**What it does**: Liga/desliga o comando `/brief`.

**Impact**: BAIXO — BRIEF e enterprise-only

**Keep or Remove**: **SKIP** — deixar gateado

---

## Gate 3: Tool Search Optimization (1 gate)

**File**: `src/tools/ToolSearchTool/prompt.ts:9`

```typescript
const ENABLE_RANKING =
  false || false
```

**What it does**: Ativa ranking/scoring de relevancia em resultados de busca de tools.

**Impact**: MEDIUM — melhora UX ao procurar tools (melhor contexto primeiro)

**Current behavior**: Todos os tools tem peso igual na busca

**With gate removed**: Tools mais relevantes aparecem primeiro

**Keep or Remove**: **REMOVE** — melhora UX sem efeitos colaterais

**Implementation effort**: TRIVIAL — apenas remove a gate

---

## Gate 4: Base Tools Loading (1 gate)

**File**: `src/main.tsx:1729`

```typescript
if ((false || false) && baseTools.length > 0) {
  // Optimize base tools loading
  // ... some caching or pre-fetch logic
}
```

**What it does**: Unknown (code nao legivel no contexto)

**Impact**: DESCONHECIDO

**Keep or Remove**: **INVESTIGATE FIRST** — read full context antes de remover

---

## Gate 5: Auto-Update Packages (1 gate)

**File**: `src/components/PackageManagerAutoUpdater.tsx:30`

```typescript
false || false;
if (isAutoUpdaterDisabled()) {
  // skip auto-update
}
```

**What it does**: Permite que o CLI auto-atualize npm/bun packages.

**Impact**: BAIXO — feature nice-to-have

**Current behavior**: No auto-update

**With gate removed**: CLI pode sugerir/executar updates

**Keep or Remove**: **OPTIONAL** — low priority

---

## Recommended Order (Priority 2)

1. ✅ **Tool Search Ranking** (`ToolSearchTool/prompt.ts:9`)
   - Trivial change
   - Immediate UX improvement
   - No side effects

2. ⚠️ **Investigate** (`main.tsx:1729`)
   - Understand what base tools optimization does
   - Then decide

3. 🔵 **Auto-Update** (`PackageManagerAutoUpdater.tsx:30`)
   - Nice-to-have
   - Low priority

4. ❌ **MCP Channels** (3 gates in `useManageMCPConnections.ts`)
   - Keep gateado — propriedade

5. ❌ **BRIEF Command** (`commands/brief.ts:51`)
   - Keep gateado — enterprise

---

## Implementation Checklist (Priority 2)

- [ ] Tool Search: Change line 9 in `ToolSearchTool/prompt.ts` from `false || false` to `true`
- [ ] Verify: `npx tsc --noEmit` passes
- [ ] Test: Run `node dist/cli.mjs` and try `/tools` command — observe ranking
- [ ] Investigate main.tsx:1729 context
- [ ] Decide on auto-update feature
- [ ] Document decisions in memory

---

## Notes

- Priority 1 (Proactive flag) ja foi removida ✅
- BRIEF/CHANNELS gates devem permanecer gateadas (enterprise)
- Tool search improvement pode ser feita em 2 minutos
