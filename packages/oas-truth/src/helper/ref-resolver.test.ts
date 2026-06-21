import { describe, expect, it } from 'vite-plus/test'

import { valueToCode } from './ref-resolver.js'

describe('valueToCode primitives', () => {
  it('renders null', () => {
    expect(valueToCode(null)).toBe('null')
  })
  it('renders undefined', () => {
    expect(valueToCode(undefined)).toBe('undefined')
  })
  it('JSON-encodes strings (escaping quotes)', () => {
    expect(valueToCode('a"b')).toBe('"a\\"b"')
  })
  it('renders numbers', () => {
    expect(valueToCode(1)).toBe('1')
    expect(valueToCode(-1.5)).toBe('-1.5')
    expect(valueToCode(0)).toBe('0')
  })
  it('renders booleans', () => {
    expect(valueToCode(true)).toBe('true')
    expect(valueToCode(false)).toBe('false')
  })
  it('renders bigint without the n suffix', () => {
    expect(valueToCode(10n)).toBe('10')
  })
  it('falls back to null for unsupported values', () => {
    expect(valueToCode(() => undefined)).toBe('null')
  })
})

describe('valueToCode arrays', () => {
  it('renders an empty array', () => {
    expect(valueToCode([])).toBe('[]')
  })
  it('renders a mixed array', () => {
    expect(valueToCode([1, 'a', true, null])).toBe('[1,"a",true,null]')
  })
  it('renders nested arrays', () => {
    expect(valueToCode([[1], [2]])).toBe('[[1],[2]]')
  })
})

describe('valueToCode objects', () => {
  it('renders an empty object', () => {
    expect(valueToCode({})).toBe('{}')
  })
  it('keeps bare identifier keys unquoted', () => {
    expect(valueToCode({ a: 1 })).toBe('{a:1}')
  })
  it('quotes a hyphenated key', () => {
    expect(valueToCode({ 'a-b': 1 })).toBe('{"a-b":1}')
  })
  it('quotes a digit-leading key', () => {
    expect(valueToCode({ '200': 1 })).toBe('{"200":1}')
  })
  it('renders nested objects', () => {
    expect(valueToCode({ a: { b: 1 } })).toBe('{a:{b:1}}')
  })
})

describe('valueToCode $ref resolution', () => {
  it('resolves a schema $ref to a schema identifier', () => {
    expect(valueToCode({ $ref: '#/components/schemas/User' })).toBe('UserSchema')
  })
  it('decodes and identifier-cases a percent-encoded schema $ref', () => {
    expect(valueToCode({ $ref: '#/components/schemas/User%20Name' })).toBe('UserNameSchema')
  })
  it('ignores sibling keys once a schema $ref resolves', () => {
    expect(valueToCode({ $ref: '#/components/schemas/User', description: 'x' })).toBe('UserSchema')
  })
  it('renders a non-schema $ref as a plain object', () => {
    expect(valueToCode({ $ref: '#/components/responses/X' })).toBe(
      '{$ref:"#/components/responses/X"}',
    )
  })
  it('renders a non-string $ref as a plain object', () => {
    expect(valueToCode({ $ref: 123 })).toBe('{$ref:123}')
  })
})

describe('valueToCode critical edge cases', () => {
  it('breaks a self-referential object cycle instead of overflowing the stack', () => {
    const o: Record<string, unknown> = { type: 'object' }
    o.self = o
    expect(() => valueToCode(o)).not.toThrow()
    expect(valueToCode(o)).toBe('{type:"object",self:null}')
  })

  it('breaks a self-referential array cycle', () => {
    const a: unknown[] = []
    a.push(a)
    expect(valueToCode(a)).toBe('[null]')
  })

  it('emits null for non-finite numbers (no JSON form)', () => {
    expect(valueToCode(Number.NaN)).toBe('null')
    expect(valueToCode(Number.POSITIVE_INFINITY)).toBe('null')
    expect(valueToCode(Number.NEGATIVE_INFINITY)).toBe('null')
  })

  it('renders large and exponential numbers as valid literals', () => {
    expect(valueToCode(1e21)).toBe('1e+21')
    expect(valueToCode(Number.MAX_SAFE_INTEGER)).toBe('9007199254740991')
  })

  it('emits null for symbols (unsupported value)', () => {
    expect(valueToCode(Symbol('x'))).toBe('null')
  })

  it('resolves a $ref nested inside an array (oneOf/anyOf member)', () => {
    expect(valueToCode([{ $ref: '#/components/schemas/A' }, { type: 'string' }])).toBe(
      '[ASchema,{type:"string"}]',
    )
  })

  it('does not throw on a $ref with malformed percent-encoding', () => {
    expect(() => valueToCode({ $ref: '#/components/schemas/%ZZ' })).not.toThrow()
    expect(valueToCode({ $ref: '#/components/schemas/%ZZ' })).toBe('ZZSchema')
  })

  it('quotes empty, numeric, and control-character keys', () => {
    expect(valueToCode({ '': 1 })).toBe('{"":1}')
    expect(valueToCode({ '200': 1 })).toBe('{"200":1}')
    expect(valueToCode({ 'a\nb': 1 })).toBe('{"a\\nb":1}')
  })

  it('JSON-escapes special characters in string values', () => {
    expect(valueToCode('a"b\nc')).toBe('"a\\"b\\nc"')
  })
})

describe('valueToCode codeReplacements', () => {
  it('substitutes a value held by reference in the replacement map', () => {
    const inline = { type: 'string' }
    const replacements = new Map<unknown, string>([[inline, 'z.string()']])
    expect(valueToCode({ schema: inline }, replacements)).toBe('{schema:z.string()}')
  })
  it('does not substitute a structurally-equal but distinct object', () => {
    const inline = { type: 'string' }
    const replacements = new Map<unknown, string>([[inline, 'z.string()']])
    expect(valueToCode({ type: 'string' }, replacements)).toBe('{type:"string"}')
  })
})
