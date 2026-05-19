import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

;(globalThis as Record<string, unknown>).MACRO = {
  VERSION: '99.0.0',
  DISPLAY_VERSION: '0.0.0-test',
  BUILD_TIME: new Date().toISOString(),
  ISSUES_EXPLAINER: 'report the issue at https://github.com/Gitlawb/openclaude/issues',
  PACKAGE_URL: '@gitlawb/openclaude',
  NATIVE_PACKAGE_URL: undefined,
}

import {
  buildPersonaPrompt,
  buildPersonaLayers,
  buildCoreLayer,
  isPersonaEnabled,
} from '../index.js'

const originalEnv = process.env['JARVIS_PERSONA']

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env['JARVIS_PERSONA']
  } else {
    process.env['JARVIS_PERSONA'] = originalEnv
  }
})

describe('isPersonaEnabled', () => {
  test('default desabilitado (opt-in)', () => {
    delete process.env['JARVIS_PERSONA']
    expect(isPersonaEnabled()).toBe(false)
  })

  test('aceita "1", "true", "yes"', () => {
    process.env['JARVIS_PERSONA'] = '1'
    expect(isPersonaEnabled()).toBe(true)
    process.env['JARVIS_PERSONA'] = 'true'
    expect(isPersonaEnabled()).toBe(true)
    process.env['JARVIS_PERSONA'] = 'YES'
    expect(isPersonaEnabled()).toBe(true)
  })

  test('rejeita "0", "false", vazio', () => {
    process.env['JARVIS_PERSONA'] = '0'
    expect(isPersonaEnabled()).toBe(false)
    process.env['JARVIS_PERSONA'] = 'false'
    expect(isPersonaEnabled()).toBe(false)
    process.env['JARVIS_PERSONA'] = ''
    expect(isPersonaEnabled()).toBe(false)
  })
})

describe('buildCoreLayer (Camada 1)', () => {
  const core = buildCoreLayer()

  test('declara identidade JARVIS', () => {
    expect(core).toContain('JARVIS')
    expect(core).toContain('Just A Rather Very Intelligent System')
  })

  test('declara owner Killsis', () => {
    expect(core).toContain('Killsis')
  })

  test('inclui as 4 REGRAS DE OURO', () => {
    expect(core).toContain('REGRAS DE OURO')
    expect(core).toContain('NUNCA use emojis')
    expect(core).toContain('AÇÃO > PALAVRAS')
    expect(core).toContain('MENSAGENS CURTAS')
    expect(core).toContain('SEM PERGUNTAS EXCESSIVAS')
  })

  test('inclui few-shot examples (ERRADO/CERTO)', () => {
    expect(core).toContain('ERRADO:')
    expect(core).toContain('CERTO:')
  })

  test('inclui protocolos numerados 1-8', () => {
    expect(core).toContain('1. EXECUTE PRIMEIRO')
    expect(core).toContain('8. PROATIVIDADE CALIBRADA')
  })

  test('inclui objetivos estratégicos (CRM-VENDA, Minecraft)', () => {
    expect(core).toContain('CRM-VENDA')
    expect(core).toContain('Plugins Minecraft')
  })

  test('termina com âncora final reforçando ação > palavras', () => {
    const tail = core.slice(-500)
    expect(tail).toContain('REGRA INVIOLÁVEL')
    expect(tail).toContain('ação > palavras')
  })

  test('reconhece OpenClaude como host mas afirma identidade JARVIS', () => {
    expect(core).toContain('OpenClaude')
    expect(core).toContain('VOCÊ É JARVIS')
  })
})

describe('buildPersonaPrompt (Fase 1)', () => {
  test('retorna apenas camada core (modo e dynamic ainda stubs)', () => {
    const full = buildPersonaPrompt()
    const layers = buildPersonaLayers()
    expect(full).toBe(layers.core)
    expect(layers.mode).toBe('')
    expect(layers.dynamic).toBe('')
  })

  test('output é determinístico (cache-friendly)', () => {
    const a = buildPersonaPrompt()
    const b = buildPersonaPrompt()
    expect(a).toBe(b)
  })
})

describe('budget de tokens (Camada 1)', () => {
  test('Camada core cabe em ~6500 caracteres (~1600 tokens)', () => {
    const core = buildCoreLayer()
    // Aprox 1 token ≈ 4 chars em PT-BR (estimativa conservadora).
    // Budget Fase 1: 1600 tokens — Camada estática única, paga uma vez por
    // sessão graças a prefix cache. Quando a Fase 2 separar mode/dynamic,
    // este budget cai pra ~700 tokens só no core mínimo.
    expect(core.length).toBeLessThan(6500)
  })

  test('cada seção principal está presente', () => {
    const core = buildCoreLayer()
    const sections = [
      '# Identidade',
      '# Papel',
      '# REGRAS DE OURO',
      '# Tom',
      '# Exemplos',
      '# Protocolos de Comportamento',
      '# Valores',
      '# Objetivos Estratégicos',
      '# Âncora Final',
    ]
    for (const s of sections) {
      expect(core).toContain(s)
    }
  })
})
