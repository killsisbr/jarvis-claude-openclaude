# 🔍 VPS Status Check — Validação Pré-Deploy

Script para analisar saúde da VPS antes de fazer deploy do JARVIS Worker.

---

## 1️⃣ Usar o Script

```bash
npm run test-vps
```

Ou direto:
```bash
node tools/test-vps-status.cjs
```

---

## 2️⃣ O Que o Script Valida

```
✅ Conectividade SSH
✅ Informações do usuário
✅ Espaço em disco (5GB+ recomendado)
✅ Recursos disponíveis (CPU/RAM)
✅ Status PM2 (todos processos)
✅ PM2 saas-web (DeliveryHub atual)
✅ Logs PM2
✅ Diretórios de deploy
✅ Ferramentas instaladas (Node, Npm, Bun, Git)
✅ Configuração SSH keys
✅ Permissões sudoers
✅ Portas abertas
✅ Info SAAS-WEB
✅ Uptime do sistema
```

---

## 3️⃣ Output Esperado

```
╔════════════════════════════════════════════════════════════╗
║         JARVIS Worker — VPS Status Check                   ║
╚════════════════════════════════════════════════════════════╝

🔌 Conectando a 82.29.58.126:22 as ubuntu...

✅ Conectado com sucesso!

🔍 Verificação de Conectividade
────────────────────────────────────────────────────────────
✓ SSH conectado
Tue May 22 14:30:15 UTC 2026

👤 Informações do Usuário
────────────────────────────────────────────────────────────
ubuntu
uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu),4(adm),27(sudo)
Home: /home/ubuntu

💾 Espaço em Disco
────────────────────────────────────────────────────────────
/dev/sda1     100G   45G   50G  48% /
/dev/sda2     500G  250G  200G  55% /home

⚙️ Recursos Disponíveis (CPU/RAM)
────────────────────────────────────────────────────────────
CPU Cores: 4
RAM Total:
              total        used        free      shared  buff/cache   available
Mem:          7.8Gi       2.1Gi       3.5Gi      100Mi       2.2Gi       5.2Gi

🔄 PM2 Status (Todos os processos)
────────────────────────────────────────────────────────────
┌──────────┬────┬─────────┬──────────┬───────┬──────────┬─────────┐
│ App name │ id │ mode    │ pid      │ stat  │ uptime   │ memory  │
├──────────┼────┼─────────┼──────────┼───────┼──────────┼─────────┤
│ saas-web │ 0  │ fork    │ 45678    │ online│ 12d 5h   │ 412.3 M │
└──────────┴────┴─────────┴──────────┴───────┴──────────┴─────────┘

... [resto dos checks] ...

╔════════════════════════════════════════════════════════════╗
║         ✅ Análise Completa                                 ║
╚════════════════════════════════════════════════════════════╝

📋 Próximos Passos:
   1. Verificar se bun está instalado (necessário para deploy)
   2. Confirmar espaço em disco em /home/ubuntu (5GB+)
   3. Se não existe /home/ubuntu/openclaude, será criado no deploy
   4. Rodar: npm run deploy-worker:staging
```

---

## 4️⃣ Interpretando Resultados

### **✅ Tudo Verde (pronto pra deploy)**

```
✓ SSH conectado
✓ User: ubuntu (não root, bom)
✓ RAM: 5GB+ livre (ótimo)
✓ Disk: 50GB+ livre (excelente)
✓ Bun: instalado
✓ PM2: rodando
✓ Sudoers: NOPASSWD (não pede senha)
```

**Ação**: Rodar `npm run deploy-worker:staging`

---

### **⚠️ Avisos (investigar)**

| Aviso | Significa | Ação |
|-------|-----------|------|
| `Bun: não instalado` | Precisa compilar na VPS | Instalar: `curl -fsSL https://bun.sh/install \| bash` |
| `RAM: <1GB livre` | Pode ficar apertado | Cleanup: `pm2 delete old-apps` ou esperar |
| `Disk: <10GB livre` | Risco de ficar sem espaço | Limpar logs: `pm2 logs --clear` |
| `PM2: command not found` | PM2 não global | Instalar: `npm install -g pm2` |
| `Sudoers: requer senha` | PM2 vai pedir prompt | Configurar: `sudo visudo` (add NOPASSWD) |

---

### **❌ Bloqueadores (não fazer deploy)**

| Erro | Causa | Solução |
|------|-------|---------|
| `Conectado: Timeout` | SSH não responde | Verificar IP/porta em `.env.vps` |
| `Conectado: Authentication failed` | Senha errada | Testar: `ssh ubuntu@82.29.58.126` |
| `RAM: <512MB livre` | Sem memória | Parar outros apps ou fazer upgrade VPS |
| `Disk: <2GB livre` | Sem espaço | Deletar backups antigos |
| `Node: não instalado` | Runtime faltando | Instalar Node 22+: `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo bash && sudo apt install nodejs` |

---

## 5️⃣ Checklist de Deploy

- [ ] `npm run test-vps` passa
- [ ] `✓ SSH conectado`
- [ ] `✓ Bun instalado` (ou Node 22+)
- [ ] `✓ RAM > 1GB livre`
- [ ] `✓ Disk > 10GB livre` em `/home/ubuntu`
- [ ] `✓ PM2 rodando`
- [ ] `.env.vps` preenchido corretamente
- [ ] Pronto: `npm run deploy-worker:staging`

---

## 6️⃣ Próximos Passos

### **Se tudo OK:**
```bash
npm run deploy-worker:staging
```

### **Se tem aviso de Bun:**
```bash
ssh ubuntu@82.29.58.126
curl -fsSL https://bun.sh/install | bash
exit
npm run test-vps  # rodar novamente
```

### **Se RAM/Disk baixo:**
```bash
ssh ubuntu@82.29.58.126
pm2 logs --clear
pm2 logs --lines 0  # limpar histórico
df -h  # verificar
```

---

## 7️⃣ Troubleshooting

### **Timeout na conexão**

```bash
# 1. Testar SSH manualmente
ssh -v ubuntu@82.29.58.126

# 2. Verificar firewall
ping 82.29.58.126

# 3. Verificar .env.vps
cat .env.vps
```

### **Falha de autenticação**

```bash
# 1. Testar senha
ssh ubuntu@82.29.58.126
# Digite a senha

# 2. Se não funcionar, usar SSH key (mais seguro)
ssh-keygen -t ed25519 -f ~/.ssh/jarvis-vps -N ""
ssh-copy-id -i ~/.ssh/jarvis-vps ubuntu@82.29.58.126
```

### **PM2 não encontrado**

```bash
ssh ubuntu@82.29.58.126
npm install -g pm2
exit
npm run test-vps  # testar novamente
```

---

## 8️⃣ Script Rápido: Validar Apenas Essenciais

Se quer um teste mais rápido (apenas o necessário):

```bash
# Conectar e validar
ssh ubuntu@82.29.58.126 << 'EOF'
echo "=== Conectividade ==="
ping -c 1 8.8.8.8 > /dev/null && echo "✓ Internet OK" || echo "✗ Sem internet"

echo "=== Bun ==="
bun --version || echo "✗ Bun não instalado"

echo "=== PM2 ==="
pm2 --version || echo "✗ PM2 não instalado"

echo "=== Espaço ==="
df -h /home/ubuntu | tail -1

echo "=== RAM ==="
free -h | grep "^Mem"
EOF
```

---

## 9️⃣ Referência Rápida

```bash
# Testar VPS
npm run test-vps

# Deploy staging
npm run deploy-worker:staging

# Deploy production
npm run deploy-worker:prod

# Ver logs em tempo real
pm2 logs jarvis-worker

# Conectar SSH
ssh ubuntu@82.29.58.126

# Reiniciar manualmente
ssh ubuntu@82.29.58.126 "pm2 restart jarvis-worker"

# Ver PM2 status
ssh ubuntu@82.29.58.126 "pm2 list"
```

---

**Pronto? Execute:**

```bash
npm run test-vps
```

**Output vai te dizer exatamente o que falta, se houver.**
