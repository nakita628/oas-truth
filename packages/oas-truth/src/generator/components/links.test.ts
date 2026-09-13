import { describe, expect, it } from 'vite-plus/test'

import type { Components } from '../../openapi/index.js'
import { makeLinksCode, makeLinksDeclarations } from './links.js'

describe('makeLinksCode', () => {
  it('emits the link object', () => {
    const components = {
      links: { Self: { operationId: 'get' } },
    } as unknown as Components
    expect(makeLinksCode(components, false)).toBe('export const SelfLink={operationId:"get"}\n')
  })

  it('appends as const when readonly', () => {
    const components = {
      links: { L: { operationId: 'g' } },
    } as unknown as Components
    expect(makeLinksCode(components, true)).toBe('export const LLink={operationId:"g"} as const\n')
  })

  it('joins multiple links with a semicolon', () => {
    const components = {
      links: { A: { operationId: 'a' }, B: { operationId: 'b' } },
    } as unknown as Components
    expect(makeLinksCode(components, false)).toBe(
      'export const ALink={operationId:"a"};export const BLink={operationId:"b"}\n',
    )
  })

  it('returns an empty string when links is missing', () => {
    expect(makeLinksCode({}, false)).toBe('')
  })

  it('returns an empty string when links is empty', () => {
    expect(makeLinksCode({ links: {} }, false)).toBe('')
  })
})

describe('makeLinksDeclarations', () => {
  it('returns entries without an import line', () => {
    const components = {
      links: { A: { operationId: 'a' }, B: { operationId: 'b' } },
    } as unknown as Components
    expect(makeLinksDeclarations(components).map((d) => d.varName)).toStrictEqual([
      'ALink',
      'BLink',
    ])
    expect(makeLinksDeclarations({})).toStrictEqual([])
  })
})
