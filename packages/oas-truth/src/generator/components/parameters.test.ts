import { describe, expect, it } from 'vite-plus/test'

import { makeAdapter } from '../../adapter/index.js'
import type { Components } from '../../openapi/index.js'
import { makeParametersCode } from './parameters.js'

const zod = makeAdapter('zod')
const valibot = makeAdapter('valibot')
const arktype = makeAdapter('arktype')
const effect = makeAdapter('effect')

describe('makeParametersCode', () => {
  it('coerces a zod query param and appends a z.infer alias when requested', () => {
    const components = {
      parameters: {
        Limit: { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1 } },
      },
    } as unknown as Components
    expect(makeParametersCode(components, zod, true)).toBe(
      "import * as z from 'zod'\n\nexport const LimitParamsSchema=z.coerce.number().int().min(1)\n\nexport type LimitParamsSchema=z.infer<typeof LimitParamsSchema>\n",
    )
  })

  it('omits the type alias by default', () => {
    const components = {
      parameters: { Limit: { name: 'limit', in: 'query', schema: { type: 'integer' } } },
    } as unknown as Components
    expect(makeParametersCode(components, zod)).toBe(
      "import * as z from 'zod'\n\nexport const LimitParamsSchema=z.coerce.number().int()\n",
    )
  })

  it('coerces a valibot query param with a v.InferOutput alias', () => {
    const components = {
      parameters: {
        Limit: { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1 } },
      },
    } as unknown as Components
    expect(makeParametersCode(components, valibot, true)).toBe(
      "import * as v from 'valibot'\n\nexport const LimitParamsSchema=v.pipe(v.string(),v.transform(Number),v.number(),v.integer(),v.minValue(1))\n\nexport type LimitParamsSchema=v.InferOutput<typeof LimitParamsSchema>\n",
    )
  })

  it('coerces an arktype query param with a typeof X.infer alias', () => {
    const components = {
      parameters: {
        Limit: { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1 } },
      },
    } as unknown as Components
    expect(makeParametersCode(components, arktype, true)).toBe(
      'import { type } from \'arktype\'\n\nexport const LimitParamsSchema=type("string.integer.parse").to("number.integer >= 1")\n\nexport type LimitParamsSchema=typeof LimitParamsSchema.infer\n',
    )
  })

  it('coerces an effect query param with a Schema.Schema.Type alias', () => {
    const components = {
      parameters: { Limit: { name: 'limit', in: 'query', schema: { type: 'integer' } } },
    } as unknown as Components
    expect(makeParametersCode(components, effect, true)).toBe(
      "import { Schema } from 'effect'\n\nexport const LimitParamsSchema=Schema.NumberFromString.pipe(Schema.int())\n\nexport type LimitParamsSchema=Schema.Schema.Type<typeof LimitParamsSchema>\n",
    )
  })

  it('coerces a path param', () => {
    const components = {
      parameters: { Id: { name: 'id', in: 'path', schema: { type: 'integer' } } },
    } as unknown as Components
    expect(makeParametersCode(components, zod)).toBe(
      "import * as z from 'zod'\n\nexport const IdParamsSchema=z.coerce.number().int()\n",
    )
  })

  it('does not coerce a non-path/query (header) param', () => {
    const components = {
      parameters: { Trace: { name: 'trace', in: 'header', schema: { type: 'integer' } } },
    } as unknown as Components
    expect(makeParametersCode(components, zod)).toBe(
      "import * as z from 'zod'\n\nexport const TraceParamsSchema=z.int()\n",
    )
  })

  it('joins multiple params with a semicolon', () => {
    const components = {
      parameters: {
        Limit: { name: 'limit', in: 'query', schema: { type: 'integer' } },
        Offset: { name: 'offset', in: 'query', schema: { type: 'integer' } },
      },
    } as unknown as Components
    expect(makeParametersCode(components, zod)).toBe(
      "import * as z from 'zod'\n\nexport const LimitParamsSchema=z.coerce.number().int();export const OffsetParamsSchema=z.coerce.number().int()\n",
    )
  })

  it('skips a param without a schema', () => {
    const components = {
      parameters: { X: { name: 'x', in: 'query' } },
    } as unknown as Components
    expect(makeParametersCode(components, zod)).toBe('')
  })

  it('returns an empty string when parameters is missing', () => {
    expect(makeParametersCode({} as Components, zod)).toBe('')
  })

  it('returns an empty string when parameters is empty', () => {
    expect(makeParametersCode({ parameters: {} } as Components, zod)).toBe('')
  })
})
