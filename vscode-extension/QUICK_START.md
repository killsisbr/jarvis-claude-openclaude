# ⚡ Quick Start - Testing the 4 New Features

## 🎬 O que fazer agora

### Passo 1: VS Code deve estar abrindo
- Aguarde a janela do VS Code aparecer
- Isso pode levar 10-15 segundos

### Passo 2: Executar a extensão
No VS Code:
1. Pressione **F5** (ou Debug > Start Debugging)
2. Uma nova janela VS Code abrirá com "[Extension Development Host]"
3. Aguarde 5-10 segundos para extensão carregar

### Passo 3: Verificar que extensão carregou
Na aba Activity Bar (esquerda):
- Procure pelo ícone **OpenClaude** (último ícone)
- Clique nele

### Passo 4: Você deve ver 5 ABAS

```
┌─────────────────────────────────┐
│  OpenClaude Sidebar             │
├─────────────────────────────────┤
│ ⚡ Quick Actions       [NEW]    │
│ 🎯 Skills Manager      [NEW]    │
│ 📊 Status Monitor      [NEW]    │
│ 💬 Chat                         │
│ 🎛️  Control Center              │
└─────────────────────────────────┘
```

---

## 🧪 Teste 1: Quick Actions (30 segundos)

### Painel 1: Quick Actions (topo)
```
┌─────────────────────────────┐
│ ⚡ Quick Actions            │
├─────────────────────────────┤
│ ✨ Novo Skill              │
│ 📋 Ver Logs                │
│ ✓ Approvals          [0]   │  <- Badge
├─────────────────────────────┤
│ 🎯 Plan Mode                │
│ Modo atual:  OPERATE       │
│ 🔄 Mudar Modo              │
└─────────────────────────────┘
```

### Teste:
- [ ] Clicar "✨ Novo Skill" → Pede nome → Digite "test1" → Enter
- [ ] Clicar "📋 Ver Logs" → Output panel abre (Ctrl+J)
- [ ] Badge de Approvals mostra número ou "–"
- [ ] Clicar "🎯 Mudar Modo" → Dropdown com 4 opções
  - dev / audit / operate / execute
  - Selecionar "dev" → Badge muda para "DEV"

**Esperado:** 4/4 funcionando ✅

---

## 🎯 Teste 2: Skills Manager (1 minuto)

### Painel 2: Skills Manager
```
┌─────────────────────────────┐
│ 🎯 Skills Manager           │
├─────────────────────────────┤
│ [+ Novo]  [⟳ Refresh]       │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ example                 │ │
│ │ A test skill            │ │
│ │ [test]                  │ │
│ │ [▶ Executar]            │ │
│ │ v1.0.0 ✓ Ativa         │ │
│ └─────────────────────────┘ │
│                              │
│ ┌─────────────────────────┐ │
│ │ cost-monitor            │ │
│ │ Monitor skill costs     │ │
│ │ [monitor]               │ │
│ │ [▶ Executar]            │ │
│ └─────────────────────────┘ │
│                              │
│ (mais skills...)             │
└─────────────────────────────┘
```

### Teste:
- [ ] Pelo menos 2-3 skills aparecem
- [ ] Cada skill mostra: nome, descrição, commands, versão
- [ ] Clicar "▶ Executar" em uma skill
  - Toast verde aparece: "✅ Skill 'nome' executada com sucesso!"
- [ ] Clicar "[⟳]" para refresh manual
  - Lista atualiza
- [ ] Aguardar 5 segundos
  - Painel atualiza automaticamente (polling)

**Esperado:** 5/5 funcionando ✅

---

## 📊 Teste 3: Status Monitor (1 minuto)

### Painel 3: Status Monitor
```
┌──────────────────────────────┐
│ 📊 Status Monitor            │
├──────────────────────────────┤
│                    🟢 running │
│                              │
│ ┌──────────┬──────────┐      │
│ │ Uptime   │ Sessions │      │
│ │   2h     │    5     │      │
│ ├──────────┼──────────┤      │
│ │ $ Today  │ Queries  │      │
│ │ $25.50   │   142    │      │
│ └──────────┴──────────┘      │
│                              │
│ 🔗 Key Pools (3)             │
│ ┌──────────────────────────┐ │
│ │ Claude       🔑 3 / 4    │ │
│ │ OpenAI       🔑 2 / 3    │ │
│ └──────────────────────────┘ │
│                              │
│ ⏱️  Cron Jobs (2)             │
│ ┌──────────────────────────┐ │
│ │ cost-check    ✓ active   │ │
│ │ checkpoint    ✓ active   │ │
│ └──────────────────────────┘ │
│                              │
│ 🛡️  Sentinels (5)             │
│ ┌──────────────────────────┐ │
│ │ CostSentinel  ✓ 0 erros  │ │
│ │ KeyPoolSent.  ✓ 0 erros  │ │
│ │ SessionSent.  ✓ 0 erros  │ │
│ └──────────────────────────┘ │
│                              │
│          [⟳ Atualizar]        │
└──────────────────────────────┘
```

### Teste:
- [ ] Status badge mostra 🟢 running (ou 🔴 offline)
- [ ] 4 métricas em cards:
  - [ ] Uptime formatado (1h, 2d, 30m, 45s)
  - [ ] Sessions com número
  - [ ] Custo em $ (ex: $25.50)
  - [ ] Queries com número
- [ ] Key Pools listados (Claude, OpenAI, etc)
- [ ] Cron jobs mostrados com status
- [ ] Sentinels listados com erro count
- [ ] Clicar "[⟳]" → dados atualizam
- [ ] Aguardar 3 segundos → atualiza automaticamente

**Esperado:** 8/8 funcionando ✅

---

## 💬 Teste 4: Chat Melhorado (2 minutos)

### Painel 4: Chat
```
┌──────────────────────────────┐
│ 💬 OpenClaude Chat           │
├──────────────────────────────┤
│                              │
│         👤 Você              │
│  Oi, pode fazer um teste?    │
│                              │
│         🤖 Assistant         │
│  Claro! Quer um code demo?   │
│                              │
│ ┌──────────────────────────┐ │
│ │ javascript                │ │
│ │ ┌────────────────────────┤ │
│ │ │📋 copy code            │ │
│ │ ├────────────────────────┤ │
│ │ │const x = 10;           │ │
│ │ │console.log(x);         │ │
│ │ └────────────────────────┘ │
│ └──────────────────────────┘ │
│                              │
│ [Input...]  [Send]           │
└──────────────────────────────┘
```

### Teste:
- [ ] Digitar: "Olá" → Click Send
  - Mensagem aparece como bubble
- [ ] Digitar: "show me javascript code" → Send
  - Resposta com code block
  - Code aparece com syntax highlighting
  - Keywords em cores diferentes
- [ ] Clicar "📋" em um code block
  - Botão muda para "✓ Copiado!" por 2s
  - Código foi copiado para clipboard
- [ ] Digitar novo code ou pedir outro
  - Diferentes linguagens (Python, JSON, etc)
  - Cada uma com highlighting correto
- [ ] Procurar por campo de search (se implementado)
  - Digitar palavra chave
  - Mensagens filtram em tempo real

**Esperado:** 5/5 funcionando ✅

---

## 📈 Resumo de Testes

| Feature | Teste | Status |
|---------|-------|--------|
| Quick Actions | 4 testes | [ ] |
| Skills Manager | 5 testes | [ ] |
| Status Monitor | 8 testes | [ ] |
| Chat Enhanced | 5 testes | [ ] |
| **TOTAL** | **22 testes** | [ ] |

---

## 🎯 Próximos passos após teste

### Se tudo funcionou ✅
1. Fazer print/screenshot das abas
2. Testar combinações (executar skill → ver status atualizar)
3. Mudar plan mode → ver reflection em approvals
4. Criar um skill → ver aparecer em Skills Manager

### Se algo não funcionou ❌
1. Abrir F12 (DevTools) na aba Extension Host
2. Ver console.error / warnings
3. Verificar Network tab para fallhas de API
4. Checar se servidor está em http://localhost:3000/health

### Relatório final
- [ ] Tudo funcionando
- [ ] Encontrou bugs (listar abaixo)
- [ ] Performance excelente
- [ ] UI intuitiva

---

**Boa sorte! 🚀**
