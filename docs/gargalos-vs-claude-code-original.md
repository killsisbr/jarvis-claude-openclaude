# Análise de Gargalos: OpenClaude vs Claude Code Original

**Data:** 2026-05-18
**Objetivo:** Documentar as diferenças críticas entre o comportamento do OpenClaude (fork open-source) e o Claude Code original da Anthropic.

---

## Sumário

1. [Contexto](#1-contexto)
2. [Gargalo #1 — CLAUDE_CODE_SIMPLE](#2-gargalo-1--claude_code_simple)
3. [Gargalo #2 — Identidade do Agente Genérica](#3-gargalo-2--identidade-do-agente-genérica)
4. [Gargalo #3 — USER_TYPE desativa instruções pró-ativas](#4-gargalo-3--user_type-desativa-instruções-pró-ativas)
5. [Gargalo #4 — Output Efficiency Section](#5-gargalo-4--output-efficiency-section)
6. [Gargalo #5 — Sugestões bloqueadas nos primeiros turnos](#6-gargalo-5--sugestões-bloqueadas-nos-primeiros-turnos)
7. [Gargalo #6 — Sem sistema de fases / próximo passo](#7-gargalo-6--sem-sistema-de-fases--próximo-passo)
8. [Tabela Comparativa Completa](#8-tabela-comparativa-completa)
9. [Plano de Correção](#9-plano-de-correção)

---

## 1. Contexto

### O problema

Usuários reportam que o Claude Code original (via API Anthropic) é **significativamente melhor** que o OpenClaude nos seguintes aspectos:

- Dá exemplos de prompt contextualizados
- Pergunta "quer seguir para a fase X?" e sugere próximos passos
- Oferece tab completion com sugestões relevantes
- É mais pró-ativo e direcional
- Se comunica de forma mais clara sobre o que está fazendo

### Causa raiz

O OpenClaude modificou ou simplificou **6 áreas específicas** do system prompt e do código de interação. A causa principal é que o fork removeu o sistema de `USER_TYPE='ant'` que controla gate features internas, e simplificou a identidade do agente.

### Arquivo principal

Todas as seções do system prompt estão em:

```
src/constants/prompts.ts
```

---

## 2. Gargalo #1 — CLAUDE_CODE_SIMPLE

### Localização

`src/constants/prompts.ts:440-443`

### Código

```typescript
if (isEnvTruthy(process.env.CLAUDE_CODE_SIMPLE)) {
  return [
    `You are OpenClaude, an open-source coding agent and CLI.\n\nCWD: ${getCwd()}\nDate: ${getSessionStartDate()}`,
  ]
}
```

### Impacto

Se `CLAUDE_CODE_SIMPLE` está setado como `true`, o system prompt inteiro é substituído por **uma única linha genérica**. Sem instruções de:
- Uso de ferramentas
- Tom e estilo
- Proatividade
- Sugestões de próximo passo
- Segurança

### Severidade

| Item | Valor |
|------|-------|
| **Impacto** | 🔴 Crítico (destrói completamente o comportamento do agente) |
| **Afeta** | Sessões com env var setada |
| **Correção** | Remover env var ou garantir que não seja setada |

---

## 3. Gargalo #2 — Identidade do Agente Genérica

### Localização

`src/constants/prompts.ts:165-174`

### Código — OpenClaude (atual)

```typescript
function getSimpleIntroSection(
  outputStyleConfig: OutputStyleConfig | null,
): string {
  return `
You are an interactive agent that helps users ${
  outputStyleConfig !== null
    ? 'according to your "Output Style" below...'
    : 'with software engineering tasks.'
} Use the instructions below and the tools available to you to assist the user.
...
`
}
```

### Código — Claude Code original (esperado)

```typescript
You are Claude, an AI assistant created by Anthropic to be helpful, harmless, and honest.
You are an interactive agent that helps users with software engineering tasks...
```

### Diferença

| Aspecto | Original | OpenClaude |
|---------|----------|------------|
| Identidade | "Claude, an AI assistant" | "an interactive agent" |
| Personalidade | Clara, com marca | Genérica, utilitária |
| Proatividade |  Instruído a ser direcional | Apenas reativo |

### Impacto

O modelo recebe uma identidade genérica, o que reduz drasticamente a probabilidade de:
- Sugerir próximos passos proativamente
- Oferecer ajuda além do que foi pedido
- Manter uma persona consistente

### Severidade

| Item | Valor |
|------|-------|
| **Impacto** | 🔴 Crítico |
| **Afeta** | Toda sessão |
| **Correção** | Restaurar identidade + adicionar instruções de proatividade |

---

## 4. Gargalo #3 — USER_TYPE desativa instruções pró-ativas

### Localização

Múltiplas linhas em `src/constants/prompts.ts`

### O sistema USER_TYPE

O código usa `process.env.USER_TYPE === 'ant'` como gate para **6 blocos de instruções**. Quando `USER_TYPE` não é `'ant'` (caso do OpenClaude), esses blocos são simplesmente ignorados.

### Bloco 1: Instruções de comentários e verificação

`prompts.ts:195-203`

```typescript
...(process.env.USER_TYPE === 'ant'
  ? [
      `Default to writing no comments...`,
      `Don't explain WHAT the code does...`,
      `Before reporting a task complete, verify it actually works...`,
    ]
  : []),
```

**Sem isso:** O modelo não é instruído a verificar se o código realmente funciona antes de reportar conclusão.

### Bloco 2: Colaborador, não executor

`prompts.ts:215-219`

```typescript
...(process.env.USER_TYPE === 'ant'
  ? [
      `If you notice the user's request is based on a misconception, or spot a bug adjacent
       to what they asked about, say so. You're a collaborator, not just an executor...`,
    ]
  : []),
```

**Sem isso:** O modelo age como executor cego, sem contestar decisões erradas do usuário.

### Bloco 3: Prevenção de falsas alegações

`prompts.ts:228-232`

```typescript
...(process.env.USER_TYPE === 'ant'
  ? [ /* instruções contra falsas alegações */ ]
  : []),
```

### Bloco 4: Reporte de bugs do próprio OpenClaude

`prompts.ts:233-237`

```typescript
...(process.env.USER_TYPE === 'ant'
  ? [
      `If the user reports a bug, slowness, or unexpected behavior with OpenClaude itself...
       recommend /issue or /share`,
    ]
  : []),
```

### Bloco 5: Respiração / planejamento interno

`prompts.ts:394` (dentro de `getSessionSpecificGuidanceSection`)

### Bloco 6: Output Efficiency

`prompts.ts:423`

```typescript
process.env.USER_TYPE === 'ant'
  ? null  // (não força "short and concise" para usuários internos)
  : `Your responses should be short and concise.`,
```

### Tabela consolidada

| # | Linha | O que falta sem `USER_TYPE='ant'` | Impacto |
|---|-------|-----------------------------------|---------|
| 1 | 195 | Verificar antes de reportar conclusão |  Código não testado |
| 2 | 215 | Ser colaborador, contestar decisões |  Execução cega |
| 3 | 228 | Prevenir falsas alegações |  Alucinações |
| 4 | 233 | Reportar bugs do CLI corretamente |  Suporte |
| 5 | 394 | Seção de saída detalhada |  Comunicação |
| 6 | 423 | "Seja conciso" é forçado |  Respostas curtas demais |

### Severidade

| Item | Valor |
|------|-------|
| **Impacto** | 🔴 Crítico (é o maior gargalo individual) |
| **Afeta** | Toda sessão |
| **Correção** | Copiar blocos para fora do `if (USER_TYPE === 'ant')` |

---

## 5. Gargalo #4 — Output Efficiency Section

### Localização

`src/constants/prompts.ts:391-418`

### Diferença completa

**Quando `USER_TYPE === 'ant'`:**

```typescript
# Communicating with the user
When sending user-facing text, you're writing for a person, not logging to a console...

- Antes do primeiro tool call, diga brevemente o que vai fazer
- Enquanto trabalha, dê updates em momentos-chave: bug encontrado, causa raiz, mudança de direção
- Quando algo der errado, avise antes do próximo tool call
- Ao terminar, sumarize o que fez, listando arquivos alterados e decisões importantes
- Se não tiver progresso há vários tool calls, dê um update rápido
- Se o usuário pedir pra parar, pare imediatamente
```

**Quando `USER_TYPE !== 'ant'` (OpenClaude):**

Instruções genéricas de "seja conciso, não use emojis, referencie arquivos com line_number".

### Impacto

- O modelo não dá updates durante execução
- Não avisa quando encontra problemas
- Não sumariza o que fez ao final
- Parece "seco" e pouco comunicativo

### Severidade

| Item | Valor |
|------|-------|
| **Impacto** |  Alto |
| **Afeta** | Qualidade da comunicação |
| **Correção** | Copiar seção `getOutputEfficiencySection` para fora do gate |

---

## 6. Gargalo #5 — Sugestões bloqueadas nos primeiros turnos

### Localização

`src/services/PromptSuggestion/promptSuggestion.ts:141-144`

### Código

```typescript
const assistantTurnCount = count(messages, m => m.type === 'assistant')
if (assistantTurnCount < 2) {
  logSuggestionSuppressed('early_conversation', undefined, undefined, source)
  return null
}
```

### Impacto

Nas primeiras interações do usuário com o CLI:

- **Zero sugestões de prompt**
- Sem ghost text no input
- Sem tab completion contextual
- Usuário novo não vê exemplos do que pode digitar

### Por que existe?

Provavelmente para evitar sugestões prematuras antes do contexto ser estabelecido. Mas no OpenClaude, como o resto do sistema já é menos direcional, esse bloqueio piora ainda mais a experiência inicial.

### Severidade

| Item | Valor |
|------|-------|
| **Impacto** |  Médio (onboarding) |
| **Afeta** | Primeiras 2 interações |
| **Correção** | Reduzir para 0 ou 1 turno, ou remover |

---

## 7. Gargalo #6 — Sem sistema de fases / próximo passo

### Localização

Não existe — o código simplesmente não foi implementado.

### O que o Claude Code original tem

O original possui um sistema que:
1. Divide tarefas complexas em **fases**
2. Pergunta ao usuário **"quer continuar para a próxima fase?"**
3. Sugere o **próximo prompt** que o usuário pode digitar
4. Usa o `claudeCodeGuideAgent` **proativamente** para guiar o usuário

### O que o OpenClaude tem

O `claudeCodeGuideAgent.ts` existe em:
```
src/tools/AgentTool/built-in/claudeCodeGuideAgent.ts
```

Mas ele é **apenas reativo** — só é invocado quando o usuário pede `/help` ou quando o modelo decide explicitamente usá-lo.

### Sistemas relacionados que existem

| Sistema | Arquivo | Função |
|---------|---------|--------|
| Prompt Suggestions | `promptSuggestion.ts` | Gera sugestões de texto (funciona, mas lento) |
| Typeahead | `useTypeahead.tsx` | Tab completion de comandos/arquivos |
| Tips | `tipRegistry.ts` | Dicas no spinner |
| Onboarding | `projectOnboardingSteps.ts` | Checklist simples de setup |
| `/init` | `init.ts` | Configuração inicial |

### O que falta

- Sugestão de **próximo passo contextual** ("Agora que terminamos X, quer fazer Y?")
- Divisão de tarefas em **fases com confirmação**
- **Agente guia** ativado proativamente no início da sessão

### Severidade

| Item | Valor |
|------|-------|
| **Impacto** |  Alto (diferencial de UX) |
| **Afeta** | Experiência do usuário |
| **Correção** | Implementar sistema de fases ou ativar claudeCodeGuideAgent proativamente |

---

## 8. Tabela Comparativa Completa

| Aspecto | Claude Code Original | OpenClaude (fork) |
|---------|---------------------|-------------------|
| **Identidade** | "Claude, an AI assistant" | "an interactive agent" |
| **Proatividade** | Instruído a sugerir ações | Apenas reativo |
| **Verificação** | "Verifique antes de reportar" | Sem instrução |
| **Colaboração** | "Você é colaborador, conteste decisões" | Apenas executor |
| **Comunicação** | Updates detalhados durante execução | "Seja conciso" |
| **Sugestões iniciais** | Desde o primeiro turno | Bloqueado por 2 turnos |
| **Sistema de fases** | Divisão de tarefas + confirmação | Não existe |
| **Agente guia** | Pró-ativo | Reativo (/help) |
| **Completamento Tab** | Contextual + sugestões de próximo passo | Comandos + arquivos |
| **Tom** | Conversacional, direcional | Utilitário, seco |

---

## 9. Plano de Correção

### Prioridade 1 (Impacto Imediato)

| # | Ação | Arquivo | Esforço |
|---|------|---------|---------|
| 1 | Copiar blocos `USER_TYPE === 'ant'` para fora do gate | `prompts.ts` linhas 195, 215, 228, 233, 394 | 15 min |
| 2 | Restaurar identidade "Claude" + adicionar proatividade | `prompts.ts:170` | 5 min |
| 3 | Remover/reduzir bloqueio de sugestões | `promptSuggestion.ts:141-144` | 2 min |

### Prioridade 2 (Melhoria de UX)

| # | Ação | Arquivo | Esforço |
|---|------|---------|---------|
| 4 | Implementar sistema de fases / próximo passo | Novo arquivo | 2-3 dias |
| 5 | Ativar `claudeCodeGuideAgent` proativamente | `claudeCodeGuideAgent.ts` | 1 dia |

### Verificação

Após cada correção, verificar:
1. TypeScript compila sem erros: `npx tsc --noEmit`
2. Testes existentes continuam passando: `npx bun test`
3. Comportamento do agente mudou como esperado

---

## Arquivos Relevantes

| Arquivo | Função |
|---------|--------|
| `src/constants/prompts.ts` | System prompt principal (todos os gargalos #1-#4) |
| `src/services/PromptSuggestion/promptSuggestion.ts` | Geração de sugestões inline (gargalo #5) |
| `src/tools/AgentTool/built-in/claudeCodeGuideAgent.ts` | Agente guia (gargalo #6) |
| `src/hooks/useTypeahead.tsx` | Tab completion system |
| `src/components/PromptInput/PromptInput.tsx` | Input do usuário com ghost text |
| `src/projectOnboardingSteps.ts` | Passos de onboarding (simples) |

---

## Histórico

| Data | Versão | Descrição |
|------|--------|-----------|
| 2026-05-18 | 1.0 | Análise inicial dos 6 gargalos |
