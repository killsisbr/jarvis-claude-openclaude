# Night Worker — Executor Autonomo de Missoes

**Data**: 2026-05-20
**Versao**: v5.0.0
**Status**: Implementado e funcional

---

## O que e

O Night Worker permite que voce **assigne uma tarefa ao JARVIS, va dormir, e acorde com o trabalho feito**. Ele executa missoes longas de forma autonoma seguindo um pipeline estruturado:

```
Missao criada via API
  |
  +-- Planner (LLM decompoe em fases ordenadas)
  |
  +-- Executor (roda fase por fase com retries)
  |     |
  |     +-- Escreve arquivos
  |     +-- Executa comandos
  |     +-- Roda testes
  |     +-- Retry automatico se falhar
  |
  +-- Budget Guard (para se estourar limite)
  |
  +-- Safety Rules (bloqueia comandos perigosos)
  |
  +-- Report Generator (relatorio markdown detalhado)
```

---

## Arquitetura

| Arquivo | Funcao |
|---------|--------|
| `src/worker/night-worker.ts` | Engine completo (NightWorker class) |
| `src/worker/db/schema.ts` | Tabelas `missions` + `mission_logs` (SQLite) |
| `src/worker/server.ts` | Endpoints REST da API |
| `night-worker.bat` | Launcher Windows |

---

## API Endpoints

### POST /api/mission — Criar missao

```bash
curl -X POST http://localhost:3000/api/mission \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Refatorar modulo de auth",
    "description": "Reescrever o modulo de autenticacao usando JWT. Criar testes unitarios. Manter compatibilidade com a API existente.",
    "workingDir": "C:\\meu-projeto",
    "budgetLimit": 25.0
  }'
```

**Resposta** (201):
```json
{
  "id": "uuid-da-missao",
  "title": "Refatorar modulo de auth",
  "status": "queued",
  "budgetLimit": 25.0,
  "message": "Mission queued and execution started in background."
}
```

A missao comeca a executar imediatamente em background.

### GET /api/mission — Listar missoes

```bash
# Todas
curl http://localhost:3000/api/mission

# Filtrar por status
curl http://localhost:3000/api/mission?status=running
```

Status possiveis: `queued`, `planning`, `running`, `paused`, `completed`, `failed`, `cancelled`

### GET /api/mission/:id — Detalhes

```bash
curl http://localhost:3000/api/mission/uuid-da-missao
```

Retorna missao completa com todas as fases, tokens, custos e outputs.

### GET /api/mission/:id/report — Relatorio

```bash
curl http://localhost:3000/api/mission/uuid-da-missao/report
```

Retorna o relatorio em markdown. Tambem salvo em disco em `~/.jarvis/night-worker-reports/`.

### POST /api/mission/:id/cancel — Cancelar

```bash
curl -X POST http://localhost:3000/api/mission/uuid-da-missao/cancel
```

---

## Safety Rules

O Night Worker **bloqueia automaticamente** comandos perigosos:

| Bloqueado | Motivo |
|-----------|--------|
| `rm -rf /` | Destruicao de filesystem |
| `git push` | Push sem revisao humana |
| `npm publish` | Publicacao sem revisao |
| `docker push` | Push de imagem sem revisao |
| `kubectl apply/delete` | Alteracao de infra |
| `drop table/database` | Destruicao de dados |
| `shutdown`, `reboot` | Desligar maquina |
| `format C:` | Formatar disco |

Arquivos protegidos (nao podem ser escritos):
- `.env`, `.env.production`
- `credentials.json`, `secrets.yaml`
- `id_rsa`, `id_ed25519`

---

## Budget Guard

Cada missao tem um limite de custo (default: $50.00). Se o custo total atingir o limite, a missao e **pausada automaticamente** com status `paused` e mensagem "Budget limit reached".

Para retomar, crie uma nova missao ou ajuste o budgetLimit.

---

## Retry Automatico

Cada fase tem ate 2 retries (configuravel). Se a fase falhar:
1. O output de erro e enviado ao LLM como contexto
2. O LLM tenta corrigir e re-executar
3. Se esgotar retries, a fase e marcada como `failed`

---

## Relatorio de Missao

Ao final de cada missao (sucesso ou falha), um relatorio markdown e gerado em:
```
~/.jarvis/night-worker-reports/mission-YYYY-MM-DD-xxxxxxxx.md
```

Conteudo do relatorio:
- Resumo (status, duracao, custo, tokens)
- Lista de fases com status (passed/failed/skipped)
- Detalhes de cada fase (output, testes, retries)
- Notas de seguranca
- Erros (se houver)

---

## Exemplos de Uso

### Missao simples: criar componente

```bash
curl -X POST http://localhost:3000/api/mission \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Criar componente de login",
    "description": "Criar um componente React de login com email/senha. Incluir validacao de formulario, loading state, e tratamento de erros. Criar testes com vitest. Usar TailwindCSS para estilizacao.",
    "workingDir": "/home/user/meu-app",
    "budgetLimit": 10.0
  }'
```

### Missao complexa: refatorar projeto

```bash
curl -X POST http://localhost:3000/api/mission \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Migrar de Express para Hono",
    "description": "Migrar toda a API de Express para Hono. Manter os mesmos endpoints e comportamento. Atualizar testes. Manter middleware de auth e CORS. O projeto usa TypeScript. Comando de teste: bun test",
    "workingDir": "/home/user/api-project",
    "budgetLimit": 30.0
  }'
```

### Monitorar progresso

```bash
# Verificar status a cada 30 segundos
watch -n 30 'curl -s localhost:3000/api/mission/UUID | jq .status'

# Windows (PowerShell)
while ($true) { (Invoke-RestMethod localhost:3000/api/mission/UUID).status; Start-Sleep 30 }
```

---

## Dicas para Missoes Eficientes

1. **Seja especifico na descricao** — quanto mais detalhes, melhor o plano
2. **Mencione o comando de teste** — se o projeto tem `npm test` ou `bun test`, mencione na descricao
3. **Indique arquivos existentes** — "o arquivo routes.ts ja existe em src/"
4. **Defina budget realista** — missoes simples: $5-10, medias: $15-25, complexas: $30-50
5. **Uma missao por escopo** — melhor criar 3 missoes focadas do que 1 missao gigante
