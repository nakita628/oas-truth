import type { ComponentAdapter } from '../../adapter/index.js'
import { analyzeSchemas, collectSchemaRefs, makeCyclicType } from '../../helper/graph.js'
import { wrapReferences } from '../../helper/identifiers.js'
import type { Components, Schema } from '../../openapi/index.js'
import {
  claimName,
  declarationFileName,
  isRecord,
  makeSchemaIdentifiers,
  schemaRefToName,
  toIdentifierPascalCase,
} from '../../utils/index.js'

export type SchemasOptions = {
  readonly exportTypes?: boolean
  readonly readonly?: boolean
  /**
   * How to name the exported type alias. `const` (default) matches the other
   * builders (`UserSchema`); `key` uses the OpenAPI key (`User`).
   */
  readonly typeAlias?: 'const' | 'key'
  /**
   * Shape of the TS7022 helper type. `'library'` (default) matches what the
   * validator infers, so `v.GenericSchema<Helper>` / `Schema.Codec<Helper>`
   * type-check under `exactOptionalPropertyTypes`. `'literal'` is the
   * Zod-shaped `prop?: T` form for every library.
   */
  readonly cyclicTypeStyle?: 'library' | 'literal'
  /**
   * Host hook around each declaration expression — e.g. hono-openapi ref
   * registration. Applied after cycle handling. Wins over `ref`.
   */
  readonly wrapDeclaration?: (expr: string, name: string) => string
  /**
   * Register the OpenAPI key on each declaration. TypeBox puts it in the
   * outermost builder options via schema-to-library; the other libraries use
   * `adapter.withRef` (an outer wrap). A bare identifier is left unchanged.
   */
  readonly ref?: boolean
}

export type SchemaDeclaration = {
  readonly name: string
  readonly varName: string
  readonly fileName: string
  /**
   * The library import this declaration needs when written to its own file.
   * An Arktype cycle that is only `scope({...}).export().Member` gets
   * `import { type, scope } from 'arktype'`; a non-cyclic file stays
   * `import { type } from 'arktype'`.
   */
  readonly importLine: string
  readonly code: string
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
function rewriteCollisionRef(node: Schema, identifiers: ReadonlyMap<string, string>): Schema {
  if (typeof node.$ref !== 'string' || !node.$ref.startsWith('#/components/schemas/')) return node
  const key = schemaRefToName(node.$ref)
  const ident = identifiers.get(key)
  if (ident === undefined || ident === toIdentifierPascalCase(key)) return node
  return { ...node, $ref: `#/components/schemas/${ident}` }
}

function makeCyclicContainer(
  varName: string,
  group: readonly string[],
  schemas: { readonly [k: string]: Schema },
  identifiers: ReadonlyMap<string, string>,
  adapter: ComponentAdapter,
  ref?: string,
) {
  const groupIdentifiers = new Map(group.map((name) => [name, identifiers.get(name) ?? name]))
  const localize = (node: Schema): Schema => {
    const key = node.$ref ? schemaRefToName(node.$ref) : undefined
    if (key === undefined) return node
    const groupIdent = groupIdentifiers.get(key)
    if (groupIdent !== undefined) {
      const local = Object.fromEntries([
        ...Object.entries(node),
        ['$ref', `#/$defs/${groupIdent}Schema`],
      ])
      return isSchema(local) ? local : node
    }
    return rewriteCollisionRef(node, identifiers)
  }
  const $defs = Object.fromEntries(
    group.map((name) => [
      `${groupIdentifiers.get(name)}Schema`,
      mapSchema(schemas[name] ?? {}, localize),
    ]),
  )
  return adapter.toExpression(
    { title: varName, $defs },
    undefined,
    ref === undefined ? undefined : { ref },
  )
}

/**
 * The import line a schemas file needs. `cyclic` is true when this file (or
 * the bundled document) contains an Arktype `scope` / TypeBox container
 * cycle — split files that are only `scope({...}).export().Member` still
 * have to import `scope`.
 */
export function schemaImportLine(
  adapter: ComponentAdapter,
  options?: SchemasOptions,
  cyclic = false,
) {
  const exportTypes = options?.exportTypes === true
  if (!cyclic && !exportTypes) return adapter.renderImport()
  return adapter.renderImport({
    ...(cyclic && { cyclic: true }),
    ...(exportTypes && { exportTypes: true }),
  })
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
  const style = options?.cyclicTypeStyle === 'literal' ? {} : (adapter.cyclicTypeStyle ?? {})
  const declarationRef = options?.ref === true
  return order.map((name) => {
    const schema = mapSchema(prepared[name] ?? {}, (node) => rewriteCollisionRef(node, identifiers))
    const ident = identifiers.get(name) ?? toIdentifierPascalCase(name)
    const varName = `${ident}Schema`
    const group = cycles.get(name)
    const arktypeReadonly = adapter.renderCyclic !== undefined && options?.readonly === true
    const hostRef = declarationRef ? name : undefined
    const container =
      group && adapter.wrapLazy === undefined
        ? makeCyclicContainer(
            varName,
            group,
            arktypeReadonly ? schemas : prepared,
            identifiers,
            adapter,
            adapter.withRef === undefined ? hostRef : undefined,
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
    const expression =
      member ??
      adapter.toExpression(
        { ...schema, title: varName },
        undefined,
        adapter.withRef === undefined && hostRef !== undefined ? { ref: hostRef } : undefined,
      )
    const body = adapter.wrapLazy
      ? wrapReferences(
          expression,
          new Set((group ?? []).map((peer) => `${identifiers.get(peer)}Schema`)),
          adapter.wrapLazy,
        )
      : expression
    const value = options?.wrapDeclaration
      ? options.wrapDeclaration(body, name)
      : hostRef !== undefined && adapter.withRef
        ? adapter.withRef(body, name)
        : body
    const helper = group && adapter.cyclicAnnotation ? claimName(`${ident}Type`, taken) : undefined
    const annotationText = helper ? adapter.cyclicAnnotation?.(helper) : undefined
    // Keep the helper only when the annotation names it; otherwise it is unused.
    const usesHelper = helper !== undefined && annotationText?.includes(helper) === true
    if (helper && usesHelper) taken.add(helper)
    const typeDef =
      helper && usesHelper
        ? `${makeCyclicType(name, helper, schema, (ref) => infer(`${identifiers.get(ref) ?? toIdentifierPascalCase(ref)}Schema`), options?.readonly === true, style)}\n\n`
        : ''
    const annotation = annotationText === undefined ? '' : `:${annotationText}`
    const typeExport =
      options?.exportTypes === true
        ? `\n\nexport type ${exportedTypeName(ident, varName, adapter, options)}=${infer(varName)}`
        : ''
    const containerCycle = group !== undefined && adapter.wrapLazy === undefined
    return {
      name,
      varName,
      fileName: declarationFileName(ident),
      importLine: schemaImportLine(adapter, options, containerCycle),
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
  const cyclic = declarations.some((d) => d.importLine !== schemaImportLine(adapter, options))
  const imports = schemaImportLine(adapter, options, cyclic)
  return `${imports}\n\n${declarations.map((d) => d.code).join(';')}\n`
}
