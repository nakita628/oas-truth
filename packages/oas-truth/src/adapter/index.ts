import { schemaToArktype } from 'schema-to-library/arktype'
import { schemaToEffect } from 'schema-to-library/effect'
import { schemaToTypebox } from 'schema-to-library/typebox'
import { schemaToValibot } from 'schema-to-library/valibot'
import { schemaToZod } from 'schema-to-library/zod'

import type { Schema } from '../openapi/index.js'

export type ParamIn = 'query' | 'path'

export type SchemaLib = 'zod' | 'valibot' | 'arktype' | 'effect' | 'typebox'

/**
 * The minimal surface the component generators consume from a validator
 * adapter. Each library's full adapter (carrying `toNamedExport`,
 * `annotateCyclic`, `objectField`, … for schema/contract generation) is a
 * structural supertype, so it can be passed wherever a `ComponentAdapter` is
 * required without a cast.
 *
 * `wrapSchema` is an optional host hook applied to every `schema:` slot
 * expression (inline and `$ref` alike). A host that needs to transform the
 * expression — e.g. hono-openapi wrapping it in `resolver(...)` — supplies it;
 * omitting it leaves the expression untouched (identity), so the shared library
 * stays framework-agnostic.
 */
export type ComponentAdapter = {
  readonly renderImport: () => string
  readonly toExpression: (schema: Schema, paramIn?: ParamIn) => string
  readonly renderTypeInfer: (constName: string) => string
  readonly wrapSchema?: (expr: string) => string
}

/**
 * Widen the rich `Schema` type to a bare JSON-Schema object for schema-to-library.
 * `Schema` is not structurally assignable to its `JSONSchema` (e.g. `x-emailPattern`
 * literal unions differ), so this `as`-free bridge erases the incompatible members.
 */
function toJsonSchema(schema: Schema): { readonly [k: string]: unknown } {
  return schema
}

/** Pull the bare expression out of a `export const X = <expr>` wrapper, then strip cross-schema refs. */
function extractExpr(code: string, stripRefs: (expr: string) => string = (s) => s) {
  const joined = code
    .split('\n')
    .filter((line) => !line.startsWith('import '))
    .join('\n')
    .trim()
  const match = joined.match(/^export const \w+ = (.+)$/su)
  const expr = match?.[1]
  if (expr !== undefined) return stripRefs(expr.replace(/;?\s*$/u, ''))
  return stripRefs(joined)
}

/** One factory per library; the mapped type makes a missing library a compile error. */
const ADAPTERS: { readonly [K in SchemaLib]: () => ComponentAdapter } = {
  zod: makeZodAdapter,
  valibot: makeValibotAdapter,
  arktype: makeArktypeAdapter,
  typebox: makeTypeboxAdapter,
  effect: makeEffectAdapter,
}

export function makeAdapter(lib: SchemaLib): ComponentAdapter {
  return ADAPTERS[lib]()
}

/** Inline `z.lazy(() => XSchema)` back to the bare `XSchema` reference. */
function stripZodLazy(code: string) {
  return code.replaceAll(/z\.lazy\(\(\)\s*=>\s*(\w+Schema)\)/gu, '$1')
}

/** Inline `v.lazy(() => XSchema)` back to the bare `XSchema` reference. */
function stripValibotLazy(code: string) {
  return code.replaceAll(/v\.lazy\(\(\)\s*=>\s*(\w+Schema)\)/gu, '$1')
}

function makeZodAdapter(): ComponentAdapter {
  return {
    toExpression(schema, paramIn) {
      return extractExpr(
        schemaToZod(toJsonSchema(schema), {
          exportType: false,
          openapi: true,
          readonly: false,
          ...(paramIn && { paramIn }),
        }),
        stripZodLazy,
      )
    },
    renderImport() {
      return "import * as z from 'zod'"
    },
    renderTypeInfer(constName) {
      return `export type ${constName}=z.infer<typeof ${constName}>`
    },
  }
}

function makeValibotAdapter(): ComponentAdapter {
  return {
    toExpression(schema, paramIn) {
      return extractExpr(
        schemaToValibot(toJsonSchema(schema), {
          exportType: false,
          openapi: true,
          readonly: false,
          ...(paramIn && { paramIn }),
        }),
        stripValibotLazy,
      )
    },
    renderImport() {
      return "import * as v from 'valibot'"
    },
    renderTypeInfer(constName) {
      return `export type ${constName}=v.InferOutput<typeof ${constName}>`
    },
  }
}

function makeArktypeAdapter(): ComponentAdapter {
  return {
    toExpression(schema, paramIn) {
      return extractExpr(
        schemaToArktype(toJsonSchema(schema), {
          exportType: false,
          openapi: true,
          readonly: false,
          ...(paramIn && { paramIn }),
        }),
      )
    },
    renderImport() {
      return "import { type } from 'arktype'"
    },
    renderTypeInfer(constName) {
      return `export type ${constName}=typeof ${constName}.infer`
    },
  }
}

function makeTypeboxAdapter(): ComponentAdapter {
  return {
    toExpression(schema, paramIn) {
      return extractExpr(
        schemaToTypebox(toJsonSchema(schema), {
          exportType: false,
          openapi: true,
          readonly: false,
          ...(paramIn && { paramIn }),
        }),
      )
    },
    renderImport() {
      return "import { Type } from '@sinclair/typebox'"
    },
    renderTypeInfer(constName) {
      return `export type ${constName}=Static<typeof ${constName}>`
    },
  }
}

function makeEffectAdapter(): ComponentAdapter {
  return {
    toExpression(schema, paramIn) {
      return extractExpr(
        schemaToEffect(toJsonSchema(schema), {
          exportType: false,
          openapi: true,
          readonly: false,
          ...(paramIn && { paramIn }),
        }),
      )
    },
    renderImport() {
      return "import { Schema } from 'effect'"
    },
    renderTypeInfer(constName) {
      return `export type ${constName}=Schema.Schema.Type<typeof ${constName}>`
    },
  }
}
