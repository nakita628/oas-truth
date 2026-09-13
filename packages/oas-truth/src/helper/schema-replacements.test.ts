import { describe, expect, it } from 'vite-plus/test'

import { makeSchemaReplacements } from './schema-replacements.js'

describe('makeSchemaReplacements detection', () => {
  it('replaces an inline schema under a `schema` key', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    const inline = { type: 'string' }
    const map = makeSchemaReplacements(
      { content: { 'application/json': { schema: inline } } },
      adapter,
    )
    expect(map.size).toBe(1)
    expect(map.get(inline)).toBe('EXPR')
  })

  it('detects each inline-schema keyword (properties/items/oneOf/anyOf/allOf/enum)', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    for (const inline of [
      { properties: {} },
      { items: {} },
      { oneOf: [] },
      { anyOf: [] },
      { allOf: [] },
      { enum: [] },
    ]) {
      const map = makeSchemaReplacements({ schema: inline }, adapter)
      expect(map.size).toBe(1)
      expect(map.get(inline)).toBe('EXPR')
    }
  })

  it('maps a $ref schema to its schema identifier (not the adapter expression)', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    const ref = { $ref: '#/components/schemas/X' }
    const map = makeSchemaReplacements({ schema: ref }, adapter)
    expect(map.size).toBe(1)
    expect(map.get(ref)).toBe('XSchema')
  })

  it('does not map a non-schema $ref', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    expect(
      makeSchemaReplacements({ schema: { $ref: '#/components/responses/X' } }, adapter).size,
    ).toBe(0)
  })

  it('passes the slot so a host can wrap only response content', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
      wrapSchema: (expr: string, slot?: string) =>
        slot === 'response-content' ? `resolver(${expr})` : expr,
    }
    const content = { type: 'string' }
    const header = { type: 'integer' }
    const map = makeSchemaReplacements(
      {
        content: { 'application/json': { schema: content } },
        headers: { X: { schema: header } },
      },
      adapter,
      { slot: 'response-content' },
    )
    expect(map.get(content)).toBe('resolver(EXPR)')
    expect(map.get(header)).toBe('EXPR')
  })

  it('applies wrapSchema to inline and $ref schema slots', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
      wrapSchema: (expr: string) => `resolver(${expr})`,
    }
    const inline = { type: 'string' }
    const ref = { $ref: '#/components/schemas/User' }
    const map = makeSchemaReplacements(
      { content: { 'application/json': { schema: inline }, 'application/xml': { schema: ref } } },
      adapter,
    )
    expect(map.get(inline)).toBe('resolver(EXPR)')
    expect(map.get(ref)).toBe('resolver(UserSchema)')
  })

  it('does not replace an inline-looking object under a non-`schema` key', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    expect(makeSchemaReplacements({ foo: { type: 'string' } }, adapter).size).toBe(0)
  })

  it('does not replace an empty or keyword-less schema', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    expect(makeSchemaReplacements({ schema: {} }, adapter).size).toBe(0)
    expect(makeSchemaReplacements({ schema: { description: 'x' } }, adapter).size).toBe(0)
  })
})

describe('makeSchemaReplacements critical edge cases', () => {
  it('does not overflow the stack on a circular structure', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    const node: Record<string, unknown> = { description: 'x' }
    node.self = node
    expect(() => makeSchemaReplacements(node, adapter)).not.toThrow()
    expect(makeSchemaReplacements(node, adapter).size).toBe(0)
  })

  it('dedupes a schema object referenced from multiple positions', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    const shared = { type: 'string' }
    const map = makeSchemaReplacements(
      {
        content: { 'application/json': { schema: shared }, 'application/xml': { schema: shared } },
      },
      adapter,
    )
    expect(map.size).toBe(1)
    expect(map.get(shared)).toBe('EXPR')
  })

  it('detects a const-only schema', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    const inline = { const: 'active' }
    expect(makeSchemaReplacements({ schema: inline }, adapter).get(inline)).toBe('EXPR')
  })

  it('detects a not-only schema', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    const inline = { not: { type: 'string' } }
    expect(makeSchemaReplacements({ schema: inline }, adapter).get(inline)).toBe('EXPR')
  })

  it('does not detect a keyword-less schema (e.g. format-only) — known heuristic limit', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    expect(makeSchemaReplacements({ schema: { format: 'email' } }, adapter).size).toBe(0)
  })
})

describe('makeSchemaReplacements recursion', () => {
  it('collects schemas across array elements', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    const a = { type: 'string' }
    const b = { type: 'number' }
    const map = makeSchemaReplacements({ items: [{ schema: a }, { schema: b }] }, adapter)
    expect(map.size).toBe(2)
    expect(map.get(a)).toBe('EXPR')
    expect(map.get(b)).toBe('EXPR')
  })

  it('collects a deeply nested schema', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    const inline = { type: 'string' }
    expect(makeSchemaReplacements({ a: { b: { schema: inline } } }, adapter).get(inline)).toBe(
      'EXPR',
    )
  })

  it('collects schemas from multiple distinct positions', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    const a = { type: 'string' }
    const b = { type: 'number' }
    const map = makeSchemaReplacements(
      { content: { 'application/json': { schema: a } }, headers: { X: { schema: b } } },
      adapter,
    )
    expect(map.size).toBe(2)
  })

  it('ignores null and primitive siblings', () => {
    const adapter = {
      renderImport: () => '',
      toExpression: () => 'EXPR',
      renderTypeInfer: () => '',
    }
    const inline = { type: 'string' }
    const map = makeSchemaReplacements({ schema: inline, x: null, y: 5, z: 'str' }, adapter)
    expect(map.size).toBe(1)
    expect(map.get(inline)).toBe('EXPR')
  })
})
