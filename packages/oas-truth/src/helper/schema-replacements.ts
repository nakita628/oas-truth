import type { ComponentAdapter, SchemaSlot } from '../adapter/index.js'
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

export type SchemaReplacementsOptions = {
  readonly slot?: SchemaSlot
  readonly identifiers?: ReadonlyMap<string, string>
}

function slotAt(path: readonly string[], fallback?: SchemaSlot): SchemaSlot {
  if (path.includes('headers')) return 'header'
  if (path.includes('parameters')) return 'parameter'
  if (path.includes('content')) return fallback ?? 'response-content'
  return fallback ?? 'media-type'
}

export function makeSchemaReplacements(
  value: unknown,
  adapter: ComponentAdapter,
  options?: SchemaReplacementsOptions,
): ReadonlyMap<unknown, string> {
  return new Map(makeEntries(value, adapter, new Set(), [], options))
}

function makeEntries(
  v: unknown,
  adapter: ComponentAdapter,
  seen: Set<object>,
  path: readonly string[],
  options: SchemaReplacementsOptions | undefined,
): readonly (readonly [unknown, string])[] {
  if (v === null || v === undefined || typeof v !== 'object') return []
  // Cycle guard: a circular structure (e.g. from a bundled circular $ref) would
  // otherwise recurse forever.
  if (seen.has(v)) return []
  const wrap = (expr: string) =>
    adapter.wrapSchema ? adapter.wrapSchema(expr, slotAt(path, options?.slot)) : expr
  if (path.at(-1) === 'schema') {
    if (isInlineSchema(v)) return [[v, wrap(adapter.toExpression(v))]]
    if (isRecord(v) && typeof v.$ref === 'string') {
      const varName = makeSchemaVarName(v.$ref, options?.identifiers)
      if (varName) return [[v, wrap(varName)]]
    }
  }
  seen.add(v)
  const entries = Array.isArray(v)
    ? v.flatMap((item) => makeEntries(item, adapter, seen, path, options))
    : isRecord(v)
      ? Object.entries(v).flatMap(([k, child]) =>
          makeEntries(child, adapter, seen, [...path, k], options),
        )
      : []
  seen.delete(v)
  return entries
}
