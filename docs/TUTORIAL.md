# Tutorial OpenClaude - Guia Completo

Este tutorial fornece instruções passo a passo para configurar e usar o OpenClaude com as chaves de API do Zen e DeepSeek, baseado no sistema avançado do JARVIS-001.

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter:

- Node.js >= 18.0 instalado
- Git instalado
- Contas ativas em:
  - [Zen API](https://opencode.ai/zen) (para acesso às chaves sk-*)
  - [DeepSeek](https://deepseek.com/) (para acesso à chave sk-48007c594a094cd4b788ef68f772b43f)
  - NVIDIA API (já configurada no seu .env)

## 🚀 Etapa 1: Verificando sua Configuração .env

Seu arquivo `.env` já foi atualizado com as configurações do JARVIS-001:

```env
# =============================================================================
# OpenClaude - NVIDIA NIM Configuration
# =============================================================================

CLAUDE_CODE_USE_OPENAI=1
NVIDIA_API_KEY=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
OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1
OPENAI_MODEL=nvidia/nemotron-3-super-120b-a12b

# Zen API Key Rotation System (from JARVIS-001)
ZEN_API_KEY_1=sk-P7UydAXvJVGxh1pEZwcY3tuOWbMoK3hohD9nrJei2lQnkOz7Deob7f0Yzf7jbXRz
ZEN_API_KEY_2=sk-a7dQnpwEMR8q8DSPEAT0H5QKtGgRWokF4jBdtgf2OMam4LcU99B6ehXZN8qStQCN
ZEN_API_KEY_4=sk-Uuf9Z5cLw6KTh941LEURwsiMNnSwNr39W4rn14V1vlaPDVsV6pmgbh66EwSCMrti
ZEN_API_KEY_5=sk-bfS9zjmLEXyHQQNtS2gRwiMfkFQ4ovnJd2Dme82bd4XEHTFjb3Es41papjTbsvdS
ZEN_KEY_ROTATION=round-robin
ZEN_KEY_COOLDOWN_MS=60000
ZEN_MODEL=big-pickle
ZEN_BASE_URL=https://opencode.ai/zen/v1

# DeepSeek Configuration (from JARVIS-001)
DEEPSEEK_API_KEY=sk-48007c594a094cd4b788ef68f772b43f
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

## 🔧 Etapa 2: Testando as Configurações

### Opção A: Teste Rápido com NVIDIA (padrão)
```bash
# Inicia o JARVIS com configuração NVIDIA padrão
jarvis.bat
```

### Opção B: Teste com Zen API (usando rotação de chaves)
```bash
# Inicia o JARVIS forçando uso da Zen API com rotação automática
jarvis-zen.bat
```

### Opção C: Teste com DeepSeek API
```bash
# Inicia o JARVIS forçando uso da DeepSeek API
jarvis-deepseek.bat
```

## 📊 Etapa 3: Entendendo o Sistema de Rotação de Chaves Zen

O sistema implementado do JARVIS-001 oferece:

### 🔄 Rotação Round-Robin
- Distribui requisições igualmente entre todas as chaves disponíveis
- Com 4 chaves configuradas, cada uma recebe ~25% do tráfego
- Evita que qualquer chave individual atinja limites de taxa

### ⚙️ Failover Automático
- Quando uma chave retorna erro 429 (rate limit):
  1. A chave entra em cooldown por 60 segundos (ZEN_KEY_COOLDOWN_MS)
  2. O sistema automaticamente pula para a próxima chave disponível
  3. Após o cooldown, a chave retorna ao pool de rotação

### 📈 Monitoramento e Estatísticas
O sistema rastreia:
- Número de requisições por chave
- Taxa de sucesso/erro
- Contagem de erros 429
- Uso estimado de tokens
- Distribuição por tipo de agente

## 🎯 Etapa 4: Usando o OpenClaude em Diferentes Cenários

### Cenário 1: Desenvolvimento Geral (Recomendado)
Use `jarvis-zen.bat` para aproveitar:
- Melhor distribuição de carga
- Resiliência contra rate limits
- Acesso ao modelo `big-pickle` da Zen API

### Cenário 2: Tarefas de Código Especializado
Use `jarvis-deepseek.bat` quando precisar:
- Capacidades avançadas de raciocínio do DeepSeek
- Especialização em certas linguagens de programação
- Comparação de respostas entre diferentes modelos

### Cenário 3: Máxima Performance
Use `jarvis.bat` (padrão NVIDIA) quando:
- Precisar da menor latência possível
- Trabalhar com modelos específicos da NVIDIA
- Querer usar o modelo nemotron-3-super-120b-a12b

## 🛠️ Etapa 5: Personalizando sua Experiência

### Adicionando Mais Chaves Zen
Para aumentar sua capacidade, você pode adicionar mais chaves seguindo o padrão:
```env
ZEN_API_KEY_6=sua_chave_aqui
ZEN_API_KEY_7=outra_chave_aqui
# ... e assim por diante até ZEN_API_KEY_20
```

### Ajustando Parâmetros de Rotação
Modifique estas variáveis no seu .env conforme necessário:
```env
# Alterar estratégia (round-robin | failover)
ZEN_KEY_ROTATION=round-robin

# Ajustar tempo de cooldown em milissegundos
ZEN_KEY_COOLDOWN_MS=60000

# Alterar modelo Zen
ZEN_MODEL=big-pickle
```

### Configurando DeepSeek
Para usar diferentes modelos DeepSeek:
```env
DEEPSEEK_MODEL=deepseek-chat  # ou deepseek-coder, etc.
```

## 🔍 Etapa 6: Verificando o Funcionamento

### Logs de Debugging
Ative logs detalhados para monitorar a rotação de chaves:
```bash
# Defina variáveis de ambiente para logging
set DEBUG=zen-key-rotator:*
jarvis-zen.bat
```

### Testando a Rotação
Você pode verificar quais chaves estão sendo usadas observando:
1. Os logs do console quando o DEBUG está ativado
2. Os contadores de requisições que aumentam igualmente entre as chaves
3. A distribuição equilibrada de carga após várias requisições

## 📚 Recursos Adicionais

### Documentação de Referência
- [Arquitetura do OpenClaude](./architecture/integrations.md)
- [Guia de Integração de Provedores](./integrations/how-to/add-vendor.md)
- [Configuração Avançada](./advanced-setup.md)
- [Guia de Configuração LiteLLM](./litellm-setup.md)

### Tutoriais Relacionados
- [Guia de Início Rápido Windows](./quick-start-windows.md)
- [Guia de Início Rápido Mac/Linux](./quick-start-mac-linux.md)
- [Configuração de Hooks Personalizados](./hook-chains.md)
- [Guia de Orquestração LLM](./docs/LLM-Orchestration-Guide.md)

## 💡 Dicas de Produtividade

1. **Monitore seu uso**: Observe os logs para garantir que o tráfego esteja distribuído entre suas chaves Zen
2. **Reserve chaves para tarefas críticas**: Considere dedicar chaves específicas para operações de alta prioridade
3. **Teste diferentes modelos**: Experimente alternar entre Zen, DeepSeek e NVIDIA para ver qual fornece melhores resultados para seus casos de uso específicos
4. **Mantenha chaves de backup**: Sempre tenha pelo menos uma chave extra configurada para evitar interrupções de serviço

## ❓ Solução de Problemas Comuns

### Problema: "API key not found" ou "Invalid API key"
**Solução**: Verifique se:
- As chaves no .env estão corretamente copiadas (sem espaços extras)
- Não há caracteres invisíveis ou quebras de linha acidentais
- As chaves estão ativas em seus respectivos painéis de desenvolvedor

### Problema: Taxa de erro alta (429s)
**Solução**: O sistema de rotação deve lidar automaticamente com isso através do failover. Se persistir:
1. Verifique se todas as chaves ZEN_API_KEY_* têm valores válidos
2. Considere adicionar mais chaves ao pool
3. Aumente o ZEN_KEY_COOLDOWN_MS se estiver atingindo limites frequentemente

### Problema: Não consegue alternar entre provedores
**Solução**: Verifique se:
- Os arquivos batch (.bat) estão no diretório correto
- As variáveis de ambiente estão sendo definidas corretamente
- Não há conflitos com variáveis de ambiente do sistema

## 🏁 Conclusão

Você agora tem um sistema robusto de múltiplas APIs inspirado no JARVIS-001, com:
- ✅ Rotação automática de chaves Zen (4 chaves configuradas)
- ✅ Failover inteligente para evitar rate limits
- ✅ Integração com DeepSeek para capacidades especializadas
- ✅ Mantém sua configuração NVIDIA existente como fallback
- ✅ Scripts de inicialização prontos para uso (`jarvis-zen.bat`, `jarvis-deepseek.bat`)
- ✅ Documentação completa para referência futura

Experimente os diferentes scripts de inicialização para descobrir qual provedor funciona melhor para cada tipo de tarefa em seu fluxo de trabalho!

---
*Tutorial baseado nas melhores práticas do JARVIS-001 e adaptado para OpenClaude*
*Última atualização: $(date)*