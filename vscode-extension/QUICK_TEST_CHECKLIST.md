# ⚡ Quick Test Checklist (5 minutos)

Imprima ou use ao lado enquanto testa!

---

## 🎬 QUICK ACTIONS (30 segundos)

```
[ ] Badge "Approvals" mostra número ou "-"
[ ] Clique "+ Novo Skill" → Input → Digite "test" → Enter
    └─ Terminal abre com "jarvis skill create test"
[ ] Clique "📋 Ver Logs" → Output panel abre
[ ] Clique "🎯 Mudar Modo" → Selecione "dev"
    └─ Badge muda para "DEV"

RESULTADO: ___ / 4 ✅
```

---

## 🎯 SKILLS MANAGER (1 minuto)

```
[ ] Pelo menos 2-3 skills aparecem na lista
[ ] Cada skill mostra: nome, descrição, commands, version
[ ] Clique "▶ Executar" → Toast verde aparece
    └─ "✅ Skill 'nome' executada com sucesso!"
[ ] Clique "⟳ Refresh" → Lista atualiza
[ ] Aguarde 5s sem fazer nada → Painel atualiza (polling)

RESULTADO: ___ / 5 ✅
```

---

## 📊 STATUS MONITOR (1 minuto)

```
[ ] Status badge: 🟢 running (ou 🔴 offline)
[ ] Uptime: Formatado (2h, 30m, 1d, 45s) ← UM desses formatos
[ ] Sessions: Número exibido (ex: 5)
[ ] $ Today: Valor em dólares (ex: $25.50)
[ ] Queries: Número exibido
[ ] Key Pools: Lista com "🔑 X / Y" (ex: 3 / 4)
[ ] Cron Jobs: Lista com ✓ ou ✗ status
[ ] Aguarde 3s → Números atualizam sozinhos

RESULTADO: ___ / 8 ✅
```

---

## 💬 CHAT MELHORADO (1,5 minutos)

```
[ ] Digitar "Olá" → Mensagem aparece como bubble
[ ] Digitar "código javascript" → Code block com colors
    └─ const/if/function em cores diferentes
[ ] Clique "📋" em code block → "✓ Copiado!" por 2s
[ ] Digitar "Python code" → Python highlight correto
    └─ def/print em cores diferentes
[ ] Digitar "JSON" → JSON keys em laranja

RESULTADO: ___ / 5 ✅
```

---

## 📈 TOTAL

```
Quick Actions:     ___ / 4
Skills Manager:    ___ / 5
Status Monitor:    ___ / 8
Chat Enhanced:     ___ / 5
─────────────────────────
TOTAL:            ___ / 22  ✅
```

---

## 🎯 SUCESSO = 22/22 ✅

Se conseguiu todos, parabéns! Você testou 100% das features!

---

## 🐛 Se algo não funcionar:

1. **Servidor offline?**
   ```
   Terminal do servidor mostra erro?
   → Feche e rode: npm run dev
   ```

2. **Skills não aparecem?**
   ```
   F12 → Console
   → Ver se há erros sobre /api/skills
   ```

3. **Painel vazio?**
   ```
   Clique "⟳ Refresh" ou espere polling (3-5s)
   ```

4. **Cores não aparecem?**
   ```
   Teste em um code block
   → Code deve ter cores: blue, orange, green
   ```

---

**Tempo estimado: 5 minutos**  
**Dificuldade: Muito fácil**  
**Resultado esperado: 22/22 ✅**
