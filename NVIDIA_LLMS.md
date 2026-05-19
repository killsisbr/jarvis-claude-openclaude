# LLMs Gratuitas na API da NVIDIA NIM

> Última atualização: 2026-05-18
> API Key usada: `nvapi-...` (free tier NVIDIA)
> Endpoint: `https://integrate.api.nvidia.com/v1`

Todos os modelos listados estão disponíveis via chat completions sem custo por token. O rate limit varia por modelo e momento do dia (modelos populares podem retornar **429 Too Many Requests** em picos).

---

## ⭐ Categoria 1 — Coding & Raciocínio (recomendados para JARVIS)

| Modelo | Parâmetros | Arquitetura | Contexto | Destaque |
|---|---|---|---|---|
| `qwen/qwen3-coder-480b-a35b-instruct` | 480B (35B ativos) | MoE | 128K | **Atual padrão do JARVIS.** Focado em código. Excelente relação qualidade/velocidade |
| `qwen/qwen3.5-397b-a17b` | 397B (17B ativos) | MoE | 128K | Versão 3.5 geral, mais forte que o coder em tasks não-code |
| `qwen/qwen3.5-122b-a10b` | 122B (10B ativos) | MoE | 128K | Meio-termo: mais leve que o 397B, mais forte que o 80B |
| `qwen/qwen3-next-80b-a3b-instruct` | 80B (3B ativos) | MoE | 128K | Rápido, ideal para chat cotidiano e tasks simples |
| `qwen/qwen3-next-80b-a3b-thinking` | 80B (3B ativos) | MoE + reasoning | 128K | Mesma base, mas com cadeia de raciocínio ativada |
| `deepseek-ai/deepseek-v4-pro` | ~685B | MoE | 128K | Versão completa do DeepSeek V4. Muito forte, um pouco mais lento |
| `deepseek-ai/deepseek-v4-flash` | ~685B | MoE | 128K | Versão otimizada para velocidade do V4 |
| `deepseek-ai/deepseek-coder-6.7b-instruct` | 6.7B | Denso | 32K | Leve, bom para autocomplete e tasks de código simples |
| `minimaxai/minimax-m2.7` | ~200B | MoE | 128K | **Novo.** MiniMax M2.7 — qualidade comparável a GPT-4o, muito forte em contexto longo e tasks gerais |

---

## ⭐ Categoria 2 — Modelos Premium de Uso Geral

| Modelo | Parâmetros | Destaque |
|---|---|---|
| `mistralai/mistral-large-3-675b-instruct-2512` | 675B | Mistral flagship. Qualidade altíssima, mas pesado/responsivo |
| `mistralai/mistral-large-2-instruct` | 123B | Versão anterior do Mistral Large (~equivalente a GPT-4) |
| `mistralai/mistral-large` | 123B | Roteamento automático Mistral (pode cair no Large 3) |
| `mistralai/mistral-small-4-119b-2603` | 119B | Ótimo equilíbrio qualidade/velocidade |
| `mistralai/mistral-medium-3.5-128b` | 128B | Meio-termo entre small e large |
| `mistralai/mixtral-8x22b-instruct-v0.1` | 141B (22B ativos) | MoE, Mixtral clássico |
| `mistralai/mixtral-8x7b-instruct-v0.1` | 47B (7B ativos) | MoE, leve |
| `mistralai/mistral-7b-instruct-v0.3` | 7B | Tiny, bom para testes |
| `meta/llama-4-maverick-17b-128e-instruct` | ~128B (17B ativos) | Llama 4 MoE. Muito moderno, bom generalista |
| `meta/llama-3.3-70b-instruct` | 70B | Llama 3.3, refinamento do 3.1 |
| `meta/llama-3.1-70b-instruct` | 70B | Llama 3.1 padrão |
| `meta/llama-3.1-8b-instruct` | 8B | Pequeno, rápido |
| `meta/llama2-70b` | 70B | Legacy (Llama 2) |

---

## ⭐ Categoria 3 — Visão & Multimodal

| Modelo | Descrição |
|---|---|
| `meta/llama-3.2-90b-vision-instruct` | Llama 3.2 90B com visão |
| `meta/llama-3.2-11b-vision-instruct` | Llama 3.2 11B com visão |
| `microsoft/phi-4-multimodal-instruct` | Phi-4 multimodal |
| `microsoft/phi-3-vision-128k-instruct` | Phi-3 visão |
| `adept/fuyu-8b` | Fuyu 8B (texto+imagem) |
| `nvidia/neva-22b` | NVIDIA NEVA 22B (visão) |
| `nvidia/vila` | NVIDIA VILA (visão) |
| `nvidia/cosmos-reason2-8b` | Cosmos Reason 8B (raciocínio visual) |

---

## ⭐ Categoria 4 — Especializados

| Modelo | Especialidade |
|---|---|
| `moonshotai/kimi-k2.6` | Kimi K2.6 — contexto longo, chinês+inglês |
| `minimaxai/minimax-m2.7` | MiniMax M2.7 — generalista forte |
| `z-ai/glm-5.1` | GLM-5.1 — Zhipu AI |
| `stepfun-ai/step-3.5-flash` | Step 3.5 Flash — rápido, generalista |
| `bytedance/seed-oss-36b-instruct` | ByteDance Seed 36B |
| `writeer/palmyra-creative-122b` | Palmyra Creative — escrita criativa |
| `writer/palmyra-fin-70b-32k` | Palmyra Fin — finanças |
| `writer/palmyra-med-70b` | Palmyra Med — medicina |
| `ai21labs/jamba-1.5-large-instruct` | AI21 Jamba — MoE híbrido |
| `databricks/dbrx-instruct` | Databricks DBRX — MoE 132B |
| `sarvamai/sarvam-m` | Sarvam AI — multilíngue (IN) |
| `stockmark/stockmark-2-100b-instruct` | Stockmark 2 100B — JP |
| `aisingapore/sea-lion-7b-instruct` | SEA-LION — SEA multilíngue |
| `01-ai/yi-large` | Yi Large — 01.AI |
| `abacusai/dracarys-llama-3.1-70b-instruct` | Dracarys — Fine-tune AbacusAI do Llama 3.1 |

---

## ⭐ Categoria 5 — Código Aberto / Programação

| Modelo | Descrição |
|---|---|
| `bigcode/starcoder2-15b` | StarCoder2 15B — geração de código |
| `mistralai/codestral-22b-instruct-v0.1` | Codestral 22B — Mistral para código |
| `ibm/granite-34b-code-instruct` | Granite 34B — IBM para código |
| `ibm/granite-8b-code-instruct` | Granite 8B — IBM para código (leve) |
| `meta/codellama-70b` | CodeLlama 70B |
| `google/codegemma-7b` | CodeGemma 7B |
| `google/codegemma-1.1-7b` | CodeGemma 1.1 7B |

---

## ⭐ Categoria 6 — Embeddings & Tools

| Modelo | Descrição |
|---|---|
| `nvidia/nv-embed-v1` | Embedding geral |
| `nvidia/nv-embedqa-e5-v5` | Embedding QA |
| `nvidia/nv-embedqa-mistral-7b-v2` | Embedding QA Mistral |
| `nvidia/nv-embedcode-7b-v1` | Embedding para código |
| `baai/bge-m3` | BGE M3 — embedding multilíngue |
| `snowflake/arctic-embed-l` | Arctic Embed L — Snowflake |
| `nvidia/llama-3.2-nv-embedqa-1b-v1` | Embedding QA leve |
| `nvidia/nvidia-nemotron-nano-9b-v2` | Nemotron Nano 9B |
| `nvidia/nemotron-parse` | Parse de documentos |
| `nvidia/nemoretriever-parse` | Retrieval parse |
| `google/deplot` | DePlot — gráficos → texto |

---

## ⭐ Categoria 7 — Segurança & Guardrails

| Modelo | Descrição |
|---|---|
| `nvidia/llama-3.1-nemoguard-8b-content-safety` | Content safety |
| `nvidia/llama-3.1-nemoguard-8b-topic-control` | Topic control |
| `nvidia/llama-3.1-nemotron-safety-guard-8b-v3` | Safety guard |
| `nvidia/nemotron-3-content-safety` | Nemotron content safety |
| `nvidia/nemotron-content-safety-reasoning-4b` | Content safety leve |
| `nvidia/gliner-pii` | PII detection (Gliner) |
| `nvidia/ai-synthetic-video-detector` | Detector de vídeo sintético |
| `meta/llama-guard-4-12b` | Llama Guard 4 |

---

## ⭐ Categoria 8 — Modelos Escondidos / Legado NVIDIA

| Modelo | Descrição |
|---|---|
| `nvidia/llama-3.1-nemotron-51b-instruct` | Nemotron 51B (fine-tune NVIDIA) |
| `nvidia/llama-3.1-nemotron-70b-instruct` | **O antigo padrão do JARVIS.** Ainda disponível |
| `nvidia/llama-3.3-nemotron-super-49b-v1` | Nemotron Super 49B v1 |
| `nvidia/llama-3.3-nemotron-super-49b-v1.5` | Nemotron Super 49B v1.5 (mais recente) |
| `nvidia/llama-3.1-nemotron-ultra-253b-v1` | Nemotron Ultra 253B — **pode exigir permissão extra** |
| `nvidia/llama-3.1-nemotron-nano-8b-v1` | Nemotron Nano 8B |
| `nvidia/llama-3.1-nemotron-nano-vl-8b-v1` | Nemotron Nano 8B vision-language |
| `nvidia/llama3-chatqa-1.5-70b` | ChatQA 1.5 70B — QA em documentos |
| `nvidia/nemotron-4-340b-instruct` | Nemotron 4 340B — legado |
| `nvidia/nemotron-3-super-120b-a12b` | Nemotron 3 Super 120B |
| `nvidia/nemotron-3-nano-30b-a3b` | Nemotron 3 Nano 30B |
| `nv-mistralai/mistral-nemo-12b-instruct` | Mistral NeMo 12B |
| `google/gemma-3-12b-it` | Gemma 3 12B |
| `google/gemma-3-4b-it` | Gemma 3 4B |
| `google/gemma-4-31b-it` | Gemma 4 31B |
| `microsoft/phi-4-mini-instruct` | Phi-4 Mini 5B |
| `microsoft/phi-3.5-moe-instruct` | Phi-3.5 MoE |
| `upstage/solar-10.7b-instruct` | Solar 10.7B |
| `zyphra/zamba2-7b-instruct` | Zamba2 7B |

---

## Notas

- **NVIDIA não cobra por token** nos modelos via playground público. O limite é de **rate** (requests/min), não de cota financeira.
- Alguns modelos (marcados com ⚠️ como `nemotron-ultra-253b`) podem exigir **NVIDIA Enterprise License** ou **deploy dedicado** — mesmo listados, o acesso via chave free pode falhar.
- Modelos `openai/gpt-oss-*` são experimentos open-source hospedados pela NVIDIA, **não** são GPT da OpenAI.
- Para JARVIS, o **Qwen Coder 480B** é o melhor custo-benefício. Se quiser mais qualidade e puder esperar mais, use **Qwen 3.5 397B** ou **Mistral Large 3 675B**.
