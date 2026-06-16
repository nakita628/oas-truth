import type { ComponentAdapter } from '../adapter/index.js'
import type { Schema } from '../openapi/index.js'
import { isRecord, makeSchemaVarName } from '../utils/index.js'

function isInlineSchema(value: unknown): value is Schema {
  if (!isRecord(value)) return false
  if ('$ref' in value) return false
  return (
    'type' in value ||
    'properties' in value ||
    'items' in value ||
    'oneOf' in value ||
    'anyOf' in value ||
    'allOf' in value ||
    'enum' in value ||
    'const' in value ||
    'not' in value
  )
}

export function makeSchemaReplacements(
  value: unknown,
  adapter: ComponentAdapter,
): ReadonlyMap<unknown, string> {
  return new Map(makeEntries(value, adapter, new Set()))
}

function makeEntries(
  v: unknown,
  adapter: ComponentAdapter,
  seen: Set<object>,
  parentKey?: string,
): readonly (readonly [unknown, string])[] {
  if (v === null || v === undefined || typeof v !== 'object') return []
  // Cycle guard: a circular structure (e.g. from a bundled circular $ref) would
  // otherwise recurse forever.
  if (seen.has(v)) return []
  const wrap = adapter.wrapSchema ?? ((expr: string) => expr)
  if (parentKey === 'schema') {
    if (isInlineSchema(v)) return [[v, wrap(adapter.toExpression(v))]]
    if (isRecord(v) && typeof v.$ref === 'string') {
      const varName = makeSchemaVarName(v.$ref)
      if (varName) return [[v, wrap(varName)]]
    }
  }
  seen.add(v)
  const entries = Array.isArray(v)
    ? v.flatMap((item) => makeEntries(item, adapter, seen))
    : isRecord(v)
      ? Object.entries(v).flatMap(([k, child]) => makeEntries(child, adapter, seen, k))
      : []
  seen.delete(v)
  return entries
}
