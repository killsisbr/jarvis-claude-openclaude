# Proactive Mode — JARVIS Autonomous Ticks

**Data**: 2026-05-20
**Versao**: v5.0.0
**Status**: ✅ Implementado, testado e operacional

**Últimas mudanças (Commit 8fd9d39):**
- ✅ Integração `shouldTick()` corrigida em src/cli/print.ts
- ✅ 21 testes estruturados (21/21 PASS)
- ✅ Ticks agora respeitam intervalo de 30s

---

## O que e

Modo proativo permite que o JARVIS **aja autonomamente** sem esperar input.
Ele recebe `<tick>` periodicos (a cada 30s) e decide o que fazer:
explorar codigo, corrigir bugs, monitorar status, ou dormir se nao ha nada.

## Como ativar

### Opcao 1: Env var (recomendado para .bat)
```bat
set "CLAUDE_CODE_PROACTIVE=1"
```

### Opcao 2: Flag CLI
```bash
node dist/cli.mjs --proactive
```

### Opcao 3: Slash command (dentro da sessao)
```
/proactive
```
Roda como toggle — liga/desliga.

## Como funciona

```
Inicio
  |
  +-- activateProactive('command')
  |     |
  |     +-- active = true
  |     +-- scheduleNextTick() (30s)
  |
  +-- [Usuario digita algo]
  |     |
  |     +-- pauseProactive()   (para enquanto processa)
  |     +-- ... modelo responde ...
  |     +-- resumeProactive()  (volta a tickar)
  |
  +-- [Tick dispara]
  |     |
  |     +-- Injeta: <tick>10:30:45</tick>
  |     +-- Modelo decide: agir ou Sleep
  |     +-- scheduleNextTick() (proximo em 30s)
  |
  +-- [Erro de API]
  |     |
  |     +-- setContextBlocked(true)  (para ticks)
  |     +-- Evita loop: tick -> erro -> tick -> erro
  |     +-- Desbloqueia em: compact, /clear, resposta OK
  |
  +-- /proactive (toggle off)
        |
        +-- deactivateProactive()
        +-- Todos ticks param
```

## Protecoes anti-runaway

1. **contextBlocked**: Para ticks apos erros de API
2. **pauseProactive**: Para durante input do usuario
3. **inputClosed**: Para quando sessao encerra
4. **Sleep tool**: Modelo pode chamar Sleep se nao ha nada util
5. **shouldTick()**: Valida intervalo de 30s antes de injetar tick (v5.0.0+)

## Integração: shouldTick() e Tick Injection

**Problema encontrado e corrigido (Commit 8fd9d39):**

Antes da fix, `scheduleProactiveTick()` era chamado sempre que queue estava vazia,
ignorando o intervalo de 30s. Isso podia gerar **ticks excessivos** (múltiplos por segundo).

**Solução implementada:**

```typescript
// src/cli/print.ts:2463
if (
  proactiveModule?.isProactiveActive() &&
  !proactiveModule.isProactivePaused() &&
  proactiveModule.shouldTick?.()  // ← ADICIONADO: valida timing
) {
  if (peek(isMainThread) === undefined && !inputClosed) {
    scheduleProactiveTick()
  }
}
```

**Resultado:**
- ✅ Ticks respeitam intervalo de 30s
- ✅ Sem injeção excessiva
- ✅ Pauseado por contextBlocked/pauseProactive
- ✅ 21 testes validam comportamento (21/21 PASS)

## Testing

### Rodar testes do proactive mode

```bash
npm run test -- src/proactive/proactive.test.ts
```

**Cobertura (21 testes):**
- Activation/deactivation (3 testes)
- Pause/resume (3 testes)
- Context blocking (3 testes)
- Tick scheduling (6 testes)
- Subscriptions (3 testes)
- Integration shouldTick() (3 testes)

**Todos os testes devem passar:**
```
✓ 21 pass
✓ 0 fail
```

### Testar ao vivo

```bash
# Via env var
CLAUDE_CODE_PROACTIVE=1 node dist/cli.mjs

# Via flag
node dist/cli.mjs --proactive

# Via slash command (dentro da sessão)
/proactive
```

Verifique nos logs:
- `<tick>HH:MM:SS</tick>` deve aparecer a cada ~30s
- Sem repetição excessiva
- Desaparece quando queue tem mensagens (pauseProactive)

## Arquivos

| Arquivo | Funcao |
|---------|--------|
| `src/proactive/index.ts` | Estado global + logica de ticks + __resetForTesting() |
| `src/proactive/proactive.test.ts` | 21 testes estruturados (21/21 PASS) |
| `src/proactive/useProactive.ts` | React hook para UI |
| `src/commands/proactive.ts` | Slash command `/proactive` |
| `src/cli/print.ts` | Tick scheduling + injection (com shouldTick()) |
| `src/screens/REPL.tsx` | Pause/resume na UI |
| `src/main.tsx` | Ativacao via flag/env |

## Gates resolvidos

Todos os `(false || false)` relacionados ao proactive foram removidos:
- `src/cli/print.ts` (4 gates)
- `src/screens/REPL.tsx` (7 gates)
- `src/main.tsx` (2 gates)
- `src/constants/prompts.ts` (1 gate)
- `src/components/Messages.tsx` (1 gate)
- `src/components/PromptInput/` (2 gates)
- `src/tools/AgentTool/AgentTool.tsx` (1 gate)
- `src/services/compact/prompt.ts` (1 gate)
- `src/utils/systemPrompt.ts` (1 gate)
- `src/commands.ts` (1 gate)
- `src/commands/clear/conversation.ts` (1 gate)
