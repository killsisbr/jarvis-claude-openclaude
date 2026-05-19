import { defineGateway } from '../define.js'

export default defineGateway({
  id: 'nvidia-nim',
  label: 'NVIDIA NIM',
  category: 'hosted',
  defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
  defaultModel: 'qwen/qwen3-coder-480b-a35b-instruct',
  supportsModelRouting: true,
  setup: {
    requiresAuth: true,
    authMode: 'api-key',
    credentialEnvVars: ['NVIDIA_API_KEY'],
  },
  transportConfig: {
    kind: 'openai-compatible',
    openaiShim: {
      supportsAuthHeaders: true,
    },
  },
  preset: {
    id: 'nvidia-nim',
    description: 'NVIDIA NIM endpoint',
    apiKeyEnvVars: ['NVIDIA_API_KEY'],
    vendorId: 'openai',
  },
  validation: {
    kind: 'credential-env',
    credentialEnvVars: ['NVIDIA_API_KEY'],
    missingCredentialMessage:
      'NVIDIA_API_KEY is required when using NVIDIA NIM.',
    routing: {
      enablementEnvVar: 'NVIDIA_NIM',
      matchDefaultBaseUrl: true,
    },
  },
  catalog: {
    source: 'static',
    models: [
      { id: 'qwen3-coder-480b', apiName: 'qwen/qwen3-coder-480b-a35b-instruct', label: 'Qwen 3 Coder 480B', modelDescriptorId: 'qwen/qwen3-coder-480b-a35b-instruct' },
      { id: 'deepseek-v4-flash', apiName: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash', modelDescriptorId: 'deepseek-ai/deepseek-v4-flash' },
      { id: 'minimax-m2.7', apiName: 'minimaxai/minimax-m2.7', label: 'MiniMax M2.7', modelDescriptorId: 'minimaxai/minimax-m2.7' },
    ],
  },
  usage: { supported: false },
})
