# 🧪 Guia de Testes: Validar Patches

**Como testar os 6 patches aplicados**

---

## Teste 1: Compilação TypeScript ✅

```bash
# Verificar que não há erros NOVOS causados pelos patches
npx tsc --noEmit 2>&1 | grep -c "error TS"

# Esperado: Mesmo número de erros que antes (pré-existentes)
# Se AUMENTOU: problema nos patches
```

**O que testar:**
- ✅ Nenhum novo erro TypeScript
- ✅ Código compila
- ✅ Sem quebra de tipos

---

## Teste 2: Sugestões Aparecem Cedo (PATCH #5) ⭐

**Cenário:** Novo usuário vê sugestão de prompt na primeira resposta

### Passo 1: Start OpenClaude
```bash
npm start
# ou
jarvis
```

### Passo 2: Primeira mensagem
```
Digita: "oi"
```

**Esperado (30% das vezes):**
```
✅ Aparecer sugestão de prompt ghosted no input
   Exemplo: "Como você posso te ajudar? [TAB to accept]"
   
❌ NÃO aparecer = throttle suprimiu (70% natural)
   Tenta novamente na Turn 2 (deve aparecer 100%)
```

### Passo 3: Segunda mensagem
```
Digita: "refactore meu código"
```

**Esperado:**
```
✅ Sugestão DEVE aparecer aqui
   (Turn 1+, sempre visível)
```

**Validação:**
- [x] Sugestão apareceu em Turn 1 ou 2
- [x] Mensagem não foi quebrada
- [x] Não há erro de "throttle"

---

## Teste 3: Output Comunicativo (PATCH #4) ⭐⭐⭐

**Cenário:** Claude responde de forma clara e estruturada

### Passo 1: Pedir tarefa simples
```
refactore essa função para ser mais legível:

function getUserById(id) {
  const db = require('./db')
  const user = db.query('SELECT * FROM users WHERE id = ' + id)
  if (user) {
    return user
  } else {
    return null
  }
}
```

**Esperado — COMUNICATIVO:**
```
✅ Claude diz o que vai fazer ANTES:
   "I'll refactor this function to improve readability."

✅ Executa e explica durante:
   "Reading your code... [changes made]"
   "Running tests to verify behavior..."

✅ Resume ao final:
   "Done! Here's what I changed:
   - Used parameterized query (security)
   - Simplified return logic
   - Tests: 5 PASS (all still passing)"

✅ Próximos passos sugeridos:
   "Next: Add error handling? Or more improvements?"
```

**Esperado — NÃO conciso/vago:**
```
❌ NÃO aparecer assim (versão antiga):
   "Done. Refactored."
   [Sem explicação, sem teste, vago]
```

**Validação:**
- [x] Explicou o plano (antes de fazer)
- [x] Deu update durante (não desapareceu)
- [x] Resumiu ao final (listar mudanças)
- [x] Próximos passos sugeridos
- [x] Output estruturado, legível

---

## Teste 4: Verificação Obrigatória (PATCH #1) ⭐⭐⭐

**Cenário:** Claude SEMPRE verifica antes de reportar "done"

### Passo 1: Criar arquivo com teste
```
Cria uma função fibonacci com teste.
Depois refactore para performance.
```

**Esperado:**
```
✅ Claude executa testes PRIMEIRO:
   "Running tests..."
   [mostra output: PASS 5/5]

✅ Depois refactora:
   [makes changes]

✅ RE-executa testes:
   "Running tests again..."
   [mostra output: PASS 5/5]

✅ Reports com EVIDÊNCIA:
   "✅ DONE - Tests: PASS 5/5"
   [mostra números reais de testes]

❌ NUNCA aparece assim:
   "Done. Refactored. Tests pass."
   [sem rodar teste, sem output, só afirmar]
```

**Validação:**
- [x] Testes foram rodados (vê o comando)
- [x] Output de testes foi mostrado
- [x] Resultados mudaram (turn 2: re-rodar testes)
- [x] Reporta PASS/FAIL com números

---

## Teste 5: Colaboração Ativa (PATCH #2) ⭐⭐

**Cenário:** Claude questiona decisões ruins antes de executar

### Passo 1: Pedir algo que quebra código
```
Adicione SSO (single sign-on) direto na autenticação.
```

**Esperado:**
```
✅ Claude aponta problema ANTES de fazer:
   "Before I implement SSO, I should point out:
   
   1. **Security risk:** Your current auth uses JWT + cookies
      SSO without CSRF tokens could be vulnerable
      
   2. **Breaking change:** This affects 847 existing sessions
      Would need migration strategy
      
   3. **Better approach:** 
      - First: Set up OAuth provider (Google/GitHub)
      - Then: Add CSRF protection to auth flow
      - Finally: Migrate sessions with backward compatibility
   
   Should I proceed with this safer approach?"

✅ Aguarda confirmação do usuário

❌ NUNCA aparece assim (antes):
   "Done. Added SSO."
   [executa sem questionar, quebra em produção]
```

**Validação:**
- [x] Questionou antes de executar
- [x] Apontou risks específicos (não genérico)
- [x] Sugeriu alternativa melhor
- [x] Aguardou confirmação

---

## Teste 6: Honestidade (PATCH #3) 🎯

**Cenário:** Claude NUNCA alucina resultado de testes

### Passo 1: Criar código que FALHA testes
```
Pedir para refactora código que QUEBRA testes.
```

**Esperado:**
```
✅ Claude rodará testes E MOSTRARÁ FALHA:
   "Running tests...
   
   ❌ FAIL: 3 tests failing
   
   [mostra output real:
    ● getUserById
      Expected: { id: 1, name: 'John' }
      Got: undefined
   ]"

✅ Depois de fix:
   "Running tests again...
   
   ✅ PASS: 5/5 tests passing"

❌ NUNCA aparece assim:
   "Done. Tests pass."
   [FALSO - não rodou, alucinação]
```

**Validação:**
- [x] Mostra FAIL explicitamente quando falha
- [x] Mostra error output real
- [x] Depois de fix, mostra PASS
- [x] Nunca diz "pass" quando há erro

---

## Teste 7: Identidade Melhorada (PATCH #6) ✨

**Cenário:** OpenClaude menciona sua identidade e expertise

### Passo 1: Primeira mensagem
```
Oi, quem é você?
```

**Esperado:**
```
✅ Claude responde com identidade:
   "I'm OpenClaude, an open-source coding assistant 
    with expertise in software engineering, code analysis, 
    debugging, and system design."

✅ Menciona que é colaborador:
   "I approach problems as a collaborator and expert, 
    not just an executor. I'll point out issues, 
    suggest better approaches..."

❌ NUNCA assim (antes):
   "I'm an interactive agent that helps users..."
   [genérico, sem identidade]
```

**Validação:**
- [x] Menciona "OpenClaude" (identidade)
- [x] Lista expertise (eng, debug, design)
- [x] Menciona colaboração
- [x] Não é genérico

---

## Teste 8: Teste Completo (Cenário Real) 🎬

**Simular fluxo de novo usuário:**

### Step 1: Start
```bash
npm start
```

### Step 2: Tipo "oi"
```
Esperado:
- [x] Sugestão aparece 30% das vezes
- [x] Resposta amigável
- [x] Claro que é OpenClaude
```

### Step 3: Pedir refatoração
```
"Refactore meu código para ser mais rápido"
[cola código simples]
```

**Esperado:**
```
- [x] "I'll refactor your code..." (comunicativo)
- [x] Explica o plano
- [x] Roda testes ANTES
- [x] Faz mudanças
- [x] Roda testes DEPOIS
- [x] Mostra results (PASS X/Y)
- [x] Resume mudanças
- [x] Sugere próximos passos
```

### Step 4: Pedir algo ruim
```
"Adicione cache sem validação"
```

**Esperado:**
```
- [x] Claude questiona: "This could cause stale data..."
- [x] Sugere melhor: "First add TTL, then validation..."
- [x] Aguarda confirmação
```

### Step 5: Pedir verificação
```
"Funciona? Rode os testes."
```

**Esperado:**
```
- [x] Claude roda testes MESMO ANTES DE PEDIDO
- [x] (Verification é obrigatória)
- [x] Mostra output: PASS 12/12
- [x] Confiável
```

---

## Checklist de Validação

```
PATCH #1 - Verificação:
  [ ] Testes são rodados antes de "done"
  [ ] Output dos testes é mostrado
  [ ] Nunca diz "pass" sem evidence
  [ ] Re-roda testes após mudanças

PATCH #2 - Colaboração:
  [ ] Questiona decisões ruins
  [ ] Aponta risks específicos
  [ ] Sugere alternativas
  [ ] Aguarda confirmação antes de executar

PATCH #3 - Honestidade:
  [ ] FAIL é reportado explicitamente
  [ ] Error output é mostrado
  [ ] Nunca suprime erros
  [ ] PASS é claro com números

PATCH #4 - Comunicativo:
  [ ] Explica plano ANTES
  [ ] Dá updates DURANTE
  [ ] Resume mudanças DEPOIS
  [ ] Estrutura clara, legível
  [ ] Não é vago ou conciso demais

PATCH #5 - Sugestões:
  [ ] Aparecem em Turn 1 (30% chance) ou Turn 2 (100%)
  [ ] Não aparecem vázias/quebradas
  [ ] São contextuais e úteis
  [ ] Não spammam

PATCH #6 - Identidade:
  [ ] Menciona "OpenClaude"
  [ ] Lista expertise
  [ ] Menciona colaboração
  [ ] Não é genérico
```

---

## Interpretação de Resultados

### ✅ Tudo Passou
```
Patches estão funcionando corretamente!
Próximo passo: Fase 8.7 (WebSocket)
```

### ⚠️ Alguns Falharam
```
Quais falharam:
- Patch #1: Verificação não roda? → debug getOutputEfficiencySection
- Patch #4: Output vago? → verificar Output Efficiency retornou à versão concisa
- Patch #5: Sugestões não aparecem? → verificar promptSuggestion.ts mudança
```

### ❌ Tudo Falhou
```
Possível:
1. Patches não foram aplicados (git status)
2. Código não foi recarregado (restart terminal)
3. Erro de compilação (npx tsc)
4. Cache do app (limpar node_modules, reinstalar)
```

---

## Debug Rápido

### Se Patch #4 não funciona (Output não comunicativo)

Verificar em `prompts.ts:396`:
```typescript
function getOutputEfficiencySection(): string {
  // Deve SEMPRE retornar versão "Communicating with the user"
  // Não deve ter if statement com USER_TYPE
  return `# Communicating with the user...`
}
```

### Se Patch #5 não funciona (Sugestões não aparecem)

Verificar em `promptSuggestion.ts:141`:
```typescript
// Deve permitir sugestões desde Turn 0 (com throttle)
if (assistantTurnCount === 0) {
  const suppressionRate = 0.7  // 70% suprime, 30% mostra
  if (Math.random() < suppressionRate) {
    return null
  }
}
// Turn 1+: sempre mostra
```

### Se Patch #1 não funciona (Verificação não roda)

Verificar em `prompts.ts:195-210` (codeStyleSubitems):
```typescript
// Deve ter instruções de verificação SEM gate
`Before reporting a task complete, verify it actually works:
1. For tests: Run them...
2. For scripts: Execute them...
...`
```

---

## Próximo Passo Após Testes

Se tudo passar:
```bash
# Commit está limpo
git log -1

# Pode prosseguir para Fase 8.7
# WebSocket Integration
```

Se algo falhar:
```bash
# Revisar patch específico
git show c3287b7 -- [arquivo]

# Se necessário, revert
git revert c3287b7
```

