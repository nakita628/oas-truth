import { describe, expect, it } from 'vite-plus/test'

import { makeAdapter } from '../../adapter/index.js'
import type { Components } from '../../openapi/index.js'
import { makeHeadersCode } from './headers.js'

const zod = makeAdapter('zod')
const valibot = makeAdapter('valibot')
const arktype = makeAdapter('arktype')

describe('makeHeadersCode', () => {
  it('emits a zod header schema (no coercion)', () => {
    const components = {
      headers: { 'X-Total': { schema: { type: 'integer', minimum: 0 } } },
    } as unknown as Components
    expect(makeHeadersCode(components, zod)).toBe(
      "import * as z from 'zod'\n\nexport const XTotalHeaderSchema=z.int().min(0)\n",
    )
  })

  it('appends a z.infer alias when requested', () => {
    const components = {
      headers: { RateLimit: { schema: { type: 'integer' } } },
    } as unknown as Components
    expect(makeHeadersCode(components, zod, true)).toBe(
      "import * as z from 'zod'\n\nexport const RateLimitHeaderSchema=z.int()\n\nexport type RateLimitHeaderSchema=z.infer<typeof RateLimitHeaderSchema>\n",
    )
  })

  it('emits a valibot header with a v.InferOutput alias', () => {
    const components = {
      headers: { RateLimit: { schema: { type: 'integer' } } },
    } as unknown as Components
    expect(makeHeadersCode(components, valibot, true)).toBe(
      "import * as v from 'valibot'\n\nexport const RateLimitHeaderSchema=v.pipe(v.number(),v.integer())\n\nexport type RateLimitHeaderSchema=v.InferOutput<typeof RateLimitHeaderSchema>\n",
    )
  })

  it('emits an arktype header with a typeof X.infer alias', () => {
    const components = {
      headers: { RateLimit: { schema: { type: 'integer' } } },
    } as unknown as Components
    expect(makeHeadersCode(components, arktype, true)).toBe(
      'import { type } from \'arktype\'\n\nexport const RateLimitHeaderSchema=type("number.integer")\n\nexport type RateLimitHeaderSchema=typeof RateLimitHeaderSchema.infer\n',
    )
  })

  it('joins multiple headers with a semicolon', () => {
    const components = {
      headers: {
        A: { schema: { type: 'string' } },
        B: { schema: { type: 'string' } },
      },
    } as unknown as Components
    expect(makeHeadersCode(components, zod)).toBe(
      "import * as z from 'zod'\n\nexport const AHeaderSchema=z.string();export const BHeaderSchema=z.string()\n",
    )
  })

  it('skips a header without a schema', () => {
    const components = {
      headers: { X: { description: 'd' } },
    } as unknown as Components
    expect(makeHeadersCode(components, zod)).toBe('')
  })

  it('skips a $ref header (no schema member)', () => {
    const components = {
      headers: { X: { $ref: '#/components/headers/Shared' } },
    } as unknown as Components
    expect(makeHeadersCode(components, zod)).toBe('')
  })

  it('returns an empty string when headers is missing', () => {
    expect(makeHeadersCode({}, zod)).toBe('')
  })

  it('returns an empty string when headers is empty', () => {
    expect(makeHeadersCode({ headers: {} }, zod)).toBe('')
  })
})
