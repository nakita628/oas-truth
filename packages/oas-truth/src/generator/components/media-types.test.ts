import { describe, expect, it } from 'vite-plus/test'

import { makeAdapter } from '../../adapter/index.js'
import type { Components } from '../../openapi/index.js'
import { makeMediaTypesCode, makeMediaTypesDeclarations } from './media-types.js'

const zod = makeAdapter('zod')

const oneString = {
  mediaTypes: { Json: { schema: { type: 'string' } } },
} as unknown as Components

describe('makeMediaTypesCode', () => {
  it('emits a zod media type schema', () => {
    expect(makeMediaTypesCode(oneString, zod)).toBe(
      "import * as z from 'zod'\n\nexport const JsonMediaTypeSchema=z.string()\n",
    )
  })

  it('appends a type alias when exportTypes is true', () => {
    expect(makeMediaTypesCode(oneString, zod, true)).toBe(
      "import * as z from 'zod'\n\nexport const JsonMediaTypeSchema=z.string()\n\nexport type JsonMediaTypeSchema=z.infer<typeof JsonMediaTypeSchema>\n",
    )
  })

  it('skips a $ref entry', () => {
    const components = {
      mediaTypes: { Shared: { $ref: '#/components/mediaTypes/Json' } },
    } as unknown as Components
    expect(makeMediaTypesCode(components, zod)).toBe('')
  })

  it('returns an empty string when mediaTypes is missing', () => {
    expect(makeMediaTypesCode({}, zod)).toBe('')
  })

  it('returns an empty string when mediaTypes is empty', () => {
    expect(makeMediaTypesCode({ mediaTypes: {} }, zod)).toBe('')
  })
})

describe('makeMediaTypesDeclarations', () => {
  it('returns the body without an import line', () => {
    expect(makeMediaTypesDeclarations(oneString, zod)).toStrictEqual([
      {
        name: 'Json',
        varName: 'JsonMediaTypeSchema',
        fileName: 'json',
        code: 'export const JsonMediaTypeSchema=z.string()',
      },
    ])
    expect(makeMediaTypesDeclarations(oneString, zod)[0]?.code.includes('import ')).toBe(false)
  })

  it('returns nothing when the kind is missing or only a $ref', () => {
    expect(makeMediaTypesDeclarations({}, zod)).toStrictEqual([])
    expect(
      makeMediaTypesDeclarations(
        { mediaTypes: { Shared: { $ref: '#/components/mediaTypes/Json' } } } as never,
        zod,
      ),
    ).toStrictEqual([])
  })
})
