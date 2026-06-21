import { describe, expect, it } from 'vite-plus/test'

import {
  isRecord,
  makeSafeKey,
  makeSchemaVarName,
  schemaRefToName,
  toIdentifierPascalCase,
  toPascalCase,
} from './index.js'

describe('toPascalCase', () => {
  it('capitalizes a single word', () => {
    expect(toPascalCase('limit')).toBe('Limit')
  })
  it('joins underscore-separated words', () => {
    expect(toPascalCase('created_at')).toBe('CreatedAt')
  })
  it('joins hyphen-separated words', () => {
    expect(toPascalCase('x-total')).toBe('XTotal')
  })
  it('joins dot-separated words', () => {
    expect(toPascalCase('foo.bar')).toBe('FooBar')
  })
  it('collapses consecutive separators', () => {
    expect(toPascalCase('foo__bar')).toBe('FooBar')
  })
  it('leaves an already-PascalCase word unchanged', () => {
    expect(toPascalCase('Limit')).toBe('Limit')
  })
  it('returns an empty string for empty input', () => {
    expect(toPascalCase('')).toBe('')
  })
  it('does not identifier-escape a digit-leading word (no separator)', () => {
    expect(toPascalCase('1foo')).toBe('1foo')
  })
})

describe('toIdentifierPascalCase', () => {
  it('capitalizes a single word', () => {
    expect(toIdentifierPascalCase('User')).toBe('User')
  })
  it('joins separated words', () => {
    expect(toIdentifierPascalCase('user_profile')).toBe('UserProfile')
  })
  it('prefixes and escapes a digit-leading word', () => {
    expect(toIdentifierPascalCase('1foo')).toBe('_1Foo')
  })
  it('prefixes a digits-only word without inner escaping', () => {
    expect(toIdentifierPascalCase('123')).toBe('_123')
  })
  it('does not inner-escape when the char after the digit is uppercase', () => {
    expect(toIdentifierPascalCase('1Foo')).toBe('_1Foo')
  })
  it('falls back to Schema for empty input', () => {
    expect(toIdentifierPascalCase('')).toBe('Schema')
  })
  it('falls back to Schema for separator-only input', () => {
    expect(toIdentifierPascalCase('---')).toBe('Schema')
  })
  it('encodes non-ASCII characters as u<hex>', () => {
    expect(toIdentifierPascalCase('café')).toBe('Cafue9')
  })
  it('maps distinct non-ASCII names to distinct identifiers (injective)', () => {
    expect(toIdentifierPascalCase('あ')).not.toBe(toIdentifierPascalCase('い'))
  })
})

describe('schemaRefToName', () => {
  it('extracts the last segment', () => {
    expect(schemaRefToName('#/components/schemas/User')).toBe('User')
  })
  it('decodes percent-encoding', () => {
    expect(schemaRefToName('#/components/schemas/User%20Name')).toBe('User Name')
  })
  it('returns an empty string for empty input', () => {
    expect(schemaRefToName('')).toBe('')
  })
  it('returns an empty string for a trailing slash', () => {
    expect(schemaRefToName('/')).toBe('')
  })
  it('keeps dots in the segment', () => {
    expect(schemaRefToName('#/components/schemas/Foo.Bar')).toBe('Foo.Bar')
  })
})

describe('makeSafeKey', () => {
  it('leaves a bare identifier unquoted', () => {
    expect(makeSafeKey('limit')).toBe('limit')
  })
  it('leaves an underscore identifier unquoted', () => {
    expect(makeSafeKey('_x')).toBe('_x')
  })
  it('leaves a dollar identifier unquoted', () => {
    expect(makeSafeKey('$x')).toBe('$x')
  })
  it('quotes a hyphenated key', () => {
    expect(makeSafeKey('X-Request-ID')).toBe('"X-Request-ID"')
  })
  it('quotes a digit-leading key', () => {
    expect(makeSafeKey('200')).toBe('"200"')
  })
  it('quotes an empty key', () => {
    expect(makeSafeKey('')).toBe('""')
  })
  it('quotes a dotted key', () => {
    expect(makeSafeKey('a.b')).toBe('"a.b"')
  })
  it('does not quote a reserved word (valid object key in TS)', () => {
    expect(makeSafeKey('class')).toBe('class')
  })
})

describe('makeSchemaVarName', () => {
  it('resolves a schemas $ref to a schema identifier', () => {
    expect(makeSchemaVarName('#/components/schemas/User')).toBe('UserSchema')
  })
  it('decodes and identifier-cases a percent-encoded ref', () => {
    expect(makeSchemaVarName('#/components/schemas/User%20Name')).toBe('UserNameSchema')
  })
  it('returns undefined for a non-schema ref', () => {
    expect(makeSchemaVarName('#/components/responses/X')).toBe(undefined)
  })
  it('returns undefined for an unrelated string', () => {
    expect(makeSchemaVarName('User')).toBe(undefined)
  })
})

describe('critical identifier edge cases', () => {
  it('schemaRefToName falls back to raw on malformed percent-encoding (no throw)', () => {
    expect(() => schemaRefToName('#/components/schemas/%ZZ')).not.toThrow()
    expect(schemaRefToName('#/components/schemas/%ZZ')).toBe('%ZZ')
  })

  it('makeSchemaVarName survives a malformed percent-encoded ref', () => {
    expect(() => makeSchemaVarName('#/components/schemas/%ZZ')).not.toThrow()
    expect(makeSchemaVarName('#/components/schemas/%ZZ')).toBe('ZZSchema')
  })

  it('makeSchemaVarName greedily captures a slashed ref tail (current behavior)', () => {
    expect(makeSchemaVarName('#/components/schemas/a/b')).toBe('ABSchema')
  })

  it('toIdentifierPascalCase escapes only the first digit-letter boundary (current behavior)', () => {
    expect(toIdentifierPascalCase('1a2b')).toBe('_1A2b')
  })

  it('toIdentifierPascalCase encodes a surrogate-pair emoji by codepoint', () => {
    expect(toIdentifierPascalCase('😀')).toBe('U1f600')
  })

  it('toIdentifierPascalCase collides separator variants (known non-injective case)', () => {
    expect(toIdentifierPascalCase('user-profile')).toBe('UserProfile')
    expect(toIdentifierPascalCase('user_profile')).toBe('UserProfile')
    expect(toIdentifierPascalCase('user.profile')).toBe('UserProfile')
  })

  it('makeSafeKey leaves __proto__ bare (valid identifier shape)', () => {
    expect(makeSafeKey('__proto__')).toBe('__proto__')
  })

  it('makeSafeKey quotes control-character keys safely', () => {
    expect(makeSafeKey('a\nb')).toBe('"a\\nb"')
  })
})

describe('isRecord', () => {
  it('is true for a plain object', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ a: 1 })).toBe(true)
  })
  it('is true for a null-prototype object', () => {
    expect(isRecord(Object.create(null))).toBe(true)
  })
  it('is false for null', () => {
    expect(isRecord(null)).toBe(false)
  })
  it('is false for an array', () => {
    expect(isRecord([])).toBe(false)
  })
  it('is false for primitives', () => {
    expect(isRecord('s')).toBe(false)
    expect(isRecord(1)).toBe(false)
    expect(isRecord(true)).toBe(false)
    expect(isRecord(undefined)).toBe(false)
  })
})
