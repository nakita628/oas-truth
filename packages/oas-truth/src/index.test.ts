import { describe, expect, it } from 'vite-plus/test'

import {
  makeAdapter,
  makeResponsesCode,
  makeSchemaDeclarations,
  makeSchemasCode,
  makeSecuritySchemesCode,
  parseOpenAPI,
  schemaImportLine,
  toPascalCase,
  valueToCode,
} from './index.js'
import type { Components } from './index.js'

describe('public API barrel', () => {
  it('re-exports parseOpenAPI as a function', () => {
    expect(typeof parseOpenAPI).toBe('function')
  })

  it('re-exports a working adapter + component maker', () => {
    const components = {
      responses: {
        NotFound: {
          description: 'Not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    } as unknown as Components
    expect(makeResponsesCode(components, makeAdapter('zod'), false)).toBe(
      'export const NotFoundResponse={description:"Not found",content:{"application/json":{schema:ErrorSchema}}}',
    )
  })

  it('re-exports adapter-free makers', () => {
    const components = {
      securitySchemes: { Bearer: { type: 'http', scheme: 'bearer' } },
    } as unknown as Components
    expect(makeSecuritySchemesCode(components, false)).toBe(
      'export const BearerSecurityScheme={type:"http",scheme:"bearer"}\n',
    )
  })

  it('re-exports utils and ref-resolver', () => {
    expect(toPascalCase('created_at')).toBe('CreatedAt')
    expect(valueToCode({ $ref: '#/components/schemas/User' })).toBe('UserSchema')
  })

  it('re-exports the schemas builder', () => {
    const components = { schemas: { Tag: { type: 'string' } } } as unknown as Components
    expect(makeSchemasCode(components, makeAdapter('zod'))).toBe(
      "import * as z from 'zod'\n\nexport const TagSchema=z.string()\n",
    )
    expect(schemaImportLine(makeAdapter('arktype'), undefined, true)).toBe(
      "import { type, scope } from 'arktype'",
    )
    expect(
      makeSchemaDeclarations({ Tag: { type: 'string' } }, makeAdapter('zod'))[0]?.importLine,
    ).toBe("import * as z from 'zod'")
  })
})
