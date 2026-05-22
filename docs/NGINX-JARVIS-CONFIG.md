# Nginx Configuration para jarvis.killsis.com

**Proposta de configuração** para expor JARVIS Worker via nginx reverse proxy

---

## 📋 Situação Atual

```
JARVIS Worker:     Rodando em localhost:3000 (PM2 process ID: 15)
Domínio SAAS-WEB:  killsis.com (HTTPS com Let's Encrypt)
Novo Subdomínio:   jarvis.killsis.com (proposto)
```

---

## 🔧 Proposta de Configuração Nginx

### Opção 1: Reverse Proxy Simples (Recomendado para MVP)

**Arquivo**: `/etc/nginx/sites-available/jarvis-worker`

```nginx
# JARVIS Worker — Reverse Proxy
upstream jarvis_worker {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    listen [::]:80;
    server_name jarvis.killsis.com;

    # Redirect HTTP → HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name jarvis.killsis.com;

    # SSL Certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/killsis.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/killsis.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Logging
    access_log /var/log/nginx/jarvis-access.log;
    error_log /var/log/nginx/jarvis-error.log;

    # Reverse Proxy
    location / {
        proxy_pass http://jarvis_worker;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://jarvis_worker;
        access_log off;
    }
}
```

---

### Opção 2: Con Rate Limiting (Proteção contra Abuse)

Adicionar ao bloco `server` acima:

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=health_limit:10m rate=30r/s;

location / {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://jarvis_worker;
    # ... resto da config
}

location /health {
    limit_req zone=health_limit burst=50 nodelay;
    proxy_pass http://jarvis_worker;
}
```

---

### Opção 3: Com Caching (para GET requests)

```nginx
# Cache configuration
proxy_cache_path /var/cache/nginx/jarvis levels=1:2 keys_zone=jarvis_cache:10m max_size=100m inactive=60m;

server {
    # ... SSL config acima ...

    location / {
        proxy_pass http://jarvis_worker;
        
        # Cache only GET requests
        proxy_cache jarvis_cache;
        proxy_cache_methods GET HEAD;
        proxy_cache_key "$scheme$request_method$host$request_uri";
        proxy_cache_valid 200 10m;
        proxy_cache_valid 404 1m;
        
        # Cache headers
        add_header X-Cache-Status $upstream_cache_status;
        
        # ... resto da config ...
    }
}
```

---

## 📋 Instalação Steps

### 1. Criar arquivo de configuração

```bash
sudo nano /etc/nginx/sites-available/jarvis-worker
# Copiar Opção 1 (ou outra) acima
```

### 2. Habilitar site

```bash
sudo ln -s /etc/nginx/sites-available/jarvis-worker /etc/nginx/sites-enabled/
```

### 3. Testar sintaxe

```bash
sudo nginx -t
```

Esperado:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration will be running successfully
```

### 4. Recarregar nginx

```bash
sudo systemctl reload nginx
```

### 5. Verificar

```bash
curl -I https://jarvis.killsis.com/health
# Esperado: HTTP/1.1 200 OK
```

---

## 🔒 Considerações de Segurança

| Item | Status | Notas |
|------|--------|-------|
| **HTTPS/SSL** | ✅ | Let's Encrypt (mesmo cert de killsis.com) |
| **Rate Limiting** | ✅ Opt | Protege contra abuse (Opção 2) |
| **Caching** | ✅ Opt | Reduz carga (Opção 3, apenas GET) |
| **Firewall** | ⚠️ Check | Verify port 443 open (ufw allow 443) |
| **Auth** | ❌ None | Worker não tem auth — considerar adicionar |

---

## ⚠️ Possíveis Problemas

### Problema 1: "upstream timed out"
**Causa**: JARVIS worker offline ou lento
**Fix**: `pm2 logs jarvis-worker` e verificar health

### Problema 2: "502 Bad Gateway"
**Causa**: Upstream (3000) não acessível
**Fix**: Checar se PM2 process está online: `pm2 status | grep jarvis`

### Problema 3: "SSL certificate not found"
**Causa**: Certificado em path errado
**Fix**: Confirmar paths em `/etc/letsencrypt/live/killsis.com/`

### Problema 4: Latência alta
**Causa**: Proxy buffers/timeouts pequenos demais
**Fix**: Aumentar `proxy_buffer_size` e `proxy_read_timeout`

---

## 📊 Recomendação Final

**Para MVP (agora)**:
- Use **Opção 1** (simples, sem cache)
- Adicione rate limiting depois se houver abuse

**Para Produção (futuro)**:
- Use **Opção 2** + **Opção 3** (rate limit + cache)
- Considere adicionar autenticação (API key ou JWT)
- Monitorar logs: `tail -f /var/log/nginx/jarvis-access.log`

---

## ✅ Próximas Ações

1. Escolher Opção (1, 2, ou 3)
2. Confirmar com usuário antes de aplicar
3. SSH na VPS e criar arquivo
4. Testar com `curl https://jarvis.killsis.com/health`
5. Monitorar logs 24h

---

**Pronto para aplicar?** Aguardando confirmação do Killsis.
