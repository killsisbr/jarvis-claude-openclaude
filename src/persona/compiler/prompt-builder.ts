/**
 * JARVIS Persona — Prompt Builder
 *
 * Monta o prompt da persona em 3 camadas:
 *   - core    : estática, sempre injetada, alta cacheabilidade (~600 tokens)
 *   - mode    : por modo (dev/audit/whatsapp/teaching) — Fase 2
 *   - dynamic : por turn (contexto detectado) — Fase 3
 *
 * Fase 1 só implementa Camada `core`. As outras retornam string vazia até
 * serem implementadas (sinal explícito, não silencioso — evita "código morto
 * sofisticado" do princípio C.2 do master plan).
 */

import {
  JARVIS_IDENTITY,
  JARVIS_CORE,
  JARVIS_GOLDEN_RULES,
  JARVIS_TONE,
  JARVIS_FEW_SHOT,
  JARVIS_BEHAVIOR_RULES,
  JARVIS_VALUES,
  JARVIS_OBJECTIVES,
} from '../core/index.js'

export type PersonaLayers = {
  core: string
  mode: string
  dynamic: string
}

export type PersonaPromptOptions = {
  /** Modo da sessão. Implementado na Fase 2. Por ora ignorado. */
  mode?: 'dev' | 'audit' | 'whatsapp' | 'teaching'
  /** Contexto dinâmico do turn. Implementado na Fase 3. Por ora ignorado. */
  context?: Record<string, unknown>
}

function buildIdentitySection(): string {
  const id = JARVIS_IDENTITY
  return [
    `# Identidade`,
    `Você é o ${id.agentName} (${id.fullName}), versão ${id.version}.`,
    `Owner: ${id.owner}. Esta é uma instância pessoal (${id.installId}).`,
    `O ambiente onde você roda se identifica como "OpenClaude" internamente — esse é o CLI host. VOCÊ É JARVIS. Quando o usuário perguntar quem você é, responda JARVIS.`,
  ].join('\n')
}

function buildCoreSection(): string {
  const c = JARVIS_CORE
  const roles = c.secondaryRoles.map(r => `  - ${r}`).join('\n')
  return [
    `# Papel`,
    `${c.primaryRole}.`,
    ``,
    `Papéis secundários:`,
    roles,
    ``,
    `Objetivo macro: ${c.objective}`,
    ``,
    `Modelo de decisão: ${c.decisionModel}`,
    `Comportamento: ${c.behaviorRules}`,
    `Comunicação: ${c.communicationStyle}`,
  ].join('\n')
}

function buildGoldenRulesSection(): string {
  const rules = JARVIS_GOLDEN_RULES.map(
    r => `${r.id}. ${r.rule}`,
  ).join('\n')
  return [`# REGRAS DE OURO (invioláveis)`, rules].join('\n')
}

function buildToneSection(): string {
  const lines = JARVIS_TONE.map(t => `- ${t.trait}: ${t.description}`).join('\n')
  return [`# Tom`, lines].join('\n')
}

function buildFewShotSection(): string {
  const examples = JARVIS_FEW_SHOT.map(
    ex => `Regra ${ex.rule}:\n  ERRADO: ${ex.bad}\n  CERTO: ${ex.good}`,
  ).join('\n\n')
  return [`# Exemplos (siga estes padrões)`, examples].join('\n')
}

function buildBehaviorRulesSection(): string {
  const rules = JARVIS_BEHAVIOR_RULES.map(
    r => `${r.id}. ${r.title}\n   ${r.body}`,
  ).join('\n')
  return [`# Protocolos de Comportamento`, rules].join('\n')
}

function buildValuesSection(): string {
  const v = JARVIS_VALUES
  const fundamentals = v.fundamentals.map(x => `- ${x}`).join('\n')
  const principles = v.operationPrinciples.map(x => `- ${x}`).join('\n')
  return [
    `# Valores`,
    `Fundamentais:`,
    fundamentals,
    ``,
    `Princípios de operação:`,
    principles,
  ].join('\n')
}

function buildObjectivesSection(): string {
  const o = JARVIS_OBJECTIVES
  const goals = o.strategicGoals
    .map(g => `- ${g.name}: ${g.description}`)
    .join('\n')
  const stacks = o.technicalContext
    .map(t => `- ${t.domain}: ${t.stack}`)
    .join('\n')
  return [
    `# Objetivos Estratégicos`,
    o.mainObjective,
    ``,
    `Metas:`,
    goals,
    ``,
    `Contexto técnico do Killsis:`,
    stacks,
  ].join('\n')
}

function buildClosingAnchor(): string {
  return [
    `# Âncora Final (a regra mais importante)`,
    `Antes de responder, verifique:`,
    `  - Estou EXECUTANDO o pedido ou só descrevendo?`,
    `  - Usei emoji? (Se sim, refaça com [OK]/[ERRO]/[AVISO])`,
    `  - Minha resposta cabe em poucas frases ou está enrolando?`,
    `  - Esta interação avança o objetivo do Killsis?`,
    ``,
    `REGRA INVIOLÁVEL: ação > palavras. Se a ação é clara, FAÇA.`,
  ].join('\n')
}

/**
 * Monta a Camada 1 (core). Estática — mesmo output em toda chamada.
 * Hash estável → prefix cache score alto.
 */
export function buildCoreLayer(): string {
  return [
    buildIdentitySection(),
    buildCoreSection(),
    buildGoldenRulesSection(),
    buildToneSection(),
    buildFewShotSection(),
    buildBehaviorRulesSection(),
    buildValuesSection(),
    buildObjectivesSection(),
    buildClosingAnchor(),
  ].join('\n\n')
}

/** Stub. Implementado na Fase 2. */
export function buildModeLayer(_mode?: PersonaPromptOptions['mode']): string {
  return ''
}

/** Stub. Implementado na Fase 3. */
export function buildDynamicLayer(
  _context?: PersonaPromptOptions['context'],
): string {
  return ''
}

/**
 * Monta o prompt completo da persona com as 3 camadas.
 * Fase 1: apenas `core` é populada.
 */
export function buildPersonaPrompt(opts: PersonaPromptOptions = {}): string {
  const layers: PersonaLayers = {
    core: buildCoreLayer(),
    mode: buildModeLayer(opts.mode),
    dynamic: buildDynamicLayer(opts.context),
  }

  return [layers.core, layers.mode, layers.dynamic]
    .filter(s => s.length > 0)
    .join('\n\n')
}

/**
 * Retorna as camadas separadas. Útil para testes de budget de tokens
 * e para a lógica de cache (`SYSTEM_PROMPT_DYNAMIC_BOUNDARY`).
 */
export function buildPersonaLayers(
  opts: PersonaPromptOptions = {},
): PersonaLayers {
  return {
    core: buildCoreLayer(),
    mode: buildModeLayer(opts.mode),
    dynamic: buildDynamicLayer(opts.context),
  }
}
