import { describe, it, expect } from 'vitest'
import {
  robustParseJSON,
  safeStringifyJSON,
  extractJSON,
  validateJSONSchema,
} from './json-utils'

describe('JSON Utils', () => {
  describe('robustParseJSON', () => {
    it('should parse valid JSON', () => {
      const result = robustParseJSON('{"key": "value"}')
      expect(result).toEqual({ key: 'value' })
    })

    it('should handle trailing commas', () => {
      const result = robustParseJSON('{"key": "value",}')
      expect(result).toEqual({ key: 'value' })
    })

    it('should handle array trailing commas', () => {
      const result = robustParseJSON('[1, 2, 3,]')
      expect(result).toEqual([1, 2, 3])
    })

    it('should handle unquoted keys (simple case)', () => {
      const result = robustParseJSON('{key: "value"}')
      expect(result?.key).toBe('value')
    })

    it('should extract JSON from markdown code blocks', () => {
      const text = `
        Some explanation:
        \`\`\`json
        {"name": "test", "value": 123}
        \`\`\`
        More text
      `
      const result = robustParseJSON(text)
      expect(result).toEqual({ name: 'test', value: 123 })
    })

    it('should extract JSON from generic code blocks', () => {
      const text = `
        Here is JSON:
        \`\`\`
        {"data": [1, 2, 3]}
        \`\`\`
      `
      const result = robustParseJSON(text)
      expect(result?.data).toEqual([1, 2, 3])
    })

    it('should extract JSON from text with surrounding content', () => {
      const text = 'Before text {"valid": "json"} after text'
      const result = robustParseJSON(text)
      expect(result).toEqual({ valid: 'json' })
    })

    it('should extract array JSON from text', () => {
      const text = 'Start [1, 2, 3] end'
      const result = robustParseJSON(text)
      expect(result).toEqual([1, 2, 3])
    })

    it('should return null for invalid input', () => {
      expect(robustParseJSON('not json at all')).toBeNull()
      expect(robustParseJSON('')).toBeNull()
      expect(robustParseJSON(null as any)).toBeNull()
    })

    it('should handle nested structures', () => {
      const json = '{"outer": {"inner": {"deep": "value"}}}'
      const result = robustParseJSON(json)
      expect(result?.outer?.inner?.deep).toBe('value')
    })

    it('should handle arrays of objects', () => {
      const json = '[{"id": 1}, {"id": 2}]'
      const result = robustParseJSON(json)
      expect(Array.isArray(result)).toBe(true)
      expect(result[0].id).toBe(1)
      expect(result[1].id).toBe(2)
    })
  })

  describe('safeStringifyJSON', () => {
    it('should stringify simple objects', () => {
      const obj = { key: 'value', num: 42 }
      const result = safeStringifyJSON(obj, 0)
      expect(JSON.parse(result)).toEqual(obj)
    })

    it('should handle circular references', () => {
      const obj: any = { key: 'value' }
      obj.self = obj
      const result = safeStringifyJSON(obj)
      expect(result).toContain('Circular')
    })

    it('should indent output', () => {
      const obj = { a: 1, b: 2 }
      const result = safeStringifyJSON(obj, 2)
      expect(result).toContain('\n')
    })
  })

  describe('extractJSON', () => {
    it('should extract from direct JSON', () => {
      const result = extractJSON('{"test": true}')
      expect(result).toEqual({ test: true })
    })

    it('should extract from markdown code blocks', () => {
      const text = 'Response:\n```json\n{"key": "value"}\n```'
      const result = extractJSON(text)
      expect(result).toEqual({ key: 'value' })
    })

    it('should extract embedded JSON', () => {
      const text = 'Response: ```{"key": "value"}```'
      const result = extractJSON(text)
      expect(result?.key).toBe('value')
    })

    it('should extract array JSON', () => {
      const text = 'Data: [1, 2, 3]'
      const result = extractJSON(text)
      expect(result).toEqual([1, 2, 3])
    })

    it('should return null for no JSON', () => {
      expect(extractJSON('No JSON here')).toBeNull()
      expect(extractJSON('')).toBeNull()
    })
  })

  describe('validateJSONSchema', () => {
    it('should validate matching schema', () => {
      const data = { name: 'John', age: 30 }
      const schema = { name: 'string', age: 'number' }
      const result = validateJSONSchema(data, schema)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing fields', () => {
      const data = { name: 'John' }
      const schema = { name: 'string', age: 'number' }
      const result = validateJSONSchema(data, schema)

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('age')
    })

    it('should detect type mismatches', () => {
      const data = { name: 'John', age: '30' }
      const schema = { name: 'string', age: 'number' }
      const result = validateJSONSchema(data, schema)

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('age')
      expect(result.errors[0]).toContain('string')
    })

    it('should handle "any" type', () => {
      const data = { value: 'anything' }
      const schema = { value: 'any' }
      const result = validateJSONSchema(data, schema)

      expect(result.valid).toBe(true)
    })

    it('should reject non-objects', () => {
      const result = validateJSONSchema('not an object', {})

      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('not an object')
    })

    it('should handle empty schema', () => {
      const data = { any: 'thing' }
      const result = validateJSONSchema(data, {})

      expect(result.valid).toBe(true)
    })
  })
})
