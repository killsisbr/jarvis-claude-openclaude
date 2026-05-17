export { CircuitBreaker, type CircuitState, type CircuitBreakerOptions } from './circuitBreaker.ts'
export {
  RotateChain,
  type ProviderEntry,
  type ProviderEntryConfig,
  type RotateEvent,
  type RotateEventCallback,
  type FailureKind,
  classifyError,
} from './RotateChain.ts'
export {
  createRotateChainFromEnv,
  parseRotateConfig,
  buildProvidersFromConfig,
  type RotateConfig,
} from './factory.ts'
