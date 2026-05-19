# 🧪 Guia de Teste - VS Code Extension (Fase 7+)

**Servidor esperado:** `http://localhost:3000`

---

## 📋 Checklist de Testes

### 1️⃣ Skills Manager Panel

**Como acessar:**
1. Abrir VS Code
2. Clicar na aba "OpenClaude" (sidebar esquerdo)
3. Ver painel "Skills Manager" (segundo painel)

**Testes a realizar:**
- [ ] **A.1** Listar skills
  - Esperado: Pelo menos 3 skills aparecem (example, cost-monitor, auto-checkpoint)
  - Badge: v1.0.0, comando, status ✓ Ativa

- [ ] **A.2** Refresh automático
  - Ação: Esperar 5 segundos
  - Esperado: Painel atualiza automaticamente sem clicar

- [ ] **A.3** Executar skill
  - Ação: Clicar "▶ Executar" em qualquer skill
  - Esperado: Toast "✅ Skill 'nome' executada com sucesso!"

- [ ] **A.4** Criar nova skill
  - Ação: Clicar "+ Novo"
  - Entrada: "test-skill"
  - Esperado: Terminal abre com `jarvis skill create test-skill`

---

### 2️⃣ Worker Status Monitor

**Como acessar:**
1. Clicar na aba "OpenClaude"
2. Ver painel "Status Monitor" (terceiro painel)

**Testes a realizar:**
- [ ] **B.1** Status badge
  - Esperado: 🟢 running (verde se servidor está online)
  - Ou: 🔴 Desconectado (vermelho se offline)

- [ ] **B.2** Métricas exibidas
  - [ ] Uptime (formato: 1d, 2h, 30m, 45s)
  - [ ] Sessions (número de sessões ativas)
  - [ ] Custo Hoje ($X.XX)
  - [ ] Queries (total de queries processadas)

- [ ] **B.3** Key Pools
  - Esperado: Lista de pools (Claude, OpenAI, etc)
  - Formato: "🔑 3 / 4" (active / total)

- [ ] **B.4** Cron Jobs
  - Esperado: Lista de jobs agendados
  - Status: ✓ active ou ✗ inactive

- [ ] **B.5** Sentinels
  - Esperado: Lista de 5 sentinels (Cost, KeyPool, Session, Database, Error)
  - Formato: "✓ active" ou "✗ 0 erros"

- [ ] **B.6** Polling automático
  - Ação: Esperar 3 segundos
  - Esperado: Números atualizam automaticamente

---

### 3️⃣ Chat Melhorado

**Como acessar:**
1. Clicar na aba "OpenClaude"
2. Ver painel "Chat" (quarto painel)

**Testes a realizar:**
- [ ] **C.1** Enviar mensagem
  - Ação: Digitar "Olá" e enviar
  - Esperado: Mensagem aparece como bubbles

- [ ] **C.2** Code block com syntax highlight
  - Ação: Enviar mensagem: "show me hello world in javascript"
  - Esperado: Code block com colors (keywords azul, strings laranja)

- [ ] **C.3** Copy to clipboard
  - Ação: Clicar "📋" em um code block
  - Esperado: Botão muda para "✓ Copiado!" por 2 segundos

- [ ] **C.4** Search/Filter
  - Ação: Digitar em campo de busca "test"
  - Esperado: Apenas mensagens com "test" ficam visíveis

- [ ] **C.5** Message highlighting
  - Ação: Em um code block, ver diferentes linguagens
  - [ ] JavaScript - keywords coloridos
  - [ ] Python - def, print em cores
  - [ ] JSON - keys, values, booleans destacados

---

### 4️⃣ Quick Actions Bar

**Como acessar:**
1. Clicar na aba "OpenClaude"
2. Ver painel "Quick Actions" (primeiro painel, no topo)

**Testes a realizar:**
- [ ] **D.1** Novo Skill
  - Ação: Clicar botão "✨ Novo Skill"
  - Esperado: Input box pede nome
  - Input: "meu-teste"
  - Esperado: Terminal abre com `jarvis skill create meu-teste`

- [ ] **D.2** Ver Logs
  - Ação: Clicar "📋 Ver Logs"
  - Esperado: Output panel abre (Ctrl+J)

- [ ] **D.3** Approvals Badge
  - Esperado: Badge com número ou "–" (sem approvals)
  - Ação: Se houver approvals, número muda dinamicamente

- [ ] **D.4** Approval Management
  - Ação: Clicar "✓ Approvals"
  - Se houver pendentes:
    - [ ] Lista aparece
    - [ ] Selecionar uma
    - [ ] Escolher "✓ Aprovar" ou "✗ Rejeitar"
    - [ ] Confirmação aparece

- [ ] **D.5** Plan Mode Selector
  - Ação: Clicar "🎯 Mudar Modo"
  - Esperado: QuickPick com 4 opções:
    - [ ] dev (Desenvolvimento - Sem restrições)
    - [ ] audit (Auditoria - Logs completos)
    - [ ] operate (Operação - Permissões normais)
    - [ ] execute (Execução - Modo restrito)
  - Ação: Selecionar "dev"
  - Esperado: Badge muda para "DEV"

- [ ] **D.6** Polling
  - Ação: Esperar 5 segundos
  - Esperado: Badge de approvals atualiza automaticamente

---

## 🔄 Teste de Integração

**Fluxo completo:**
1. Abrir VS Code com extensão
2. Verificar que as 5 abas aparecem (Quick Actions, Skills, Status, Chat, Control Center)
3. Executar um skill no Skills Manager
4. Ver status atualizar no Status Monitor
5. Trocar plan mode no Quick Actions
6. Enviar mensagem com code no Chat
7. Copiar código
8. Verificar approvals

---

## 📊 Resultados Esperados

| Feature | Status | Observação |
|---------|--------|------------|
| **Skills Panel** | ✅ Funciona | Lista, executa, cria |
| **Status Monitor** | ✅ Funciona | Real-time, polling |
| **Chat Enhanced** | ✅ Funciona | Markdown, highlight, copy |
| **Quick Actions** | ✅ Funciona | Buttons, mode, badge |
| **Error Handling** | ✅ Robusto | Fallbacks graceful |
| **Performance** | ✅ Excelente | Sem lag, polling eficiente |

---

## 🐛 Troubleshooting

**Problema:** "Desconectado" no Status Monitor
- ✅ Solução: Verificar se servidor está em `http://localhost:3000`
- ✅ Comando: `npm run dev` no diretório raiz

**Problema:** Skills não aparecem
- ✅ Solução: Verificar se `/api/skills` retorna dados
- ✅ Teste: `curl http://localhost:3000/api/skills`

**Problema:** Buttons não funcionam
- ✅ Solução: Check browser console (F12) para erros
- ✅ Testar isoladamente cada feature

**Problema:** Approvals badge não atualiza
- ✅ Solução: Verificar se `/api/approvals/pending` está respondendo
- ✅ Aumentar timeout de polling se necessário

---

## ✅ Sign-off

Testes realizados em: **_________**  
Pessoa responsável: **_________**  
Versão testada: **v0.3.0 (Fase 7+)**  
Status geral: **[ ] PASSOU  [ ] FALHOU**

---

**Dúvidas?** Abrir issue no repositório ou contatar suporte.
