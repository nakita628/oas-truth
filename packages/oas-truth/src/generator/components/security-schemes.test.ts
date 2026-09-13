import { describe, expect, it } from 'vite-plus/test'

import type { Components } from '../../openapi/index.js'
import { makeSecuritySchemesCode, makeSecuritySchemesDeclarations } from './security-schemes.js'

describe('makeSecuritySchemesCode', () => {
  it('emits the security scheme object', () => {
    const components = {
      securitySchemes: { Bearer: { type: 'http', scheme: 'bearer' } },
    } as unknown as Components
    expect(makeSecuritySchemesCode(components, false)).toBe(
      'export const BearerSecurityScheme={type:"http",scheme:"bearer"}\n',
    )
  })

  it('appends as const when readonly', () => {
    const components = {
      securitySchemes: { B: { type: 'http' } },
    } as unknown as Components
    expect(makeSecuritySchemesCode(components, true)).toBe(
      'export const BSecurityScheme={type:"http"} as const\n',
    )
  })

  it('joins multiple schemes with a semicolon', () => {
    const components = {
      securitySchemes: {
        Bearer: { type: 'http', scheme: 'bearer' },
        ApiKey: { type: 'apiKey', name: 'X-Key', in: 'header' },
      },
    } as unknown as Components
    expect(makeSecuritySchemesCode(components, false)).toBe(
      'export const BearerSecurityScheme={type:"http",scheme:"bearer"};export const ApiKeySecurityScheme={type:"apiKey",name:"X-Key",in:"header"}\n',
    )
  })

  it('returns an empty string when securitySchemes is missing', () => {
    expect(makeSecuritySchemesCode({}, false)).toBe('')
  })

  it('returns an empty string when securitySchemes is empty', () => {
    expect(makeSecuritySchemesCode({ securitySchemes: {} }, false)).toBe('')
  })
})

describe('makeSecuritySchemesDeclarations', () => {
  it('returns entries without an import line', () => {
    const components = {
      securitySchemes: { A: { type: 'http' }, B: { type: 'apiKey' } },
    } as unknown as Components
    expect(makeSecuritySchemesDeclarations(components).map((d) => d.varName)).toStrictEqual([
      'ASecurityScheme',
      'BSecurityScheme',
    ])
    expect(makeSecuritySchemesDeclarations({})).toStrictEqual([])
  })
})
