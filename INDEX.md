# JARVIS v5.0.0 — Index de Projeto

**Versão**: v5.0.0  
**Status**: Phase 1-3 Integration Complete ✅  
**Data**: 2026-05-26

---

## 📍 Localização de Recursos

### 📖 Documentação Organizada
👉 **[docs/README.md](docs/README.md)** — Índice detalhado por tópico

### 🔧 Executáveis Principais
```
bin/
├── claude.bat              # Claude Code CLI
├── jarvis.bat              # JARVIS com provider default
├── worker.bat              # Worker standalone
├── haiku.bat               # JARVIS com Haiku
├── jarvis-rotate.bat       # Multi-provider rotation
├── jarvis-deepseek.bat     # DeepSeek provider
├── jarvis-kimi.bat         # Kimi + KimiProxy
├── jarvis-proactive.bat    # Proactive mode
└── jarvis-zen.bat          # Zen mode (minimal)
```

### 🛠️ Scripts Auxiliares
```
tools/
├── start-*.bat             # Start services
├── bench-llm.*             # Benchmark LLMs
├── install*.bat            # Installation helpers
├── test-*.bat              # Test runners
├── check_pm2_full.cjs      # PM2 diagnostics
└── set-jarvis-personality.bat  # Personality config
```

---

## 🎯 Começar Rapidamente

### 1️⃣ Novo no JARVIS?
Leia [docs/guides/COMECE_AQUI.md](docs/guides/COMECE_AQUI.md) (2 minutos)

### 2️⃣ Setup Completo?
```bash
npm install
bun run build
bin/jarvis.bat
```

### 3️⃣ Qual Documentação Procuro?

| Preciso de... | Leia... |
|---|---|
| Overview do projeto | [README.md](README.md) |
| Setup rápido | [docs/guides/COMECE_AQUI.md](docs/guides/COMECE_AQUI.md) |
| Entender a arquitetura | [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) |
| Usar a API HTTP | [docs/api/API_REFERENCE.md](docs/api/API_REFERENCE.md) |
| Deploy em VPS | [docs/deployment/](docs/deployment/) |
| Troubleshooting | [docs/integration/PLAYBOOK.md](docs/integration/PLAYBOOK.md) |
| Estender JARVIS | [docs/architecture/DEVELOPER_GUIDE.md](docs/architecture/DEVELOPER_GUIDE.md) |
| Master plan | [docs/integration/JARVIS-V5-MASTER-PLAN.md](docs/integration/JARVIS-V5-MASTER-PLAN.md) |

---

## 📋 Estrutura de Diretórios

```
jarvis-claude-openclaude/
├── docs/                   # Documentação organizada
│   ├── guides/            # Guias operacionais
│   ├── api/               # Referência de API
│   ├── architecture/      # Design e padrões
│   ├── technical/         # Análises técnicas
│   ├── integration/       # Planos e roadmap
│   └── deployment/        # Guias de deploy
│
├── bin/                    # Scripts executáveis principais
├── tools/                  # Scripts auxiliares
│
├── src/                    # Código fonte
│   ├── cli/              # CLI (ReAct, tool executor)
│   ├── worker/           # Worker (sessions, exec, planning)
│   ├── utils/            # Utilities (JSON, model discovery)
│   ├── services/         # Serviços compartilhados
│   └── integrations/     # Integrações (Anthropic, OpenAI, etc)
│
├── tests/                  # Testes (105 tests, 100% pass)
├── dist/                   # Build output (cli.mjs, ~21MB)
│
├── package.json            # Node.js dependencies
├── tsconfig.json           # TypeScript config
├── CLAUDE.md               # Instruções do projeto
├── README.md               # Overview principal
├── CHANGELOG.md            # Histórico de releases
└── LICENSE                 # MIT License
```

---

## ✅ Checklist por Rol

### 👨‍💻 Para Desenvolvedores
- [ ] [README.md](README.md) — Overview
- [ ] [CLAUDE.md](CLAUDE.md) — Project conventions
- [ ] [docs/architecture/DEVELOPER_GUIDE.md](docs/architecture/DEVELOPER_GUIDE.md)
- [ ] [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)
- [ ] [docs/api/API_REFERENCE.md](docs/api/API_REFERENCE.md)

### 🔧 Para Operadores/DevOps
- [ ] [docs/guides/COMECE_AQUI.md](docs/guides/COMECE_AQUI.md)
- [ ] [docs/integration/PLAYBOOK.md](docs/integration/PLAYBOOK.md)
- [ ] [docs/guides/DEPLOY-CHECKLIST.md](docs/guides/DEPLOY-CHECKLIST.md)
- [ ] [docs/deployment/DOCKER-DEPLOY.md](docs/deployment/DOCKER-DEPLOY.md)

### 🎯 Para Arquitetos/Product
- [ ] [docs/integration/JARVIS-V5-MASTER-PLAN.md](docs/integration/JARVIS-V5-MASTER-PLAN.md)
- [ ] [docs/integration/INTEGRATION-PLAN.md](docs/integration/INTEGRATION-PLAN.md)
- [ ] [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md)

---

## 🚀 Próximos Passos

1. **Leia [COMECE_AQUI](docs/guides/COMECE_AQUI.md)**
2. **Execute `bin/jarvis.bat`**
3. **Teste endpoints em [docs/api/API_REFERENCE.md](docs/api/API_REFERENCE.md)**
4. **Estude [docs/architecture/](docs/architecture/) para arquitetura**

---

**Versão**: JARVIS v5.0.0  
**Última atualização**: 2026-05-26  
**Mantido por**: Killsis (killsis@jarvis.local)
