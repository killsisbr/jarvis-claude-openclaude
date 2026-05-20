# OAuth vs --bare Mode: Guia de Autenticacao

**Data**: 2026-05-20
**Versao**: v5.0.0
**Severidade**: Critica — causa "Credit balance too low" mesmo com conta Pro

---

## O Problema

Ao usar `--bare` no comando de inicializacao (ex: `node dist/cli.mjs --bare`),
o OpenClaude **desabilita completamente** a autenticacao OAuth.

Isso significa que:
- `/login` funciona (retorna "Login successful")
- Mas o token OAuth **nao e usado** nas requisicoes
- O sistema tenta usar `ANTHROPIC_API_KEY` do .env ou `apiKeyHelper`
- Se nenhum dos dois existir → erro "Credit balance too low"

### Sintoma

```
> /login
└  Login successful

> oi
└  Credit balance too low · Add funds: https://platform.claude.com/settings/billing
```

### Causa Raiz

Arquivo: `src/utils/envUtils.ts` linhas 237-242

```typescript
export function isBareMode(): boolean {
  return (
    isEnvTruthy(process.env.CLAUDE_CODE_SIMPLE) ||
    process.argv.includes('--bare')
  )
}
```

Arquivo: `src/utils/auth.ts` linhas 169-174

```typescript
if (isBareMode()) {
    if (getConfiguredApiKeyHelper()) {
      return { source: 'apiKeyHelper', hasToken: true }
    }
    return { source: 'none', hasToken: false }  // OAuth ignorado!
}
```

Documentacao no codigo:
> `--bare` — skip hooks, LSP, plugin sync, skill dir-walk,
> attribution, background prefetches, and **ALL keychain/credential reads**.
> Auth is strictly ANTHROPIC_API_KEY env or apiKeyHelper from --settings.

---

## Modos de Autenticacao

| Flag | OAuth (/login) | API Key (.env) | apiKeyHelper |
|------|:-:|:-:|:-:|
| Sem flags | ✅ | ✅ | ✅ |
| `--bare` | ❌ | ✅ | ✅ |

---

## Solucao

### Se quer usar conta Pro (OAuth):

**NAO use `--bare`.**

```bat
@rem ERRADO — bloqueia OAuth:
node dist/cli.mjs --bare %*

@rem CORRETO — OAuth funciona:
node dist/cli.mjs %*
```

### Se quer usar API Key (pre-pago):

Pode usar `--bare`, mas precisa ter `ANTHROPIC_API_KEY` no `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-api03-sua-chave-aqui
```

---

## Variaveis de Ambiente que Conflitam

Variaveis vazias no nivel do sistema tambem causam problemas:

```
ANTHROPIC_AUTH_TOKEN = ''          ← intercepta antes do OAuth
ANTHROPIC_DEFAULT_HAIKU_MODEL = '' ← pode confundir seletor de modelo
ANTHROPIC_DEFAULT_SONNET_MODEL = ''
ANTHROPIC_DEFAULT_OPUS_MODEL = ''
```

### Como limpar (PowerShell como Admin):

```powershell
$vars = @(
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
    'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_OPUS_MODEL'
)
foreach ($v in $vars) {
    [Environment]::SetEnvironmentVariable($v, $null, 'User')
    Write-Output "Removido: $v"
}
```

Reinicie o terminal apos executar.

---

## Fluxo de Autenticacao (Resumo)

```
Inicio
  │
  ├─ --bare? ──────────────── SIM ──► Apenas apiKeyHelper ou API Key
  │                                    OAuth IGNORADO
  │
  └─ NAO
       │
       ├─ ANTHROPIC_AUTH_TOKEN set? ── SIM ──► Usa esse token
       │
       ├─ CLAUDE_CODE_OAUTH_TOKEN? ─── SIM ──► Usa esse token
       │
       ├─ OAuth FD token? ──────────── SIM ──► Usa esse token
       │
       ├─ apiKeyHelper configurado? ── SIM ──► Usa helper
       │
       └─ OAuth /login tokens? ─────── SIM ──► Usa conta Pro ✅
```

---

## Arquivos .bat Afetados

Qualquer .bat que use `--bare` vai bloquear OAuth:

```bat
@rem Verificar se seus .bat tem --bare:
findstr /i "bare" *.bat
```

### Historico da Correcao

- **haiku.bat**: Removido `--bare` em 2026-05-20 para permitir OAuth com conta Pro
