# Auto-Store Skill — Criar Loja a Partir de Foto

## 🎯 O que faz

Recebe uma foto de cardápio e automaticamente:
1. **Extrai** informações com Claude Vision
2. **Cria** a loja no SAAS-WEB staging
3. **Popula** produtos, categorias, preços
4. **Retorna** link pronto pra usar

## 📸 Exemplo de Uso

### Via Worker CLI/API

```bash
# Teste local
curl -X POST http://localhost:3000/api/skills/auto-store \
  -H "Content-Type: application/json" \
  -d '{
    "imagePath": "/path/to/cardapio.jpg",
    "email": "cliente@example.com"
  }'
```

### Via WhatsApp (quando integrado com dispatcher)

```
Usuário: Crie uma loja com esse cardápio
[Envia foto]

Worker:
✅ Loja criada com sucesso!

📝 Nome: Brutus Burger
🛍️ Produtos: 24
📂 Categorias: 5
⭐ Qualidade: 95/100

🔗 Acesse sua loja: http://localhost:3001/loja/brutus-burger

💡 Dicas:
✅ Cardápio bem estruturado!
```

## 🔧 Configuração

### Variáveis de Ambiente

```env
# SAAS-WEB (staging)
SAAS_WEB_URL=http://localhost:3001
SAAS_WEB_TOKEN=seu-token-jwt-aqui

# Email de destino para lojas criadas
AUTO_STORE_EMAIL=loja@killsis.com

# Claude API
ANTHROPIC_API_KEY=sk-ant-...
```

### Em código

```typescript
import { MenuVisionService } from './services/menu-vision-service'
import { AutoStoreCreator } from './services/auto-store-creator'

// 1. Extrair menu
const vision = new MenuVisionService()
const menu = await vision.extractMenuFromImage('/path/to/image.jpg')

// 2. Analisar qualidade
const quality = await vision.analyzeMenuQuality(menu)
console.log('Score:', quality.score)
console.log('Sugestões:', quality.suggestions)

// 3. Criar loja
const creator = new AutoStoreCreator('http://staging:3001')
const result = await creator.createStore(menu, 'cliente@example.com')

if (result.success) {
  console.log('Loja criada:', result.url)
}
```

## 📊 Fluxo Completo

```
Foto de Cardápio
      ↓
[Claude Vision]
      ↓
Dados Estruturados:
├─ Nome do restaurante
├─ Categorias
├─ Produtos
├─ Preços
└─ Descrições
      ↓
[Auto-Store Skill]
      ↓
Cria no SAAS-WEB:
├─ Tenant (restaurante)
├─ Categorias
├─ Produtos com preços
└─ Configurações básicas
      ↓
URL da Loja
```

## ✅ Requisitos

- [x] Claude Vision (Anthropic SDK)
- [x] SAAS-WEB rodando (staging ou produção)
- [x] Acesso à API do SAAS-WEB
- [x] Foto clara do cardápio

## 🚀 Próximos Passos

- [ ] Integrar com WhatsApp Baileys
- [ ] Suporte a múltiplas imagens (cardápio em várias fotos)
- [ ] Detectar promoções automáticamente
- [ ] Sugerir horário de funcionamento
- [ ] Enviar convite por email ao criar loja

## 🐛 Troubleshooting

### "Arquivo de imagem não encontrado"
- Verifique se o caminho está correto
- Suporte: JPEG, PNG, GIF, WebP

### "Não conseguiu conectar ao SAAS-WEB"
- Verifique se SAAS-WEB está rodando
- Verifique `SAAS_WEB_URL` nas variáveis de ambiente
- Teste: `curl http://localhost:3001/health`

### "Claude não extraiu o menu corretamente"
- Foto muito escura ou desfocada?
- Tente com melhor iluminação
- Considere enviar múltiplas fotos

## 📝 Notas

- Quanto melhor a foto, melhor a extração
- Preços são detectados automaticamente (formato: números)
- Nomes e descrições são preservados fielmente
- Score de qualidade ajuda a identificar gaps
