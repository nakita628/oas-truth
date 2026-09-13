import { describe, expect, it } from 'vite-plus/test'

import { makeAdapter } from '../../adapter/index.js'
import type { Components } from '../../openapi/index.js'
import { makePathItemsCode, makePathItemsDeclarations } from './path-items.js'

const zod = makeAdapter('zod')

describe('makePathItemsCode', () => {
  it('emits a path item object', () => {
    const components = {
      pathItems: { Item: { get: { responses: { '200': { description: 'OK' } } } } },
    } as unknown as Components
    expect(makePathItemsCode(components, zod, false)).toBe(
      'export const ItemPathItem={get:{responses:{"200":{description:"OK"}}}}',
    )
  })

  it('resolves a $ref schema inside an operation', () => {
    const components = {
      pathItems: {
        Item: {
          post: {
            requestBody: {
              content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
            },
          },
        },
      },
    } as unknown as Components
    expect(makePathItemsCode(components, zod, false)).toBe(
      'export const ItemPathItem={post:{requestBody:{content:{"application/json":{schema:UserSchema}}}}}',
    )
  })

  it('inlines a non-$ref schema inside an operation as zod', () => {
    const components = {
      pathItems: {
        Item: {
          post: {
            requestBody: {
              content: { 'application/json': { schema: { type: 'string' } } },
            },
          },
        },
      },
    } as unknown as Components
    expect(makePathItemsCode(components, zod, false)).toBe(
      'export const ItemPathItem={post:{requestBody:{content:{"application/json":{schema:z.string()}}}}}',
    )
  })

  it('appends as const when readonly', () => {
    const components = {
      pathItems: { P: { summary: 's' } },
    } as unknown as Components
    expect(makePathItemsCode(components, zod, true)).toBe(
      'export const PPathItem={summary:"s"} as const',
    )
  })

  it('joins multiple path items with a semicolon', () => {
    const components = {
      pathItems: { A: { summary: 'a' }, B: { summary: 'b' } },
    } as unknown as Components
    expect(makePathItemsCode(components, zod, false)).toBe(
      'export const APathItem={summary:"a"};export const BPathItem={summary:"b"}',
    )
  })

  it('returns an empty string when pathItems is missing', () => {
    expect(makePathItemsCode({}, zod, false)).toBe('')
  })

  it('returns an empty string when pathItems is empty', () => {
    expect(makePathItemsCode({ pathItems: {} }, zod, false)).toBe('')
  })
})

describe('makePathItemsDeclarations', () => {
  it('returns entries without an import line', () => {
    expect(
      makePathItemsDeclarations(
        { pathItems: { Item: { get: {} }, Other: { get: {} } } } as never,
        zod,
      ).map((d) => d.varName),
    ).toStrictEqual(['ItemPathItem', 'OtherPathItem'])
    expect(makePathItemsDeclarations({}, zod)).toStrictEqual([])
  })
})
