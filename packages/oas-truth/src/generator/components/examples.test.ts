import { describe, expect, it } from 'vite-plus/test'

import type { Components } from '../../openapi/index.js'
import { makeExamplesCode } from './examples.js'

describe('makeExamplesCode', () => {
  it('emits the example value', () => {
    const components = {
      examples: { One: { summary: 's', value: { id: 1 } } },
    } as unknown as Components
    expect(makeExamplesCode(components, false)).toBe(
      'export const OneExample={summary:"s",value:{id:1}}\n',
    )
  })

  it('appends as const when readonly', () => {
    const components = {
      examples: { X: { value: 1 } },
    } as unknown as Components
    expect(makeExamplesCode(components, true)).toBe('export const XExample={value:1} as const\n')
  })

  it('joins multiple examples with a semicolon', () => {
    const components = {
      examples: { A: { value: 1 }, B: { value: 2 } },
    } as unknown as Components
    expect(makeExamplesCode(components, false)).toBe(
      'export const AExample={value:1};export const BExample={value:2}\n',
    )
  })

  it('returns an empty string when examples is missing', () => {
    expect(makeExamplesCode({} as Components, false)).toBe('')
  })

  it('returns an empty string when examples is empty', () => {
    expect(makeExamplesCode({ examples: {} } as Components, false)).toBe('')
  })
})
