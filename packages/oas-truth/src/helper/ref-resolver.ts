import { isRecord, makeSchemaVarName } from '../utils/index.js'

export function valueToCode(
  value: unknown,
  codeReplacements?: ReadonlyMap<unknown, string>,
): string {
  return encodeValue(value, codeReplacements, new Set())
}

function encodeValue(
  value: unknown,
  codeReplacements: ReadonlyMap<unknown, string> | undefined,
  seen: Set<object>,
): string {
  const replacement = codeReplacements?.get(value)
  if (replacement !== undefined) return replacement
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return JSON.stringify(value)
  // Non-finite numbers (NaN / ±Infinity) have no JSON form; emit `null` to match
  // JSON.stringify rather than a bare `NaN`/`Infinity` identifier.
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
  if (typeof value === 'boolean') return String(value)
  if (typeof value === 'bigint') return value.toString()
  if (Array.isArray(value)) {
    if (seen.has(value)) return 'null'
    seen.add(value)
    const code = `[${value.map((v) => encodeValue(v, codeReplacements, seen)).join(',')}]`
    seen.delete(value)
    return code
  }
  if (isRecord(value)) {
    if (seen.has(value)) return 'null'
    if ('$ref' in value && typeof value.$ref === 'string') {
      const varName = makeSchemaVarName(value.$ref)
      if (varName) return varName
    }
    seen.add(value)
    const entries = Object.entries(value).map(([k, v]) => {
      const key = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/u.test(k) ? k : JSON.stringify(k)
      return `${key}:${encodeValue(v, codeReplacements, seen)}`
    })
    seen.delete(value)
    return `{${entries.join(',')}}`
  }
  return 'null'
}
