// `Cafue9` is `café` with its non-ASCII code point encoded, the identifier under test.
// cspell:ignore Cafue
import { describe, expect, it } from 'vite-plus/test'

import { makeAdapter } from '../../adapter/index.js'
import type { Components } from '../../openapi/index.js'
import { makeResponsesCode } from './responses.js'

const zod = makeAdapter('zod')
const valibot = makeAdapter('valibot')
const arktype = makeAdapter('arktype')

describe('makeResponsesCode', () => {
  it('resolves a $ref schema to a schema constant', () => {
    const components = {
      responses: {
        NotFound: {
          description: 'Not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    } as unknown as Components
    expect(makeResponsesCode(components, zod, false)).toBe(
      'export const NotFoundResponse={description:"Not found",content:{"application/json":{schema:ErrorSchema}}}',
    )
  })

  it('inlines a non-$ref schema as a zod expression', () => {
    const components = {
      responses: {
        Created: {
          description: 'ok',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { id: { type: 'integer' } } },
            },
          },
        },
      },
    } as unknown as Components
    expect(makeResponsesCode(components, zod, false)).toBe(
      'export const CreatedResponse={description:"ok",content:{"application/json":{schema:z.object({id:z.int().exactOptional()})}}}',
    )
  })

  it('inlines a non-$ref schema as a valibot expression', () => {
    const components = {
      responses: {
        Created: {
          description: 'ok',
          content: {
            'application/json': {
              schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
            },
          },
        },
      },
    } as unknown as Components
    expect(makeResponsesCode(components, valibot, false)).toBe(
      'export const CreatedResponse={description:"ok",content:{"application/json":{schema:v.object({id:v.string()})}}}',
    )
  })

  it('keeps $ref schemas bare under arktype', () => {
    const components = {
      responses: {
        NotFound: {
          description: 'Not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    } as unknown as Components
    expect(makeResponsesCode(components, arktype, false)).toBe(
      'export const NotFoundResponse={description:"Not found",content:{"application/json":{schema:ErrorSchema}}}',
    )
  })

  it('appends as const when readonly', () => {
    const components = {
      responses: { Empty: { description: 'No content' } },
    } as unknown as Components
    expect(makeResponsesCode(components, zod, true)).toBe(
      'export const EmptyResponse={description:"No content"} as const',
    )
  })

  it('joins multiple responses with a semicolon', () => {
    const components = {
      responses: {
        Ok: { description: 'ok' },
        Bad: { description: 'bad' },
      },
    } as unknown as Components
    expect(makeResponsesCode(components, zod, false)).toBe(
      'export const OkResponse={description:"ok"};export const BadResponse={description:"bad"}',
    )
  })

  it('drops $ref responses but keeps sibling inline responses', () => {
    const components = {
      responses: {
        Ref: { $ref: '#/components/responses/Shared' },
        Ok: { description: 'ok' },
      },
    } as unknown as Components
    expect(makeResponsesCode(components, zod, false)).toBe(
      'export const OkResponse={description:"ok"}',
    )
  })

  it('resolves $ref and inlines non-$ref schemas within one response', () => {
    const components = {
      responses: {
        Mixed: {
          description: 'd',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/User' } },
            'application/xml': { schema: { type: 'string' } },
          },
        },
      },
    } as unknown as Components
    expect(makeResponsesCode(components, zod, false)).toBe(
      'export const MixedResponse={description:"d",content:{"application/json":{schema:UserSchema},"application/xml":{schema:z.string()}}}',
    )
  })

  it('returns an empty string when responses is missing', () => {
    expect(makeResponsesCode({}, zod, false)).toBe('')
  })

  it('returns an empty string when responses is empty', () => {
    expect(makeResponsesCode({ responses: {} }, zod, false)).toBe('')
  })

  it('returns an empty string when every response is a $ref', () => {
    const components = {
      responses: { R: { $ref: '#/components/responses/X' } },
    } as unknown as Components
    expect(makeResponsesCode(components, zod, false)).toBe('')
  })

  it('escapes a digit-leading component name into a valid TS identifier', () => {
    const components = { responses: { '1xx': { description: 'ok' } } } as unknown as Components
    expect(makeResponsesCode(components, zod, false)).toBe(
      'export const _1XxResponse={description:"ok"}',
    )
  })

  it('escapes a non-ASCII component name into a valid TS identifier', () => {
    const components = { responses: { café: { description: 'ok' } } } as unknown as Components
    expect(makeResponsesCode(components, zod, false)).toBe(
      'export const Cafue9Response={description:"ok"}',
    )
  })

  it('wraps inline and $ref content schemas via a host wrapSchema hook (hono-openapi resolver)', () => {
    const honoAdapter = { ...zod, wrapSchema: (expr: string) => `resolver(${expr})` }
    const components = {
      responses: {
        Mixed: {
          description: 'd',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/User' } },
            'application/xml': { schema: { type: 'string' } },
          },
        },
      },
    } as unknown as Components
    expect(makeResponsesCode(components, honoAdapter, false)).toBe(
      'export const MixedResponse={description:"d",content:{"application/json":{schema:resolver(UserSchema)},"application/xml":{schema:resolver(z.string())}}}',
    )
  })
})
