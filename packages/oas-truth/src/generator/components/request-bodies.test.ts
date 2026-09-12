import { describe, expect, it } from 'vite-plus/test'

import { makeAdapter } from '../../adapter/index.js'
import type { Components } from '../../openapi/index.js'
import { makeRequestBodiesCode } from './request-bodies.js'

const zod = makeAdapter('zod')
const valibot = makeAdapter('valibot')
const arktype = makeAdapter('arktype')

const inlineBody = {
  requestBodies: {
    CreatePost: {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['title'],
            properties: { title: { type: 'string' } },
          },
        },
      },
    },
  },
} as unknown as Components

describe('makeRequestBodiesCode', () => {
  it('resolves a $ref schema to a schema constant', () => {
    const components = {
      requestBodies: {
        Create: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePost' } } },
        },
      },
    } as unknown as Components
    expect(makeRequestBodiesCode(components, zod, false)).toBe(
      'export const CreateRequestBody={required:true,content:{"application/json":{schema:CreatePostSchema}}}',
    )
  })

  it('inlines a non-$ref schema as zod', () => {
    expect(makeRequestBodiesCode(inlineBody, zod, false)).toBe(
      'export const CreatePostRequestBody={content:{"application/json":{schema:z.object({title:z.string()})}}}',
    )
  })

  it('inlines a non-$ref schema as valibot', () => {
    expect(makeRequestBodiesCode(inlineBody, valibot, false)).toBe(
      'export const CreatePostRequestBody={content:{"application/json":{schema:v.object({title:v.string()})}}}',
    )
  })

  it('inlines a non-$ref schema as arktype', () => {
    expect(makeRequestBodiesCode(inlineBody, arktype, false)).toBe(
      'export const CreatePostRequestBody={content:{"application/json":{schema:type({title:"string"})}}}',
    )
  })

  it('appends as const when readonly', () => {
    const components = {
      requestBodies: { R: { required: true } },
    } as unknown as Components
    expect(makeRequestBodiesCode(components, zod, true)).toBe(
      'export const RRequestBody={required:true} as const',
    )
  })

  it('joins multiple request bodies with a semicolon', () => {
    const components = {
      requestBodies: {
        A: { required: true },
        B: { required: false },
      },
    } as unknown as Components
    expect(makeRequestBodiesCode(components, zod, false)).toBe(
      'export const ARequestBody={required:true};export const BRequestBody={required:false}',
    )
  })

  it('returns an empty string when requestBodies is missing', () => {
    expect(makeRequestBodiesCode({}, zod, false)).toBe('')
  })

  it('returns an empty string when requestBodies is empty', () => {
    expect(makeRequestBodiesCode({ requestBodies: {} }, zod, false)).toBe('')
  })
})
