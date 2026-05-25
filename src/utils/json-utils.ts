/**
 * Robust JSON Parsing Utilities
 *
 * Handles malformed, partial, and edge-case JSON
 * Adapted from KimiProxy src/utils/json.ts
 */

/**
 * Parse JSON with fallback strategies
 *
 * Tries multiple approaches:
 * 1. Standard JSON.parse
 * 2. Repair common issues (trailing commas, unquoted keys)
 * 3. Extract JSON from text with markers
 * 4. Return null if all fail
 *
 * @param text - Raw JSON text
 * @returns Parsed object or null
 */
export function robustParseJSON(text: string): any {
  if (!text || typeof text !== 'string') {
    return null
  }

  // Attempt 1: Direct parse
  try {
    return JSON.parse(text)
  } catch {
    // Continue to fallbacks
  }

  // Attempt 2: Repair common issues
  try {
    // Remove trailing commas
    let repaired = text.replace(/,\s*([}\]])/g, '$1')
    // Add quotes to unquoted keys (simple case)
    repaired = repaired.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    return JSON.parse(repaired)
  } catch {
    // Continue
  }

  // Attempt 3: Extract JSON from markdown code blocks
  try {
    const matches = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (matches && matches[1]) {
      return JSON.parse(matches[1])
    }
  } catch {
    // Continue
  }

  // Attempt 4: Try extracting object/array from start
  try {
    const start = text.indexOf('{') >= 0 ? '{' : '['
    const startIdx = text.indexOf(start)
    if (startIdx >= 0) {
      // Find matching closing bracket
      let depth = 0
      let endIdx = startIdx
      const openChar = start
      const closeChar = start === '{' ? '}' : ']'

      for (let i = startIdx; i < text.length; i++) {
        if (text[i] === openChar) depth++
        if (text[i] === closeChar) {
          depth--
          if (depth === 0) {
            endIdx = i + 1
            break
          }
        }
      }

      if (endIdx > startIdx) {
        const extracted = text.substring(startIdx, endIdx)
        try {
          return JSON.parse(extracted)
        } catch {
          // Continue
        }
      }
    }
  } catch {
    // Continue
  }

  // All attempts failed
  return null
}

/**
 * Safely stringify JSON with circular reference handling
 */
export function safeStringifyJSON(obj: any, indent = 2): string {
  const seen = new Set()

  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]'
        }
        seen.add(value)
      }
      return value
    },
    indent
  )
}

/**
 * Extract JSON from mixed content
 *
 * Returns first valid JSON object/array found
 */
export function extractJSON(content: string): any {
  if (!content) return null

  // Try direct parse first
  try {
    return JSON.parse(content)
  } catch {
    // Continue
  }

  // Look for JSON patterns in content
  const patterns = [
    /```json\s*([\s\S]*?)\s*```/,
    /```\s*([\s\S]*?)\s*```/,
    /\{[\s\S]*\}/,
    /\[[\s\S]*\]/,
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) {
      const result = robustParseJSON(match[1] || match[0])
      if (result !== null) {
        return result
      }
    }
  }

  return null
}

/**
 * Validate JSON schema (basic check)
 */
export function validateJSONSchema(
  data: any,
  schema: Record<string, string>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (typeof data !== 'object' || data === null) {
    return {
      valid: false,
      errors: ['Data is not an object'],
    }
  }

  for (const [key, expectedType] of Object.entries(schema)) {
    if (!(key in data)) {
      errors.push(`Missing required field: ${key}`)
      continue
    }

    const actualType = typeof data[key]
    if (actualType !== expectedType && expectedType !== 'any') {
      errors.push(
        `Field "${key}" has type "${actualType}", expected "${expectedType}"`
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
