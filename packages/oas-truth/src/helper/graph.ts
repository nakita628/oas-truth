import type { Schema } from '../openapi/index.js'
import { isRecord, schemaRefToName } from '../utils/index.js'

/** Every `components.schemas` name a schema reaches through `$ref`, at any depth. */
export function collectSchemaRefs(node: unknown): readonly string[] {
  if (Array.isArray(node)) return node.flatMap(collectSchemaRefs)
  if (!isRecord(node)) return []
  const own =
    typeof node.$ref === 'string' && node.$ref.startsWith('#/components/schemas/')
      ? [schemaRefToName(node.$ref)]
      : []
  return [...own, ...Object.values(node).flatMap(collectSchemaRefs)]
}

/**
 * Strongly connected components over the `$ref` graph. A component is closed
 * only after every component it reaches, so the flattened result is a
 * dependency-first declaration order; `cycles` maps each member of a recursive
 * component (a mutual cycle, or a schema that refers to itself) to its whole
 * group.
 */
export function analyzeSchemas(schemas: { readonly [k: string]: Schema }) {
  const edges = new Map(
    Object.entries(schemas).map(([name, schema]) => [
      name,
      [...new Set(collectSchemaRefs(schema))].filter((ref) => ref in schemas),
    ]),
  )
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const components: (readonly string[])[] = []
  const connect = (name: string): void => {
    index.set(name, index.size)
    low.set(name, index.size - 1)
    stack.push(name)
    onStack.add(name)
    for (const next of edges.get(name) ?? []) {
      if (!index.has(next)) connect(next)
      if (onStack.has(next)) low.set(name, Math.min(low.get(name) ?? 0, low.get(next) ?? 0))
    }
    if (low.get(name) === index.get(name)) {
      const group = stack.splice(stack.lastIndexOf(name))
      for (const member of group) onStack.delete(member)
      components.push(group)
    }
  }
  for (const name of edges.keys()) {
    if (!index.has(name)) connect(name)
  }
  const cycles = new Map(
    components
      .filter(
        (group) => group.length > 1 || (edges.get(group[0] ?? '') ?? []).includes(group[0] ?? ''),
      )
      .flatMap((group) => group.map((name) => [name, group] as const)),
  )
  return { order: components.flat(), cycles }
}

function makeTypeString(
  schema: Schema,
  self: { readonly name: string; readonly typeName: string },
  infer: (name: string) => string,
  readonly: boolean,
): string {
  const recurse = (s: Schema) => makeTypeString(s, self, infer, readonly)
  const ro = readonly ? 'readonly ' : ''
  if (schema.$ref) {
    const name = schemaRefToName(schema.$ref)
    return name === self.name ? self.typeName : infer(name)
  }
  const union = schema.oneOf ?? schema.anyOf
  if (union && union.length > 0) return `(${union.map(recurse).join('|')})`
  if (schema.allOf && schema.allOf.length > 0) return `(${schema.allOf.map(recurse).join('&')})`
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum.map((v) => JSON.stringify(v)).join('|')
  }
  if (schema.const !== undefined) return JSON.stringify(schema.const)
  const types = schema.type === undefined ? ['object'] : [schema.type].flat()
  const nullable = schema.nullable === true || types.includes('null')
  const base = types
    .filter((type) => type !== 'null')
    .map((type): string => {
      if (type === 'string') return 'string'
      if (type === 'number' || type === 'integer') return 'number'
      if (type === 'boolean') return 'boolean'
      if (type === 'array') {
        const items = schema.items
        const item = isRecord(items) ? recurse(items) : 'unknown'
        return `${ro}(${item})[]`
      }
      if (type === 'object') {
        const props = Object.entries(schema.properties ?? {}).map(
          ([key, prop]) =>
            `${ro}${JSON.stringify(key)}${schema.required?.includes(key) ? '' : '?'}:${recurse(prop)}`,
        )
        const extra = isRecord(schema.additionalProperties)
          ? [`${ro}[key:string]:${recurse(schema.additionalProperties)}`]
          : props.length === 0
            ? [`${ro}[key:string]:unknown`]
            : []
        return `{${[...props, ...extra].join(';')}}`
      }
      return 'unknown'
    })
    .join('|')
  if (!nullable) return base || 'unknown'
  return base ? `(${base}|null)` : 'null'
}

/**
 * The TypeScript shape of a recursive schema, so its declaration can carry an
 * explicit `z.ZodType<XType>` / `v.GenericSchema<XType>` annotation (TS7022).
 * References to other schemas go through their inferred types.
 */
export function makeCyclicType(
  name: string,
  typeName: string,
  schema: Schema,
  infer: (name: string) => string,
  readonly: boolean,
) {
  return `type ${typeName}=${makeTypeString(schema, { name, typeName }, infer, readonly)}`
}
