import { describe, expect, it } from 'vite-plus/test'

import type { Schema } from '../openapi/index.js'
import { makeAdapter } from './index.js'

describe('renderImport', () => {
  it('zod', () => {
    expect(makeAdapter('zod').renderImport()).toBe("import * as z from 'zod'")
  })
  it('valibot', () => {
    expect(makeAdapter('valibot').renderImport()).toBe("import * as v from 'valibot'")
  })
  it('arktype', () => {
    expect(makeAdapter('arktype').renderImport()).toBe("import { type } from 'arktype'")
  })
  it('effect', () => {
    expect(makeAdapter('effect').renderImport()).toBe("import { Schema } from 'effect'")
  })
  it('typebox', () => {
    expect(makeAdapter('typebox').renderImport()).toBe("import { Type } from '@sinclair/typebox'")
  })
})

describe('renderTypeInfer', () => {
  it('zod', () => {
    expect(makeAdapter('zod').renderTypeInfer('FooSchema')).toBe(
      'export type FooSchema=z.infer<typeof FooSchema>',
    )
  })
  it('valibot', () => {
    expect(makeAdapter('valibot').renderTypeInfer('FooSchema')).toBe(
      'export type FooSchema=v.InferOutput<typeof FooSchema>',
    )
  })
  it('arktype', () => {
    expect(makeAdapter('arktype').renderTypeInfer('FooSchema')).toBe(
      'export type FooSchema=typeof FooSchema.infer',
    )
  })
  it('effect', () => {
    expect(makeAdapter('effect').renderTypeInfer('FooSchema')).toBe(
      'export type FooSchema=Schema.Schema.Type<typeof FooSchema>',
    )
  })
  it('typebox', () => {
    expect(makeAdapter('typebox').renderTypeInfer('FooSchema')).toBe(
      'export type FooSchema=Static<typeof FooSchema>',
    )
  })
})

describe('toExpression strips the export wrapper and routes per library', () => {
  it('zod', () => {
    expect(makeAdapter('zod').toExpression({ type: 'string' })).toBe('z.string()')
  })
  it('valibot', () => {
    expect(makeAdapter('valibot').toExpression({ type: 'string' })).toBe('v.string()')
  })
  it('arktype', () => {
    expect(makeAdapter('arktype').toExpression({ type: 'string' })).toBe('type("string")')
  })
  it('effect', () => {
    expect(makeAdapter('effect').toExpression({ type: 'string' })).toBe('Schema.String')
  })
  it('typebox', () => {
    expect(makeAdapter('typebox').toExpression({ type: 'string' })).toBe('Type.String()')
  })
})

describe('toExpression for a complex object schema (per library)', () => {
  const schema: Schema = {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer' }, name: { type: 'string' } },
  }
  it('zod', () => {
    expect(makeAdapter('zod').toExpression(schema)).toBe(
      'z.object({id:z.int(),name:z.string().exactOptional()})',
    )
  })
  it('valibot', () => {
    expect(makeAdapter('valibot').toExpression(schema)).toBe(
      'v.object({id:v.pipe(v.number(),v.integer()),name:v.optional(v.string())})',
    )
  })
  it('arktype', () => {
    expect(makeAdapter('arktype').toExpression(schema)).toBe(
      'type({id:"number.integer","name?":"string"})',
    )
  })
  it('typebox', () => {
    expect(makeAdapter('typebox').toExpression(schema)).toBe(
      'Type.Object({id:Type.Integer(),name:Type.Optional(Type.String())})',
    )
  })
  it('effect', () => {
    expect(makeAdapter('effect').toExpression(schema)).toBe(
      'Schema.Struct({id:Schema.Number.check(Schema.isInt()),name:Schema.optional(Schema.String)})',
    )
  })
})

describe('toExpression for an enum schema (per library)', () => {
  const schema: Schema = { type: 'string', enum: ['a', 'b'] }
  it('zod', () => {
    expect(makeAdapter('zod').toExpression(schema)).toBe('z.enum(["a","b"])')
  })
  it('arktype', () => {
    expect(makeAdapter('arktype').toExpression(schema)).toBe("type(\"'a' | 'b'\")")
  })
})

describe('wrapSchema', () => {
  it('is undefined by default (host-agnostic)', () => {
    expect(makeAdapter('zod').wrapSchema).toBe(undefined)
  })
})

describe('cycle helpers', () => {
  it('zod wraps a lazy reference and annotates TS7022', () => {
    const adapter = makeAdapter('zod')
    expect(adapter.wrapLazy?.('NodeSchema')).toBe('z.lazy(() => NodeSchema)')
    expect(adapter.cyclicAnnotation?.('NodeType')).toBe('z.ZodType<NodeType>')
  })

  it('valibot wraps a lazy reference and annotates TS7022', () => {
    const adapter = makeAdapter('valibot')
    expect(adapter.wrapLazy?.('NodeSchema')).toBe('v.lazy(() => NodeSchema)')
    expect(adapter.cyclicAnnotation?.('NodeType')).toBe('v.GenericSchema<NodeType>')
  })

  it('effect strips suspend and re-wraps it for a cycle', () => {
    const adapter = makeAdapter('effect')
    expect(
      adapter.toExpression({
        type: 'array',
        items: { $ref: '#/components/schemas/User' },
      }),
    ).toBe('Schema.Array(UserSchema)')
    expect(adapter.wrapLazy?.('NodeSchema')).toBe('Schema.suspend(() => NodeSchema)')
    expect(adapter.cyclicAnnotation?.('NodeType')).toBe('Schema.Codec<any>')
  })

  it('arktype extracts a scope container and aliases externals', () => {
    const adapter = makeAdapter('arktype')
    expect(
      adapter.renderCyclic?.(
        'ASchema',
        'const types = scope({ASchema:{"b?":"BSchema"}}).export()\n\nexport const ASchema = types.ASchema',
        ['TagSchema'],
      ),
    ).toBe('scope({TagSchema:TagSchema,ASchema:{"b?":"BSchema"}}).export().ASchema')
  })

  it('typebox has no lazy wrapper (cycles use Type.Cyclic)', () => {
    expect(makeAdapter('typebox').wrapLazy).toBe(undefined)
    expect(makeAdapter('typebox').renderCyclic).toBe(undefined)
  })
})

describe('toExpression coerces path/query params', () => {
  it('adds z.coerce for an integer query param', () => {
    expect(makeAdapter('zod').toExpression({ type: 'integer' }, 'query')).toBe(
      'z.coerce.number().int()',
    )
  })
})

describe('toExpression maps RFC 3339 date-time and time (valibot 0.4.1)', () => {
  it.each([
    ['date-time', 'v.pipe(v.string(),v.isoTimestamp())'],
    ['time', 'v.pipe(v.string(),v.isoTimeSecond())'],
  ] as const)('maps format %s', (format, expected) => {
    expect(makeAdapter('valibot').toExpression({ type: 'string', format })).toBe(expected)
  })
})
