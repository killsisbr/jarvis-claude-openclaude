/**
 * JARVIS Persona — entrypoint público.
 */

export {
  buildPersonaPrompt,
  buildPersonaLayers,
  buildCoreLayer,
  type PersonaPromptOptions,
  type PersonaLayers,
} from './compiler/prompt-builder.js'

export * from './core/index.js'

/**
 * Checa se a persona JARVIS está habilitada.
 *
 * Default: false (opt-in). Ativada por:
 *   - env var JARVIS_PERSONA=1
 *
 * Settings JSON-based virá na Fase 4 (worker integration).
 */
export function isPersonaEnabled(): boolean {
  const flag = process.env['JARVIS_PERSONA']
  if (!flag) return false
  const normalized = flag.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}
