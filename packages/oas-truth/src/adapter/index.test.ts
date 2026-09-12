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

describe('toExpression coerces path/query params', () => {
  it('adds z.coerce for an integer query param', () => {
    expect(makeAdapter('zod').toExpression({ type: 'integer' }, 'query')).toBe(
      'z.coerce.number().int()',
    )
  })
})
