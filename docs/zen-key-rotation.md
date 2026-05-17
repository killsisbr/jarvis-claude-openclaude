# Sistema de Rotação de Chaves Zen API - OpenClaude

Este documento explica o sistema avançado de rotação de chaves Zen API implementado no OpenClaude, baseado na arquitetura do JARVIS-001.

## 🔄 Visão Geral

O sistema de rotação de chaves Zen API distribui requisições entre múltiplas chaves de API para:
- Evitar limites de taxa (rate limits) 429
- Distribuir o uso uniformemente entre todas as chaves configuradas
- Fornecer failover automático quando uma chave falha
- Maximizar a disponibilidade do serviço

## ⚙️ Como Funciona

### Arquitetura

```
Request → zenKeyRotator.getRotatedZenKey()
            ├── Round-Robin: Key-1 → Key-2 → Key-3 → Key-4 → Key-1...
            └── Failover: Se 429 → cooldown 60s → próxima key assume
                    ↓
          openaiShim.ts → Authorization: Bearer <rotated_key>
                    ↓
          Zen API (opencode.ai/zen/v1)
```

### Estratégias Disponíveis

1. **Round-Robin (Padrão)**
   - Cada requisição usa a próxima chave do pool em sequência circular
   - Distribuição perfeitamente equilibrada quando todas as chaves estão saudáveis
   - Exemplo com 4 chaves:
     ```
     Req 1 → Key-1 (25%)
     Req 2 → Key-2 (25%)
     Req 3 → Key-3 (25%)
     Req 4 → Key-4 (25%)
     Req 5 → Key-1 (cicla)
     ```

2. **Failover**
   - Focado em manter disponibilidade acima da distribuição perfeita
   - Pula chaves problemáticas mais agressivamente
   - Útil quando algumas chaves são conhecidamente menos confiáveis

### Mecanismo de Failover Automático

Quando uma chave recebe erro HTTP 429 (rate limit):

1. **Detecção**: O sistema identifica o erro 429 na resposta da API
2. **Cooldown**: A chave problemática entra em cooldown por um período configurado (padrão: 60.000ms = 60 segundos)
3. **Pulo Automático**: O rotator avança imediatamente para a próxima chave disponível no pool
4. **Recuperação**: Após o período de cooldown, a chave retorna automaticamente ao pool de rotação

```
Key-3 → 429 → Cooldown 60s
Próxima requisição → Key-4 (Key-3 pulada)
Após 60s → Key-3 retorna ao pool
```

### Fallback Gracioso

O sistema inclui múltiplas camadas de proteção:

1. **Se todas as keys estiverem em cooldown**: Força o uso da chave com menor tempo restante de cooldown
2. **Se nenhuma ZEN_API_KEY_N estiver configurada**: Faz fallback automático para OPENAI_API_KEY normalmente
3. **Zero breaking changes**: Totalmente retrocompatível com configurações existentes

## 🛠️ Configuração

As variáveis de ambiente são configuradas no arquivo `.env`:

```env
# Zen API Key Rotation System
ZEN_API_KEY_1=sk-sua_primeira_chave_aqui
ZEN_API_KEY_2=sk-sua_segunda_chave_aqui
ZEN_API_KEY_3=sk-sua_terceira_chave_aqui
# ... até ZEN_API_KEY_20 (máximo suportado)

# Estratégia de rotação: "round-robin" (padrão) | "failover"
ZEN_KEY_ROTATION=round-robin

# Cooldown em ms após receber 429 (padrão: 60000 = 1 minuto)
ZEN_KEY_COOLDOWN_MS=60000

# Modelo Zen a ser utilizado
ZEN_MODEL=big-pickle

# URL base da Zen API
ZEN_BASE_URL=https://opencode.ai/zen/v1
```

### Exemplo de Configuração Completa

```env
# =============================================================================
# OpenClaude - Configuração de Chaves Zen API
# =============================================================================

# Pool de chaves Zen (adicione quantas precisar, até 20)
ZEN_API_KEY_1=sk-P7UydAXvJVGxh1pEZwcY3tuOWbMoK3hohD9nrJei2lQnkOz7Deob7f0Yzf7jbXRz
ZEN_API_KEY_2=sk-a7dQnpwEMR8q8DSPEAT0H5QKtGgRWokF4jBdtgf2OMam4LcU99B6ehXZN8qStQCN
ZEN_API_KEY_3=sk-exemplo_terceira_chave_aqui
ZEN_API_KEY_4=sk-Uuf9Z5cLw6KTh941LEURwsiMNnSwNr39W4rn14V1vlaPDVsV6pmgbh66EwSCMrti
ZEN_API_KEY_5=sk-bfS9zjmLEXyHQQNtS2gRwiMfkFQ4ovnJd2Dme82bd4XEHTFjb3Es41papjTbsvdS

# Configuração de rotação
ZEN_KEY_ROTATION=round-robin
ZEN_KEY_COOLDOWN_MS=60000

# Configuração do modelo
ZEN_MODEL=big-pickle
ZEN_BASE_URL=https://opencode.ai/zen/v1
```

## 📊 Monitoramento e Estatísticas

O sistema coleta métricas detalhadas para cada chave:

### Métricas por Chave
- `requestCount`: Total de requisições feitas
- `successCount`: Requisições bem-sucedidas
- `errorCount`: Total de erros
- `errors429`: Contagem específica de erros 429
- `lastUsed`: Timestamp da última utilização (epoch ms)
- `cooldownUntil`: Timestamp quando sairá do cooldown (0 = disponível)
- `estimatedTokens`: Estimativa acumulada de tokens utilizados
- `agentUsage`: Map<string, number> - contagem por tipo de agente
- `agentTokens`: Map<string, number> - tokens utilizados por tipo de agente

### Estatísticas Gerais do Sistema
A interface `KeyUsageStats` fornece:
- `totalKeys`: Número total de chaves configuradas
- `activeKeys`: Chaves atualmente disponíveis (não em cooldown)
- `cooldownKeys`: Chaves atualmente em cooldown
- `strategy`: Estratégia de rotação em uso
- `totalRequests`: Total de requisições processadas
- `totalTokens`: Total estimado de tokens utilizados
- Detalhamento por chave com todas as métricas acima

## 🧪 Testando o Sistema

### Ativando Logs de Debugging

Para monitorar o funcionamento da rotação de chaves em tempo real:

```bash
# No Windows (cmd)
set DEBUG=zen-key-rotator:*
jarvis-zen.bat

# No PowerShell
$env:DEBUG="zen-key-rotator:*"; jarvis-zen.bat

# No bash/Linux/macOS
DEBUG=zen-key-rotator:* ./jarvis-zen.sh
```

### Observando a Rotação em Ação

Quando os logs de depuração estão ativados, você verá saídas como:

```
[ZenKeyRotator] Selecionando chave: Key-1 (sk-P7U...bXRz) [round-robin]
[ZenKeyRotator] Chave Key-2 entrou em cooldown devido a 429
[ZenKeyRotator] Pulando para Key-3 (próxima disponível)
[ZenKeyRotator] Chave Key-2 saiu do cooldown e retornou ao pool
[ZenKeyRotator] Estatísticas: Key-1: 120 req, Key-2: 115 req (15 em cooldown), Key-3: 125 req, Key-4: 118 req
```

### Testando Failover Manualmente

Para testar o mecanismo de failover:
1. Esgotar intencionalmente uma chave fazendo muitas requisições rapidamente
2. Observar os logs mostrando a entrada em cooldown
3. Verificar o sistema pulando automaticamente para a próxima chave
4. Após o período de cooldown, observar o retorno da chave ao pool

## 📈 Melhores Práticas

### 1. Número Ideal de Chaves
- **Mínimo recomendado**: 3 chaves para bom balanceamento e failover
- **Ideal para uso moderado**: 4-5 chaves
- **Para uso intenso**: 8+ chaves para maximizar throughput
- **Limite do sistema**: 20 chaves (configurável no código-fonte se necessário)

### 2. Distribuição de Chaves
- Obtenha chaves de diferentes contas ou projetos quando possível
- Isso reduz o risco de todas as chaves serem afetadas por limites de conta simultâneos
- Considere usar chaves com diferentes níveis de quota se disponíveis

### 3. Monitoramento Proativo
- Verifique periodicamente as estatísticas via logs de debugging
- Configure alertas se uma chave estiver em cooldown por períodos excessivamente longos
- Rotacione chaves periodicamente (a cada 30-90 dias) como boa prática de segurança

### 4. Configuração de Cooldown
- **Padrão recomendado**: 60.000ms (1 minuto) - bom equilíbrio entre recuperação e disponibilidade
- **Para limites rígidos**: Considere 90.000-120.000ms se estiver atingindo limites frequentemente
- **Para ambientes de teste**: Pode reduzir para 10.000-30.000ms para feedback mais rápido

## 🔗 Integração com Outros Sistemas

### Compatibility com ProviderResolver
O sistema de rotação de chaves Zen trabalha perfeitamente com o `providerResolver.ts` existente:
- Quando solicitado um provedor Zen, o resolver chama `zenKeyRotator.getRotatedZenKey()`
- O rotator retorna a chave atualmente selecionada
- O resolver usa esta chave no header `Authorization: Bearer <key>`
- Todo esse processo é transparente para o código de chamada

### Integração com KeyPool
O `keyPool.ts` gerencia múltiplos provedores (NVIDIA, OpenAI, Zen, DeepSeek, etc.):
- Cada provedor tem sua própria pool ou mecanismo de seleção
- Para Zen, o keyPool delega para o zenKeyRotator
- Para outros provedores, usa estratégias de seleção padrão (round-robin, peso, etc.)

### Trabalhando com Fallbacks
Se todas as chaves Zen falharem ou estiverem indisponíveis:
1. O sistema tenta usar a chave com menor tempo de cooldown restante
2. Se ainda assim não houver chaves utilizáveis, falha para OPENAI_API_KEY
3. Isso garante que o serviço nunca fique completamente indisponível devido a problemas com as chaves Zen

## 📚 Referências

### Arquivos de Código Fonte
- `src/services/api/zenKeyRotator.ts` - Implementação principal do rotador
- `src/services/api/keyPool.ts` - Integração com o sistema geral de pools de chaves
- `src/services/api/providerResolver.ts` - Resolução de provedores e seleção de chaves
- `src/services/api/openaiShim.ts` - Camada de compatibilidade que usa as chaves rotacionadas

### Documentação Relacionada
- [Tutorial Completo](./TUTORIAL.md) - Guia passo a passo para configuração e uso
- [Arquitetura do OpenClaude](./architecture/integrations.md) - Visão geral do sistema
- [Guia de Integração de Provedores](./integrations/how-to/add-vendor.md) - Como adicionar novos provedores
- [Configuração Avançada](./advanced-setup.md) - Opções de configuração avançada

## ❓ Solução de Problemas

### Problema: Nenhuma chave sendo selecionada
**Verifique**:
- Se pelo menos uma `ZEN_API_KEY_N` está definida no .env
- Se não há espaços extras ou caracteres invisíveis nos valores das chaves
- Se as chaves estão no formato correto (começam com "sk-")

### Problema: Todas as chaves entrando em cooldown rapidamente
**Verifique**:
- Se o valor de `ZEN_KEY_COOLDOWN_MS` não está muito baixo
- Se você não está fazendo requisições em taxa excessivamente alta
- Se suas chaves têm limites de quota muito baixos (considere obter chaves com limites maiores)

### Problema: Distribuição desigual de carga
**Verifique**:
- Se está usando a estratégia "round-robin" (padrão)
- Se não há chaves permanentemente em cooldown devido a problemas persistentes
- Se está observando por período suficientemente longo para ver o equilíbrio (mínimo 20-30 requisições)

### Problema: Erros 429 persistentes apesar da rotação
**Considere**:
- Aumentar o número de chaves no pool
- Verificar se há um limite de conta agregado afetando todas as chaves
- Entrar em contato com o suporte da Zen API para entender melhor seus limites de taxa
- Implementar atrasos adicionais entre requisições em seu código de aplicação se necessário

---
*Sistema baseado na arquitetura de rotação de chaves do JARVIS-001 v2*
*Última atualização: $(date)*