# JARVIS Remote Worker Guide

## Overview

The Remote Worker system allows multiple CLI clients to connect to a single JARVIS Worker instance running on a VPS or remote server. This enables:

- **Shared Infrastructure**: One worker instance serving multiple users
- **API Key Authentication**: Secure access control per user
- **Transparent Integration**: Works seamlessly with existing JARVIS CLI
- **Cost Optimization**: Shared resource pools reduce per-user overhead

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     JARVIS Worker (VPS)                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Express.js Server + Bun Runtime                      │    │
│  │ ┌──────────────────────────────────────────────┐    │    │
│  │ │ Auth Middleware (API Key Validation)        │    │    │
│  │ ├──────────────────────────────────────────────┤    │    │
│  │ │ POST /api/chat (requires Bearer token)       │    │    │
│  │ ├──────────────────────────────────────────────┤    │    │
│  │ │ SQLite Database                              │    │    │
│  │ │ - api_users (credentials)                    │    │    │
│  │ │ - sessions (conversation state)              │    │    │
│  │ │ - messages (chat history)                    │    │    │
│  │ └──────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
         ↑                    ↑                   ↑
         │                    │                   │
      HTTP POST             HTTP POST           HTTP POST
    Bearer: sk-xxx        Bearer: sk-yyy      Bearer: sk-zzz
         │                    │                   │
    ┌────────────┐      ┌──────────────┐    ┌──────────────┐
    │ CLI User 1 │      │ CLI User 2   │    │ CLI User 3   │
    │ local-cli  │      │ remote-cli   │    │ remote-cli   │
    └────────────┘      └──────────────┘    └──────────────┘
```

## Server Setup

### 1. Start the JARVIS Worker

```bash
cd D:\jarvis-claude\openclaude

# Start worker (will create SQLite DB + API users table)
bun src/worker/server.ts
```

Expected output:
```
[schema] ✓ Database schema initialized
🚀 JARVIS Worker running on http://localhost:3000
```

### 2. Create API User

Option A: **Via remote-cli.ts with --config**

```bash
bun remote-cli.ts --config
# Prompts:
# 🔗 URL do Worker: http://localhost:3000 (or your VPS IP:port)
# 🔑 API Key (opcional): [leave blank for now]
```

Option B: **Create API key programmatically (from Node/Bun)**

```typescript
import { generateApiKey } from './src/worker/middleware/auth'

const apiKey = generateApiKey('myusername', false)
console.log('API Key:', apiKey)  // sk-myusername-1716129600000-a1b2c3d4...
```

Option C: **Direct database access**

```bash
sqlite3 ~/.jarvis/worker.db
INSERT INTO api_users (id, username, api_key, is_admin, created_at, is_active)
VALUES ('user-1', 'myuser', 'sk-myuser-123456-xyz', 0, 1716129600000, 1);
```

## Client Setup

### 1. Configure Remote Worker

**First time:**
```bash
bun remote-cli.ts --config
# 🔗 URL do Worker (ex: http://localhost:3000): http://your-vps-ip:3000
# 🔑 API Key (opcional): sk-myuser-123456-xyz
```

Configuration saved to: `~/.jarvis/remote-worker-config.json`

```json
{
  "workerUrl": "http://your-vps-ip:3000",
  "apiKey": "sk-myuser-123456-xyz"
}
```

### 2. Send Messages

```bash
# Using saved config
bun remote-cli.ts "gera um formulário de login bonito"

# Ad-hoc connection (without saving)
bun remote-cli.ts --url http://vps.com:3000 --key sk-xxx "sua mensagem"

# Test connection first
bun remote-cli.ts "ping"
```

### 3. Response Format

```
🔗 Conectando a: http://your-vps-ip:3000

📝 Resposta do Worker:
────────────────────────────────────────────────────────────
[AI response here]
────────────────────────────────────────────────────────────

📊 Stats:
  Model: claude-opus
  Tokens: 150 input + 320 output
  Custo: $0.005632
  Latência: 1250ms
```

## Authentication

### API Key Format

```
sk-{username}-{timestamp}-{random-hex}

Example: sk-lucas-1716129600000-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### Validation Flow

1. **Client** → Sends request with `Authorization: Bearer sk-xxx`
2. **Auth Middleware** → Validates key against `api_users` table
3. **Attach Metadata** → Sets `req.userId`, `req.username`, `req.isAdmin`
4. **Proceed** → Routes to `/api/chat` handler

### Manage Users (Admin)

List all API users:
```typescript
import { listApiUsers } from './src/worker/middleware/auth'
const users = listApiUsers()
console.log(users)
```

Revoke a key:
```typescript
import { revokeApiKey } from './src/worker/middleware/auth'
const revoked = revokeApiKey('sk-username-timestamp-hex')
```

## Integration with Main CLI

To use remote worker from the main JARVIS CLI:

```typescript
// src/index.ts or main entry
import { callRemoteWorker } from './services/remote-worker'

const remoteConfig = {
  url: 'http://your-vps-ip:3000',
  apiKey: 'sk-your-key'
}

const response = await callRemoteWorker(remoteConfig, userId, userMessage)
console.log(response.reply)  // AI response
console.log(response.cost)   // Cost tracking
console.log(response.tokens) // Token usage
```

## Testing

Run test suites:

```bash
# Auth middleware tests
bun test src/worker/middleware/auth.test.ts

# Remote worker service tests
bun test src/services/remote-worker.test.ts

# All tests
bun test
```

## Troubleshooting

### "Missing Authorization header"
**Problem**: Request missing API key  
**Solution**: Use `--key sk-xxx` or configure with `--config`

```bash
bun remote-cli.ts --url http://localhost:3000 --key sk-your-key "message"
```

### "Invalid or inactive API key"
**Problem**: Key not found or disabled  
**Solution**: Verify key is active in database

```bash
sqlite3 ~/.jarvis/worker.db
SELECT * FROM api_users WHERE api_key LIKE 'sk-your-prefix%';
```

### "Connection refused"
**Problem**: Worker not running or wrong URL  
**Solution**: Verify worker is accessible

```bash
curl -i http://your-vps-ip:3000/health

# From client machine
bun remote-cli.ts --url http://your-vps-ip:3000 "ping"
```

### "ECONNREFUSED on VPS"
**Problem**: Server listening on localhost, not accessible from outside  
**Solution**: Modify server to bind to 0.0.0.0

In `src/worker/server.ts`:
```typescript
app.listen(3000, '0.0.0.0', () => {
  console.log('🚀 JARVIS Worker running on http://0.0.0.0:3000')
})
```

Then connect via: `http://your-vps-public-ip:3000`

## Deployment Checklist

- [ ] Server started: `bun src/worker/server.ts`
- [ ] Database initialized: `~/.jarvis/worker.db` exists
- [ ] API user created: Check with `sqlite3 ~/.jarvis/worker.db`
- [ ] API key distributed to clients securely
- [ ] Firewall allows port 3000 (or your custom port)
- [ ] Test with: `bun remote-cli.ts --url http://localhost:3000 "test"`
- [ ] Monitor logs for errors
- [ ] Rotate API keys periodically

## Security Notes

1. **NEVER commit API keys** to git
2. **Use environment variables** for production keys
3. **Enable HTTPS** for VPS (add reverse proxy like Nginx)
4. **Rotate keys regularly** using `revokeApiKey()`
5. **Monitor last_used_at** in api_users table
6. **Implement rate limiting** if needed (can extend auth middleware)

## Performance Tips

- **Keep worker running** (systemd service or PM2)
- **Monitor database size** (~1MB per 1000 sessions)
- **Archive old messages** periodically
- **Use smart routing** to distribute load across models
- **Cache contexts** to reduce API calls (Smart Cache feature)

## Next Steps

- Integrate **Proactive Learning** to improve responses
- Implement **Smart Cache** for 30-50% cost reduction
- Deploy **Auto-Evolve** skill for automatic optimization
