import { describe, expect, it } from 'vite-plus/test'

import { wrapReferences } from './identifiers.js'

const wrap = (name: string) => `z.lazy(() => ${name})`

describe('wrapReferences', () => {
  it('wraps identifiers that are in the set', () => {
    expect(
      wrapReferences('z.object({b:BSchema.exactOptional()})', new Set(['BSchema']), wrap),
    ).toBe('z.object({b:z.lazy(() => BSchema).exactOptional()})')
  })

  it('leaves identifiers that are not in the set', () => {
    expect(
      wrapReferences('z.object({tag:TagSchema.exactOptional()})', new Set(['BSchema']), wrap),
    ).toBe('z.object({tag:TagSchema.exactOptional()})')
  })

  it('does not wrap identifier-shaped text inside a string', () => {
    expect(wrapReferences("Type.Ref('NodeSchema')", new Set(['NodeSchema']), wrap)).toBe(
      "Type.Ref('NodeSchema')",
    )
  })

  it('returns the expression unchanged when the set is empty', () => {
    expect(wrapReferences('NodeSchema', new Set(), wrap)).toBe('NodeSchema')
  })
})
