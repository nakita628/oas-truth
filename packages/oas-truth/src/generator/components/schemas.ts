import type { ComponentAdapter } from '../../adapter/index.js'
import { analyzeSchemas, collectSchemaRefs, makeCyclicType } from '../../helper/graph.js'
import { wrapReferences } from '../../helper/identifiers.js'
import type { Components, Schema } from '../../openapi/index.js'
import { isRecord, schemaRefToName, toIdentifierPascalCase } from '../../utils/index.js'

export type SchemasOptions = {
  readonly exportTypes?: boolean
  readonly readonly?: boolean
  /**
   * How to name the exported type alias. `const` (default) matches the other
   * builders (`UserSchema`); `key` uses the OpenAPI key (`User`).
   */
  readonly typeAlias?: 'const' | 'key'
  /**
   * Host hook around each declaration expression — e.g. hono-openapi ref
   * registration. Applied after cycle handling.
   */
  readonly wrapDeclaration?: (expr: string, name: string) => string
}

export type SchemaDeclaration = {
  readonly name: string
  readonly varName: string
  readonly fileName: string
  readonly code: string
}

/** `name`, or the first of `name2`, `name3`, … not in `used`. */
function claimName(name: string, used: ReadonlySet<string>, i = 2): string {
  if (!used.has(name)) return name
  return used.has(`${name}${i}`) ? claimName(name, used, i + 1) : `${name}${i}`
}

/**
 * `toIdentifierPascalCase` folds `user` and `User` into one identifier; later
 * colliders get a numeric suffix so no declaration is lost. A `$ref` to a later
 * collider still resolves to the first declaration.
 */
function makeSchemaIdentifiers(schemas: { readonly [k: string]: Schema }) {
  return Object.keys(schemas).reduce(
    (acc, key) => acc.set(key, claimName(toIdentifierPascalCase(key), new Set(acc.values()))),
    new Map<string, string>(),
  )
}

/** Keys whose value is a subschema (or a list of them) and keys whose value maps names to subschemas. */
const SUBSCHEMA_KEYS: ReadonlySet<string> = new Set([
  'items',
  'prefixItems',
  'additionalProperties',
  'allOf',
  'anyOf',
  'oneOf',
  'not',
  'if',
  'then',
  'else',
  'contains',
  'propertyNames',
  'unevaluatedItems',
  'unevaluatedProperties',
  'contentSchema',
])
const SUBSCHEMA_MAP_KEYS: ReadonlySet<string> = new Set([
  'properties',
  'patternProperties',
  'dependentSchemas',
  '$defs',
])

function isSchema(value: unknown): value is Schema {
  return isRecord(value)
}

/** Rewrites a schema bottom-up with `fn`, following only subschemas (never example or default values). */
function mapSchema(schema: Schema, fn: (node: Schema) => Schema): Schema {
  const map = (value: unknown): unknown => (isSchema(value) ? mapSchema(value, fn) : value)
  const node = Object.fromEntries(
    Object.entries(schema).map(([key, value]) => {
      if (SUBSCHEMA_KEYS.has(key)) return [key, Array.isArray(value) ? value.map(map) : map(value)]
      if (SUBSCHEMA_MAP_KEYS.has(key) && isRecord(value)) {
        return [key, Object.fromEntries(Object.entries(value).map(([k, v]) => [k, map(v)]))]
      }
      return [key, value]
    }),
  )
  return fn(isSchema(node) ? node : schema)
}

/**
 * `readonly` as the declarative `x-readonly` extension on every object and array,
 * which schema-to-library turns into each library's readonly form.
 */
function markReadonly(schema: Schema) {
  return mapSchema(schema, (node) => {
    const types = new Set<unknown>([node.type].flat())
    return types.has('object') || types.has('array') ? { ...node, 'x-readonly': true } : node
  })
}

/**
 * TypeBox and Arktype cannot express a cycle with standalone `const`s: the group
 * becomes one `Type.Cyclic(...)` / `scope(...)` container and each member selects
 * its entry. schema-to-library builds the container from a `$defs` document.
 */
function makeCyclicContainer(
  varName: string,
  group: readonly string[],
  schemas: { readonly [k: string]: Schema },
  identifiers: ReadonlyMap<string, string>,
  adapter: ComponentAdapter,
) {
  const groupIdentifiers = new Map(group.map((name) => [name, identifiers.get(name) ?? name]))
  const localize = (node: Schema): Schema => {
    const ident = node.$ref ? groupIdentifiers.get(schemaRefToName(node.$ref)) : undefined
    if (ident === undefined) return node
    const local = Object.fromEntries([...Object.entries(node), ['$ref', `#/$defs/${ident}Schema`]])
    return isSchema(local) ? local : node
  }
  const $defs = Object.fromEntries(
    group.map((name) => [
      `${groupIdentifiers.get(name)}Schema`,
      mapSchema(schemas[name] ?? {}, localize),
    ]),
  )
  return adapter.toExpression({ title: varName, $defs })
}

function schemaImportLine(
  adapter: ComponentAdapter,
  options: SchemasOptions | undefined,
  hasContainerCycle: boolean,
) {
  const line = adapter.renderImport()
  if (hasContainerCycle && adapter.renderCyclic && line === "import { type } from 'arktype'") {
    return "import { type, scope } from 'arktype'"
  }
  if (options?.exportTypes === true && line === "import { Type } from '@sinclair/typebox'") {
    return "import { Type, type Static } from '@sinclair/typebox'"
  }
  return line
}

function exportedTypeName(
  ident: string,
  varName: string,
  adapter: ComponentAdapter,
  options: SchemasOptions | undefined,
) {
  if (options?.typeAlias !== 'key') return varName
  return (adapter.reservedTypeNames ?? []).includes(ident) ? `${ident}Type` : ident
}

function fileNameOf(ident: string) {
  return `${ident.charAt(0).toLowerCase()}${ident.slice(1)}`
}

/**
 * One `export const <X>Schema=...` declaration per `components.schemas` entry,
 * in dependency-first order. Only references inside a `$ref` cycle are lazy
 * (and their declarations get the annotation TypeScript needs); every other
 * reference is a plain identifier, declared earlier.
 */
export function makeSchemaDeclarations(
  schemas: { readonly [k: string]: Schema },
  adapter: ComponentAdapter,
  options?: SchemasOptions,
) {
  const prepared = Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [
      name,
      options?.readonly === true ? markReadonly(schema) : schema,
    ]),
  )
  const identifiers = makeSchemaIdentifiers(schemas)
  const { order, cycles } = analyzeSchemas(schemas)
  const taken = new Set([
    ...identifiers.values(),
    ...[...identifiers.values()].map((ident) => `${ident}Schema`),
    ...(adapter.reservedTypeNames ?? []),
  ])
  const infer = (varName: string) =>
    adapter.renderTypeInfer(varName).replace(`export type ${varName}=`, '')
  return order.map((name) => {
    const schema = prepared[name] ?? {}
    const ident = identifiers.get(name) ?? toIdentifierPascalCase(name)
    const varName = `${ident}Schema`
    const group = cycles.get(name)
    const arktypeReadonly = adapter.renderCyclic !== undefined && options?.readonly === true
    const container =
      group && adapter.wrapLazy === undefined
        ? makeCyclicContainer(
            varName,
            group,
            arktypeReadonly ? schemas : prepared,
            identifiers,
            adapter,
          )
        : undefined
    const peers = group ?? []
    const rendered =
      container === undefined
        ? undefined
        : (adapter.renderCyclic?.(
            varName,
            container,
            [...new Set(peers.flatMap((peer) => collectSchemaRefs(schemas[peer])))].flatMap(
              (ref) =>
                peers.includes(ref) || !identifiers.has(ref)
                  ? []
                  : [`${identifiers.get(ref)}Schema`],
            ),
          ) ?? container)
    const member = rendered && arktypeReadonly ? `${rendered}.readonly()` : rendered
    const expression = member ?? adapter.toExpression({ ...schema, title: varName })
    const body = adapter.wrapLazy
      ? wrapReferences(
          expression,
          new Set((group ?? []).map((peer) => `${identifiers.get(peer)}Schema`)),
          adapter.wrapLazy,
        )
      : expression
    const value = options?.wrapDeclaration ? options.wrapDeclaration(body, name) : body
    const helper = group && adapter.cyclicAnnotation ? claimName(`${ident}Type`, taken) : undefined
    const annotationText = helper ? adapter.cyclicAnnotation?.(helper) : undefined
    // Effect's annotation is `Schema.Codec<any>` and does not name the helper.
    const usesHelper = helper !== undefined && annotationText?.includes(helper) === true
    if (helper && usesHelper) taken.add(helper)
    const typeDef =
      helper && usesHelper
        ? `${makeCyclicType(name, helper, schema, (ref) => infer(`${identifiers.get(ref) ?? toIdentifierPascalCase(ref)}Schema`), options?.readonly === true)}\n\n`
        : ''
    const annotation = annotationText === undefined ? '' : `:${annotationText}`
    const typeExport =
      options?.exportTypes === true
        ? `\n\nexport type ${exportedTypeName(ident, varName, adapter, options)}=${infer(varName)}`
        : ''
    return {
      name,
      varName,
      fileName: fileNameOf(ident),
      code: `${typeDef}export const ${varName}${annotation}=${value}${typeExport}`,
    }
  })
}

/**
 * The import line and every `components.schemas` declaration, in dependency
 * order. Returns `''` when schemas are missing or empty.
 */
export function makeSchemasCode(
  components: Components,
  adapter: ComponentAdapter,
  options?: SchemasOptions,
) {
  const { schemas } = components
  if (!schemas) return ''
  const declarations = makeSchemaDeclarations(schemas, adapter, options)
  if (declarations.length === 0) return ''
  const hasContainerCycle =
    adapter.wrapLazy === undefined && analyzeSchemas(schemas).cycles.size > 0
  const imports = schemaImportLine(adapter, options, hasContainerCycle)
  return `${imports}\n\n${declarations.map((d) => d.code).join(';')}\n`
}
