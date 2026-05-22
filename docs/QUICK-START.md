# ⚡ Quick Start — Deploy JARVIS Worker em 5 Minutos

**Depois de dormir, comece por aqui.**

---

## 🚀 Fluxo Rápido

```bash
# 1. Validar VPS (10s)
npm run test-vps

# Se der erro SSH: ver seção "SSH Auth Fix" abaixo

# 2. Deploy staging (2 min)
npm run deploy-worker:staging

# 3. Testar
curl http://localhost:3000/health

# 4. Deploy production (30s)
npm run deploy-worker:prod
```

---

## ⏳ Timeline

| Passo | Tempo | Comando |
|-------|-------|---------|
| 1. Validar VPS | 10s | `npm run test-vps` |
| 2. Deploy staging | 2min | `npm run deploy-worker:staging` |
| 3. Deploy production | 30s | `npm run deploy-worker:prod` |
| 4. Verificar | 5s | `ssh ubuntu@82.29.58.126 "pm2 logs jarvis-worker"` |

---

## 🔴 Se SSH Falhar

```
❌ All configured authentication methods failed
```

### **Fix 1: Tentar com root (rápido)**

Editar `.env.vps`:
```env
VPS_HOST=82.29.58.126
VPS_PORT=22
VPS_USER=root
VPS_PASSWORD=Killsis19980910#
VPS_REMOTE_DIR=/root/killsis/SAAS-WEB
```

Rodar:
```bash
npm run test-vps
```

Se funcionar → VPS tá OK, problema é user ubuntu.

### **Fix 2: Criar/resetar user ubuntu (recomendado)**

```bash
# SSH como root
ssh root@82.29.58.126

# Criar user (se não existe)
useradd -m -s /bin/bash ubuntu

# Resetar senha
passwd ubuntu
# Digite: Killsis19980910# (ou outra)

# Testar
su ubuntu
exit

exit
```

Depois rodar:
```bash
npm run test-vps
```

### **Fix 3: SSH keys (futuro, mais seguro)**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/jarvis-vps -N ""
ssh-copy-id -i ~/.ssh/jarvis-vps ubuntu@82.29.58.126
# Editar deploy-jarvis-worker.cjs depois
```

---

## ✅ Se Tudo OK

```bash
🔌 Conectando a 82.29.58.126:22 as ubuntu...
✅ Conectado com sucesso!

╔════════════════════════════════════════════════════════════╗
║         ✅ Análise Completa                                 ║
╚════════════════════════════════════════════════════════════╝
```

Próximo: `npm run deploy-worker:staging`

---

## 📊 Output Deploy (esperado)

```
╔════════════════════════════════════════════════════════════╗
║        JARVIS Worker Deploy Script                         ║
╚════════════════════════════════════════════════════════════╝

📦 Target: [STAGING]
📊 Tamanho: 12.45 MB
🔌 Conectado!
📤 Enviando ZIP...
✅ Upload concluído!
🔧 Executando deploy remoto...
   1. Criar backup
   2. Extrair ZIP
   3. bun install
   4. bun run build
   5. pm2 restart

✅ Deploy Concluído com Sucesso!
🌐 Acesse: https://worker-staging.seu-dominio.com
```

---

## 🧪 Testar Staging

```bash
# SSH
ssh ubuntu@82.29.58.126

# Ver logs
pm2 logs jarvis-worker-staging

# Health check
curl http://localhost:3000/health

# Chat test
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"user":"test","message":"Oi"}'
```

Esperado:
```json
{
  "session": "sess_...",
  "reply": "...",
  "cost": 0.05
}
```

---

## 🎯 Se Funcionar em Staging

```bash
npm run deploy-worker:prod
```

**Agora vai**:
- Deploy em `/home/ubuntu/openclaude`
- PM2: `jarvis-worker`
- Live production

---

## 📊 Monitorar Production

```bash
ssh ubuntu@82.29.58.126

# Logs live
pm2 logs jarvis-worker

# Status
pm2 status

# Recursos
pm2 monit
```

---

## 🛠️ Troubleshooting Rápido

| Erro | Fix |
|------|-----|
| `SSH fail` | Ver "SSH Auth Fix" acima |
| `bun not found` | Instalar na VPS: `curl -fsSL https://bun.sh/install \| bash` |
| `pm2 not found` | Instalar: `npm install -g pm2` |
| `Disk full` | Limpar: `pm2 logs --clear` |
| `Timeout` | VPS respondendo lento, esperar |

---

## 📚 Documentação Completa

Se precisar mais detalhes:

- `docs/SESSION-2026-05-22-SUMMARY.md` — Histórico completo
- `docs/DEPLOY-SCRIPT-VPS.md` — Deploy script detalhado
- `docs/VPS-STATUS-CHECK.md` — Interpretar status
- `docs/WORKER-TUTORIAL.md` — API endpoints

---

## ✨ Dica: Copy-Paste Commands

```bash
# Setup rápido
npm install ssh2 adm-zip dotenv
npm run test-vps
npm run deploy-worker:staging
npm run deploy-worker:prod

# SSH direto
ssh ubuntu@82.29.58.126
pm2 logs jarvis-worker
```

---

## 🎁 Status Checklist

- [ ] SSH conecta
- [ ] npm run test-vps passa
- [ ] npm run deploy-worker:staging sucesso
- [ ] curl localhost:3000/health funciona
- [ ] npm run deploy-worker:prod sucesso
- [ ] pm2 logs jarvis-worker mostra activity
- [ ] ✅ DONE!

---

**Quando acordar**: Comece pelo Quick Start acima.  
**Se travar**: Vire pra `docs/SESSION-2026-05-22-SUMMARY.md`.  
**Suporte**: Ver seção "Próximos Passos" no summary.

---

**Boa sorte! 🚀**
