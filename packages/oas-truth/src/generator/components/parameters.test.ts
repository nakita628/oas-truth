import { describe, expect, it } from 'vite-plus/test'

import { makeAdapter } from '../../adapter/index.js'
import type { Components } from '../../openapi/index.js'
import { makeParametersCode, makeParametersDeclarations } from './parameters.js'

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
      "import * as v from 'valibot'\n\nexport const LimitParamsSchema=v.pipe(v.string(),v.transform(Number),v.number(),v.safeInteger(),v.minValue(1))\n\nexport type LimitParamsSchema=v.InferOutput<typeof LimitParamsSchema>\n",
    )
  })

  it('coerces an arktype query param with a typeof X.infer alias', () => {
    const components = {
      parameters: {
        Limit: { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1 } },
      },
    } as unknown as Components
    expect(makeParametersCode(components, arktype, true)).toBe(
      'import { type } from \'arktype\'\n\nexport const LimitParamsSchema=type("string").pipe((data, ctx) => { const value = Number(data); return Number.isSafeInteger(value) ? value : ctx.error("an integer") }).to("number.integer >= 1")\n\nexport type LimitParamsSchema=typeof LimitParamsSchema.infer\n',
    )
  })

  it('coerces an effect query param with a Schema.Schema.Type alias', () => {
    const components = {
      parameters: { Limit: { name: 'limit', in: 'query', schema: { type: 'integer' } } },
    } as unknown as Components
    expect(makeParametersCode(components, effect, true)).toBe(
      "import { Schema } from 'effect'\n\nexport const LimitParamsSchema=Schema.FiniteFromString.check(Schema.isInt())\n\nexport type LimitParamsSchema=Schema.Schema.Type<typeof LimitParamsSchema>\n",
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

  it('coerces a header param', () => {
    const components = {
      parameters: { Trace: { name: 'trace', in: 'header', schema: { type: 'integer' } } },
    } as unknown as Components
    expect(makeParametersCode(components, zod)).toBe(
      "import * as z from 'zod'\n\nexport const TraceParamsSchema=z.coerce.number().int()\n",
    )
  })

  it('coerces a cookie param', () => {
    const components = {
      parameters: { Session: { name: 'session', in: 'cookie', schema: { type: 'boolean' } } },
    } as unknown as Components
    expect(makeParametersCode(components, zod)).toBe(
      "import * as z from 'zod'\n\nexport const SessionParamsSchema=z.stringbool()\n",
    )
  })

  it('splits a form param with explode: false on commas', () => {
    const components = {
      parameters: {
        Ids: {
          name: 'ids',
          in: 'query',
          style: 'form',
          explode: false,
          schema: { type: 'array', items: { type: 'integer' } },
        },
      },
    } as unknown as Components
    expect(makeParametersCode(components, zod)).toBe(
      "import * as z from 'zod'\n\nexport const IdsParamsSchema=z.preprocess((val)=>{if(typeof val!=='string')return val;const text=val;return (text===''?[]:text.split(\",\"))},z.preprocess((val)=>(val===undefined||Array.isArray(val)?val:[val]),z.array(z.coerce.number().int())))\n",
    )
  })

  it('gathers a deepObject param from its bracketed keys', () => {
    const components = {
      parameters: {
        Filter: {
          name: 'filter',
          in: 'query',
          style: 'deepObject',
          explode: true,
          schema: { type: 'object', properties: { q: { type: 'string' } } },
        },
      },
    } as unknown as Components
    expect(makeParametersCode(components, valibot)).toBe(
      "import * as v from 'valibot'\n\nexport const FilterParamsSchema=v.pipe(v.unknown(),v.transform((input)=>{if(typeof input!=='object'||input===null||Array.isArray(input))return input;const out=Object.entries(input).reduce<{[k:string]:unknown}>((acc,[key,value])=>{const name=/^[^[\\]]+\\[([^\\]]+)\\]$/u.exec(key)?.[1];return name===undefined?acc:{...acc,[name]:value}},{});return Object.keys(out).length>0?out:input}),v.partial(v.object({q:v.string()})))\n",
    )
  })

  it('reads an empty value as absent with allowEmptyValue', () => {
    const components = {
      parameters: {
        Flag: { name: 'flag', in: 'query', allowEmptyValue: true, schema: { type: 'string' } },
      },
    } as unknown as Components
    expect(makeParametersCode(components, zod)).toBe(
      "import * as z from 'zod'\n\nexport const FlagParamsSchema=z.preprocess((val)=>(val===''?undefined:val),z.string())\n",
    )
  })

  it('ignores a style schema-to-library does not know', () => {
    const components = {
      parameters: {
        Ids: {
          name: 'ids',
          in: 'path',
          style: 'unknown',
          schema: { type: 'array', items: { type: 'integer' } },
        },
      },
    } as unknown as Components
    expect(makeParametersCode(components, zod)).toBe(
      makeParametersCode(
        {
          parameters: {
            Ids: { name: 'ids', in: 'path', schema: { type: 'array', items: { type: 'integer' } } },
          },
        },
        zod,
      ),
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
    expect(makeParametersCode({}, zod)).toBe('')
  })

  it('returns an empty string when parameters is empty', () => {
    expect(makeParametersCode({ parameters: {} }, zod)).toBe('')
  })
})

describe('makeParametersDeclarations', () => {
  it('returns one entry without an import line', () => {
    const components = {
      parameters: { Limit: { name: 'limit', in: 'query', schema: { type: 'integer' } } },
    } as unknown as Components
    expect(makeParametersDeclarations(components, zod)).toStrictEqual([
      {
        name: 'Limit',
        varName: 'LimitParamsSchema',
        fileName: 'limit',
        code: 'export const LimitParamsSchema=z.coerce.number().int()',
      },
    ])
  })

  it('returns two entries and nothing for a missing kind', () => {
    const components = {
      parameters: {
        Limit: { name: 'limit', in: 'query', schema: { type: 'integer' } },
        Offset: { name: 'offset', in: 'query', schema: { type: 'integer' } },
      },
    } as unknown as Components
    expect(makeParametersDeclarations(components, zod).map((d) => d.name)).toStrictEqual([
      'Limit',
      'Offset',
    ])
    expect(makeParametersDeclarations({}, zod)).toStrictEqual([])
  })

  it('does not wrap a parameter when wrapSchema checks for response-content', () => {
    const hook = {
      ...zod,
      wrapSchema: (expr: string, slot?: string) =>
        slot === 'response-content' ? `resolver(${expr})` : expr,
    }
    const components = {
      parameters: { Limit: { name: 'limit', in: 'query', schema: { type: 'integer' } } },
    } as unknown as Components
    expect(makeParametersDeclarations(components, hook)[0]?.code).toBe(
      'export const LimitParamsSchema=z.coerce.number().int()',
    )
  })
})
