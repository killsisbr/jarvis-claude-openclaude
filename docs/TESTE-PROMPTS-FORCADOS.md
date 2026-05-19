# 🧪 Como Passar Prompts Forçados para Teste

**Várias formas de testar JARVIS sem digitar interativamente**

---

## Opção 1: Pipe de Input (Bash/PowerShell)

### PowerShell
```powershell
# Forma 1: Echo pipe
echo "refactore meu código" | node bin/jarvis deepseek

# Forma 2: Heredoc (múltiplas linhas)
@"
refactore essa função:

function sum(a, b) {
  return a + b
}
"@ | node bin/jarvis deepseek

# Forma 3: Multi-prompt (sequência de inputs)
echo "oi`nrefactore meu código" | node bin/jarvis deepseek
```

### Bash/Git Bash
```bash
# Simples
echo "refactore meu código" | node bin/jarvis deepseek

# Com código multi-linha
cat <<EOF | node bin/jarvis deepseek
refactore essa função:

function sum(a, b) {
  return a + b
}
EOF
```

---

## Opção 2: Arquivo de Entrada

### Passo 1: Criar arquivo de teste
```powershell
# PowerShell - criar test-prompt.txt
@"
refactore esse código para performance:

function fibonacci(n) {
  if (n <= 1) return n
  return fibonacci(n-1) + fibonacci(n-2)
}

Depois roda os testes.
"@ | Out-File test-prompt.txt -Encoding UTF8

# Depois rodar
Get-Content test-prompt.txt | node bin/jarvis deepseek
```

---

## Opção 3: Variável de Ambiente

```powershell
# PowerShell - definir prompt como env var
$env:JARVIS_PROMPT = "refactore meu código"
node bin/jarvis deepseek

# Ou em uma linha
$env:JARVIS_PROMPT = "refactore meu código"; node bin/jarvis deepseek
```

---

## Opção 4: Via package.json Scripts

Editar `package.json`:
```json
{
  "scripts": {
    "test:patches": "echo 'refactore meu código' | node bin/jarvis deepseek",
    "test:verify": "echo 'rode os testes' | node bin/jarvis deepseek",
    "test:collab": "echo 'adicione cache sem TTL' | node bin/jarvis deepseek"
  }
}
```

Depois rodar:
```bash
npm run test:patches
npm run test:verify
npm run test:collab
```

---

## Opção 5: Shell Script Automatizado (Recomendado)

Criar `test-patches.ps1`:

```powershell
# Teste 1: Verificação
Write-Host "TEST 1: Verificação (PATCH #1)"
@"
Refactore essa função e roda os testes:

function getUserById(id) {
  const db = require('./db')
  return db.query('SELECT * FROM users WHERE id = ' + id)
}
"@ | node bin/jarvis deepseek

Write-Host "`nTESTE 2: Colaboração (PATCH #2)"
@"
Adicione cache sem validação de TTL.
"@ | node bin/jarvis deepseek

Write-Host "`nTESTE 3: Sugestões (PATCH #5)"
echo "oi" | node bin/jarvis deepseek
```

Depois rodar:
```powershell
.\test-patches.ps1
```

---

## Opção 6: Direto com dist/cli.mjs (Se compilado)

Se ja tem `dist/cli.mjs` (rodou `bun run build`):

```powershell
# PowerShell
echo "refactore meu código" | node dist/cli.mjs deepseek
```

---

## 🎯 Exemplo Prático: Teste Completo dos 6 Patches

Crie `test-all-patches.ps1`:

```powershell
#!/usr/bin/env pwsh

Write-Host "================================================================"
Write-Host "🧪 TESTE COMPLETO DOS 6 PATCHES"
Write-Host "================================================================`n"

$provider = "deepseek"  # Trocar para "claude" ou outro se quiser
$testNum = 0

function Test-Patch {
    param([string]$Name, [string]$Prompt)
    $script:testNum++
    Write-Host "TEST $testNum: $Name"
    Write-Host "Input: $Prompt`n"
    Write-Host "Running..."
    $Prompt | node bin/jarvis $provider
    Write-Host "`n---`n"
}

# PATCH #1: Verificação
Test-Patch "Verificação (PATCH #1)" @"
Crie uma função fibonacci e testes:

function fib(n) {
  if (n <= 1) return n
  return fib(n-1) + fib(n-2)
}

Depois refactore para performance e verifica os testes.
"@

# PATCH #2: Colaboração
Test-Patch "Colaboração (PATCH #2)" "Adicione cache sem TTL de expiração"

# PATCH #3: Honestidade
Test-Patch "Honestidade (PATCH #3)" @"
Refactore e mostra exatamente os testes passando/falhando.
"@

# PATCH #4: Output Comunicativo
Test-Patch "Output Comunicativo (PATCH #4)" @"
Refactore meu código de autenticação.
"@

# PATCH #5: Sugestões Desbloqueadas
Test-Patch "Sugestões (PATCH #5)" "oi"

# PATCH #6: Identidade
Test-Patch "Identidade (PATCH #6)" "Quem é você?"

Write-Host "================================================================"
Write-Host "✅ TESTES COMPLETOS"
Write-Host "================================================================"
```

Rodar:
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\test-all-patches.ps1
```

---

## 📊 Checklist de Observação

Para cada teste, observar:

```
☐ Patch #1 - Verificação:
  ☐ Testes foram rodados? (vê npm test)
  ☐ Output do teste foi mostrado?
  ☐ Resultado é PASS/FAIL concreto?

☐ Patch #2 - Colaboração:
  ☐ Claude questionou antes de executar?
  ☐ Apontou risks?
  ☐ Sugeriu alternativa?

☐ Patch #3 - Honestidade:
  ☐ Reporta FAIL explicitamente se tiver erro?
  ☐ Mostra error output?
  ☐ Nunca diz "passou" sem evidence?

☐ Patch #4 - Output Comunicativo:
  ☐ Explicou plano antes?
  ☐ Deu updates durante?
  ☐ Resumiu ao final?

☐ Patch #5 - Sugestões:
  ☐ Sugestão apareceu cedo?
  ☐ Ou deve reenviar prompt?

☐ Patch #6 - Identidade:
  ☐ Mencionou "OpenClaude"?
  ☐ Falou sobre expertise?
```

---

## 🚀 Formas Mais Diretas

### Forma 1: Start-jarvis.bat + Entrada Imediata

```powershell
# Abrir start-jarvis.bat, escolher provider, depois digitar:
refactore esse código

# E colar código no stdin
```

### Forma 2: Direto com Stdin

```powershell
# PowerShell - passar tudo em uma linha
@"
refactore meu código
"@ | .\jarvis.bat deepseek
```

### Forma 3: Com Arquivo Temp

```powershell
# Criar prompt em arquivo temp
$prompt = @"
refactore esse código:

function sum(a,b) { return a+b }
"@

$prompt | Out-File temp-test.txt -Encoding UTF8
Get-Content temp-test.txt | node bin/jarvis deepseek
Remove-Item temp-test.txt
```

---

## ⚡ TL;DR (Mais Simples)

Se só quer testar rápido:

```powershell
# No PowerShell:
echo "refactore meu código" | node bin/jarvis deepseek
```

Se quer testar com código multi-linha:

```powershell
@"
refactore:

function test() {
  return 42
}
"@ | node bin/jarvis deepseek
```

Se quer testar todos os patches:
```powershell
# Baixe test-all-patches.ps1 e roda:
.\test-all-patches.ps1
```

---

## Debug: Se Não Funcionar

```powershell
# 1. Verificar se dist existe
ls dist\cli.mjs

# 2. Verificar se node funciona
node --version

# 3. Tentar rodar interativo primeiro
.\jarvis.bat deepseek
# Depois digitar: refactore meu código

# 4. Se stdin não funciona, tentar arquivo temp
echo "seu prompt aqui" > temp.txt
Get-Content temp.txt | node bin/jarvis deepseek
```

---

