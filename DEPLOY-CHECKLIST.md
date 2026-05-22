# ☑️ Deploy Checklist — JARVIS Worker VPS

Use este arquivo para acompanhar progresso do deploy.

---

## 📋 PRÉ-DEPLOY (Antes de começar)

- [ ] Acordou bem? ☕
- [ ] Leu `docs/QUICK-START.md`?
- [ ] `.env.vps` tem credenciais corretas?
- [ ] `npm install ssh2 adm-zip dotenv` executado?

---

## 🔍 FASE 1: Validação SSH (10 segundos)

```bash
npm run test-vps
```

**Checklist**:
- [ ] SSH conecta sem erro
- [ ] Mostra "✅ Conectado com sucesso!"
- [ ] VM info aparece (CPU, RAM, disk)
- [ ] PM2 status mostra saas-web

**Se falhar**:
- [ ] Editar `.env.vps` com credenciais corretas
- [ ] Testar manual: `ssh ubuntu@82.29.58.126`
- [ ] Seguir seção "Fix" em QUICK-START.md

---

## 📦 FASE 2: Deploy Staging (2 minutos)

```bash
npm run deploy-worker:staging
```

**Checklist durante execução**:
- [ ] "🔍 Escaneando arquivos locais..." 
- [ ] "✅ ZIP criado com sucesso!"
- [ ] "🔌 Conectando via SSH à VPS..."
- [ ] "✅ Conectado à VPS!"
- [ ] "📤 Enviando ZIP via SFTP..."
- [ ] "✅ Upload concluído!"
- [ ] "🔧 Executando deploy remoto..."
- [ ] "cd .../bun install --production"
- [ ] "cd .../bun run build"
- [ ] "pm2 restart jarvis-worker-staging"

**Após sucesso**:
- [ ] "✅ Deploy Concluído com Sucesso!"
- [ ] URL de acesso aparece

**Se falhar**:
- [ ] Checar logs: `pm2 logs jarvis-worker-staging`
- [ ] Verificar disk: `df -h /home/ubuntu`
- [ ] Verificar RAM: `free -h`

---

## 🧪 FASE 3: Testar Staging (5 minutos)

### **3.1: Conectar SSH**

```bash
ssh ubuntu@82.29.58.126
```

**Checklist**:
- [ ] Conecta sem erro
- [ ] Prompt muda para `ubuntu@vps:~$`

### **3.2: Ver Logs**

```bash
pm2 logs jarvis-worker-staging
```

**Checklist**:
- [ ] Logs aparecem em tempo real
- [ ] Mostra "[startup] ✓ Servidor rodando em http://localhost:3000"
- [ ] Sem erros críticos

### **3.3: Health Check**

```bash
curl http://localhost:3000/health
```

**Esperado**:
```json
{
  "status": "running",
  "uptime": 45,
  "version": "v5.0.0-worker",
  "cost_today": 0.0
}
```

**Checklist**:
- [ ] Retorna HTTP 200
- [ ] JSON válido
- [ ] status = "running"

### **3.4: Chat Test**

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"user":"test","message":"Hi"}'
```

**Esperado**:
```json
{
  "session": "sess_...",
  "reply": "...",
  "cost": 0.05
}
```

**Checklist**:
- [ ] Retorna HTTP 200
- [ ] reply não vazio
- [ ] cost > 0

### **3.5: Sair**

```bash
exit
```

---

## ✅ FASE 4: Deploy Production (30 segundos)

**Pré-requisito**: Staging funcionando 100%

```bash
npm run deploy-worker:prod
```

**Checklist**:
- [ ] Mesmo output que staging
- [ ] "✅ Deploy Concluído com Sucesso!"
- [ ] PM2 name: `jarvis-worker` (não staging)
- [ ] Remote: `/home/ubuntu/openclaude`

---

## 📊 FASE 5: Verificar Production (5 minutos)

```bash
ssh ubuntu@82.29.58.126
```

### **5.1: Logs**

```bash
pm2 logs jarvis-worker
```

**Checklist**:
- [ ] "[startup] ✓ Servidor rodando"
- [ ] Sem erros

### **5.2: PM2 Status**

```bash
pm2 status
```

**Esperado**:
```
┌──────────────┬────┬──────────┐
│ App name     │ id │ status   │
├──────────────┼────┼──────────┤
│ jarvis-worker│ 0  │ online   │
│ saas-web     │ 1  │ online   │
└──────────────┴────┴──────────┘
```

**Checklist**:
- [ ] jarvis-worker = online
- [ ] saas-web = online (não quebrou)
- [ ] Sem status "stopped" ou "errored"

### **5.3: Health Check Live**

```bash
curl http://localhost:3000/health
```

**Checklist**:
- [ ] Mesma resposta que staging
- [ ] uptime > 30 (pelo menos 30 segundos rodando)

### **5.4: Recursos**

```bash
pm2 monit
```

**Checklist**:
- [ ] CPU < 50%
- [ ] RAM < 500MB
- [ ] Sem spike anormal

### **5.5: Sair**

```bash
exit
```

---

## 🎉 FASE 6: Success!

- [ ] staging funciona ✅
- [ ] production funciona ✅
- [ ] ambos no PM2 ✅
- [ ] saas-web não quebrou ✅
- [ ] Recursos normais ✅

**Marque aqui quando completar tudo**:

```
Data: _____________
Hora: _____________
Status: ✅ DEPLOY COMPLETO
```

---

## 📈 Monitoramento (Próximos Dias)

Depois que deploy está live:

### **Diário**

```bash
pm2 logs jarvis-worker  # Ver erros
pm2 status              # Verificar uptime
```

### **Semanal**

```bash
ssh ubuntu@82.29.58.126 "pm2 logs jarvis-worker | tail -100"  # Auditar logs
ssh ubuntu@82.29.58.126 "df -h /home/ubuntu"                  # Disk usage
```

### **Mensal**

```bash
ssh ubuntu@82.29.58.126 "pm2 logs --clear"  # Limpar logs antigos
# Verificar se algum backup precisa ser removido
ls -la /home/ubuntu/openclaude.backup.*
```

---

## 🔄 Redeploy (Iterações Futuras)

Quando quiser fazer update:

```bash
# 1. Editar código localmente
# 2. Testar localmente (npm run worker)
# 3. Deploy staging
npm run deploy-worker:staging

# 4. Testar staging
npm run test-vps  # validar SSH
curl http://localhost:3000/health

# 5. Deploy production
npm run deploy-worker:prod

# 6. Verificar
pm2 logs jarvis-worker
```

**Tempo total**: ~2 minutos (staging) + 30s (prod) = 2.5 min por iteração

---

## 🆘 Rollback (Se der ruim)

```bash
ssh ubuntu@82.29.58.126

# Ver backups
ls -la openclaude.backup.*

# Restaurar
rm -rf openclaude
mv openclaude.backup.1716345678901 openclaude

# Reiniciar
pm2 restart jarvis-worker
pm2 logs jarvis-worker
```

---

## 📝 Notas Extras

Use este espaço pra anotar:

```
[Espaço para anotações]
────────────────────────────────────────────────────
Timestamp: ___________
Evento: ___________________________________________
Observação: ________________________________________
─────────────────────────────────────────────────────
```

---

## ✨ Dicas

- **Logs ao vivo**: `pm2 logs jarvis-worker --lines 100` (últimas 100 linhas)
- **Clear logs**: `pm2 logs --clear` (limpa histórico)
- **Recursos**: `pm2 monit` (CPU/RAM em tempo real)
- **Reiniciar**: `pm2 restart jarvis-worker`
- **Stop**: `pm2 stop jarvis-worker`
- **Start**: `pm2 start "bun run worker" --name jarvis-worker --cwd /home/ubuntu/openclaude`

---

**Boa sorte! 🚀**

Quando completar tudo, marca aí e fica verde ✅
