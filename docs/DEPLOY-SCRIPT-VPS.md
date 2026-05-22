# 🚀 Deploy JARVIS Worker via Script VPS

Deploy seguro e rápido (30 segundos) via SSH2 + SFTP.

---

## 1️⃣ Setup Inicial (uma única vez)

### **A. Criar .env.vps**

```bash
cp .env.vps.example .env.vps
nano .env.vps
```

Adicionar suas credenciais:
```env
VPS_HOST=seu-vps-ip-aqui
VPS_PORT=22
VPS_USER=ubuntu
VPS_PASSWORD=sua-senha-aqui
```

**⚠️ IMPORTANTE**:
- `.env.vps` está em `.gitignore` (nunca será commitado)
- Proteja este arquivo (contém credenciais)
- Não compartilhe em público

### **B. Instalar dependências**

```bash
npm install ssh2 adm-zip dotenv
```

Ou com bun:
```bash
bun add ssh2 adm-zip dotenv
```

---

## 2️⃣ Como Usar

### **Deploy para Staging**

```bash
npm run deploy-worker:staging

# Ou direto
node tools/deploy-jarvis-worker.cjs staging
```

### **Deploy para Produção**

```bash
npm run deploy-worker:prod

# Ou direto
node tools/deploy-jarvis-worker.cjs production
```

### **Output esperado**

```
╔════════════════════════════════════════════════════════════╗
║        JARVIS Worker Deploy Script                         ║
╚════════════════════════════════════════════════════════════╝

📦 Target: [PRODUCTION]
📍 Remote: /home/ubuntu/openclaude
🔄 PM2: jarvis-worker
🌐 URL: https://worker.seu-dominio.com

🔍 Escaneando arquivos locais...
✅ ZIP criado com sucesso!
   📊 Tamanho: 12.45 MB

🔌 Conectando via SSH à VPS...
✅ Conectado à VPS!

📤 Enviando ZIP via SFTP...
   Origem: jarvis-worker-deploy-production-1716345678901.zip
   Destino: /tmp/jarvis-worker-deploy-production-1716345678901.zip
✅ Upload concluído!

🧹 Removendo arquivo local...
✅ Limpeza concluída!

🔧 Executando deploy remoto...
   1. Criar backup da versão anterior
   2. Extrair ZIP
   3. Instalar dependências (bun install)
   4. Build (bun run build)
   5. Reiniciar PM2

   ... [logs remotos] ...

✅ Deploy Concluído com Sucesso!

╔════════════════════════════════════════════════════════════╗
║   ✅ Deploy Concluído com Sucesso!                         ║
╚════════════════════════════════════════════════════════════╝

🌐 Acesse: https://worker.seu-dominio.com
📊 Logs: pm2 logs jarvis-worker
```

---

## 3️⃣ O Que o Script Faz

```
1. ZIP CÓDIGO
   ├─ Inclui: src/, public/, config, package.json, tsconfig.json
   ├─ Exclui: node_modules, .git, .env, .sqlite, logs, dist, backups
   └─ Resultado: ~12-20 MB (comprimido)

2. SSH2 CONNECT
   └─ Autentica com credenciais em .env.vps

3. SFTP UPLOAD
   ├─ Envia ZIP pra /tmp/ na VPS
   └─ Tempo: 5-10s (dependendo upload)

4. DEPLOY REMOTO (executa em paralelo)
   ├─ Backup versão anterior (timestamped)
   ├─ Extrai ZIP em /home/ubuntu/openclaude/
   ├─ Roda bun install --production
   ├─ Roda bun run build
   ├─ pm2 restart jarvis-worker
   └─ Mostra status + URL

5. STREAM LOGS
   └─ Todo output remoto aparece em tempo real no seu terminal
```

---

## 4️⃣ Estrutura de Paths

| Target | Staging | Production |
|--------|---------|-----------|
| **Local dir** | D:\jarvis-claude\openclaude | D:\jarvis-claude\openclaude |
| **Remote dir** | /home/ubuntu/openclaude-staging | /home/ubuntu/openclaude |
| **PM2 name** | jarvis-worker-staging | jarvis-worker |
| **URL** | worker-staging.seu-dominio.com | worker.seu-dominio.com |

**Para customizar**, edite `tools/deploy-jarvis-worker.cjs`:
```javascript
const paths = {
    staging: {
        dir: '/seu/caminho/staging',  // ← customizar aqui
        pm2: 'seu-pm2-name',
        url: 'https://seu-url'
    },
    // ... production
}
```

---

## 5️⃣ Comparação: Docker vs Script VPS

| Métrica | Docker | Script VPS |
|---------|--------|-----------|
| **Deploy time** | 5-10 min (build) | 30s (ZIP + SFTP) |
| **Isolamento** | Excelente | Depende de user |
| **Rollback** | `docker-compose down` | Backup automático |
| **Setup** | 1x na VPS | Nenhum (SSH apenas) |
| **Iterações** | Lento | Rápido |
| **Production-ready** | ✅ Recomendado | ✅ Rápido + eficiente |

**Recomendação**: Use **Script VPS** para iterações rápidas, **Docker** para isolamento máximo.

---

## 6️⃣ Segurança

### **Credenciais**

```bash
# ✅ CORRETO
cat .env.vps
VPS_PASSWORD=sua-senha-aqui

# ❌ ERRADO (nunca commit)
git add .env.vps
```

**`.env.vps` é .gitignored automaticamente.**

### **Backup automático**

Antes de cada deploy, o script cria backup:
```bash
/home/ubuntu/openclaude.backup.1716345678901/
```

Restore manual se necessário:
```bash
rm -rf /home/ubuntu/openclaude
mv /home/ubuntu/openclaude.backup.1716345678901 /home/ubuntu/openclaude
pm2 restart jarvis-worker
```

### **SSH Seguro**

Recomendado: Usar SSH keys em vez de password:

```bash
# Gerar chave (seu PC)
ssh-keygen -t ed25519 -f ~/.ssh/jarvis-vps -N ""

# Copiar pra VPS
ssh-copy-id -i ~/.ssh/jarvis-vps ubuntu@seu-vps-ip

# Editar deploy-jarvis-worker.cjs
const config = {
    host: process.env.VPS_HOST,
    port: parseInt(process.env.VPS_PORT || '22'),
    username: process.env.VPS_USER,
    privateKey: fs.readFileSync(process.env.SSH_KEY_PATH), // ← adicionar
    readyTimeout: 99999
};

# Adicionar em .env.vps
SSH_KEY_PATH=/home/seu-usuario/.ssh/jarvis-vps
```

---

## 7️⃣ Troubleshooting

| Erro | Solução |
|------|---------|
| `ECONNREFUSED` | VPS não respondendo. Verifique IP/porta em `.env.vps` |
| `Authentication failed` | Credenciais erradas. Teste: `ssh ubuntu@vps-ip` |
| `Command not found: bun` | Bun não instalado na VPS. Instale: `curl -fsSL https://bun.sh/install \| bash` |
| `pm2 not found` | PM2 não instalado. Instale: `npm install -g pm2` |
| `Permission denied` | Usuário não tem acesso. Verifique chown: `ls -la /home/ubuntu/openclaude` |
| `ZIP extraction failed` | Espaço em disco cheio. Limpe: `df -h` |

### **Debug: Conectar à VPS manualmente**

```bash
ssh ubuntu@seu-vps-ip

# Ver logs do worker
pm2 logs jarvis-worker

# Ver status
pm2 status

# Listar backups
ls -la /home/ubuntu/openclaude.backup.*

# Restaurar backup
rm -rf /home/ubuntu/openclaude
mv /home/ubuntu/openclaude.backup.1716345678901 /home/ubuntu/openclaude
pm2 restart jarvis-worker
```

---

## 8️⃣ Workflow Recomendado

### **Iteração Rápida (CRM-VENDA, Minecraft plugins)**

```bash
# 1. Editar código localmente
nano src/worker/main.ts

# 2. Testar localmente
npm run worker

# 3. Deploy pra staging
npm run deploy-worker:staging

# 4. Testar na VPS staging
curl https://worker-staging.seu-dominio.com/health

# 5. Se OK, deploy pra production
npm run deploy-worker:prod

# 6. Verificar
curl https://worker.seu-dominio.com/health
pm2 logs jarvis-worker
```

### **Automação 24/7 (futura)**

```bash
# Cron job: deploy a cada hora
0 * * * * cd /home/seu-usuario/openclaude && npm run deploy-worker:prod >> /tmp/deploy.log 2>&1

# Ou integrado com CI/CD (GitHub Actions)
# .github/workflows/deploy.yml
```

---

## 9️⃣ Próximos Passos

1. ✅ Criar `.env.vps` com suas credenciais
2. ✅ Testar: `npm run deploy-worker:staging`
3. ✅ Se OK: `npm run deploy-worker:prod`
4. 📊 Monitorar: `pm2 logs jarvis-worker`
5. 🔄 Iterar rapidamente

---

**Pronto? Execute:**

```bash
npm run deploy-worker:staging
```

**Tem dúvida?** Ver logs em tempo real durante deploy (output automático).
