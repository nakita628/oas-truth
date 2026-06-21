import fs from 'node:fs'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'

import { parseOpenAPI } from './index.js'

describe('parseOpenAPI', () => {
  it.concurrent('should return ok for a valid OpenAPI YAML string', async () => {
    const result = await parseOpenAPI({
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      components: {
        schemas: {
          Test: {
            type: 'object',
            required: ['test'],
            properties: {
              test: {
                type: 'string',
              },
            },
          },
        },
      },
      paths: {
        '/test': {
          post: {
            summary: 'Test endpoint',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Test',
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Successful test',
              },
            },
          },
        },
      },
    } as unknown as string)
    expect(result.ok).toBe(true)
  })

  it.concurrent('should return err for a completely invalid input', async () => {
    const result = await parseOpenAPI('not yaml nor json')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(typeof result.error).toBe('string')
    }
  })

  it.concurrent('returns the bundled document as value (faithful round-trip)', async () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'T', version: '1.0.0' },
      paths: {
        '/items': {
          get: { responses: { '200': { description: 'ok' } } },
        },
      },
    }
    const result = await parseOpenAPI(doc as unknown as string)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toStrictEqual(doc)
  })

  it.concurrent('folds an unresolvable URL into err instead of throwing', async () => {
    const result = await parseOpenAPI('http://example.invalid/openapi.json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(typeof result.error).toBe('string')
  })

  it.concurrent('rejects an internal-address URL (swagger-parser safe resolver)', async () => {
    const result = await parseOpenAPI('http://127.0.0.1:1/openapi.json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(typeof result.error).toBe('string')
  })
})

// TypeSpec test
// Temp files live under the package dir so the TypeSpec compiler resolves
// @typespec/* from packages/oas-truth/node_modules (cwd-independent).
const TSP_TEST_DIR = path.resolve(import.meta.dirname, '../..')
const TSP_TEST_FILE = `${TSP_TEST_DIR}/tmp-spec.tsp`
const TSP_TEST_SUBDIR = `${TSP_TEST_DIR}/tmp`

describe('parseOpenAPI TypeSpec', () => {
  beforeEach(() => {
    fs.rmSync(TSP_TEST_FILE, { force: true })
    fs.rmSync(TSP_TEST_SUBDIR, { recursive: true, force: true })
  })
  afterEach(() => {
    fs.rmSync(TSP_TEST_FILE, { force: true })
    fs.rmSync(TSP_TEST_SUBDIR, { recursive: true, force: true })
  })
  it('typeSpecToOpenAPI not Error', { timeout: 30000 }, async () => {
    const tmpTsp = `import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

@service(#{ title: "Widget Service" })
namespace DemoService;
using Rest;
using Http;
using OpenAPI;

model WidgetBase {
  @key id: string;
  weight: int32;
  color: "red" | "blue";
}

enum WidgetKind {
  Heavy,
  Light,
}

model HeavyWidget extends WidgetBase {
  kind: WidgetKind.Heavy;
}

model LightWidget extends WidgetBase {
  kind: WidgetKind.Light;
}

@discriminated
union Widget {
  heavy: HeavyWidget,
  light: LightWidget,
}

@error
model Error {
  code: int32;
  message: string;
}

@get op read(@path id: string): Widget | Error;
`
    fs.writeFileSync(TSP_TEST_FILE, tmpTsp)
    const result = await parseOpenAPI(TSP_TEST_FILE)
    if (!result.ok) {
      console.error('TypeSpec error:', result.error)
    }
    expect(result.ok).toBe(true)
  })

  it('typeSpecToOpenAPI dir not Error', { timeout: 30000 }, async () => {
    const tmpTsp = `import "@typespec/http";
import "@typespec/rest";
import "@typespec/openapi3";

@service(#{ title: "Widget Service" })
namespace DemoService;
using Rest;
using Http;
using OpenAPI;

model WidgetBase {
  @key id: string;
  weight: int32;
  color: "red" | "blue";
}

enum WidgetKind {
  Heavy,
  Light,
}

model HeavyWidget extends WidgetBase {
  kind: WidgetKind.Heavy;
}

model LightWidget extends WidgetBase {
  kind: WidgetKind.Light;
}

@discriminated
union Widget {
  heavy: HeavyWidget,
  light: LightWidget,
}

@error
model Error {
  code: int32;
  message: string;
}

@get op read(@path id: string): Widget | Error;
`
    fs.mkdirSync(TSP_TEST_SUBDIR, { recursive: true })
    fs.writeFileSync(`${TSP_TEST_SUBDIR}/tmp-spec.tsp`, tmpTsp)
    const result = await parseOpenAPI(`${TSP_TEST_SUBDIR}/tmp-spec.tsp`)
    expect(result.ok).toBe(true)
  })

  it('typeSpecToOpenAPI Error', { timeout: 10000 }, async () => {
    const tmpTsp = `import "@typespec`
    fs.writeFileSync(TSP_TEST_FILE, tmpTsp)
    const result = await parseOpenAPI(TSP_TEST_FILE)
    expect(result.ok).toBe(false)
  })

  it('resolves the first document of a @versioned namespace', { timeout: 30000 }, async () => {
    const tmpTsp = `import "@typespec/http";
import "@typespec/versioning";

using Http;
using Versioning;

@service(#{ title: "Versioned" })
@versioned(Versions)
namespace VersionedService;

enum Versions {
  v1,
  v2,
}

@get op read(): string;
`
    fs.writeFileSync(TSP_TEST_FILE, tmpTsp)
    const result = await parseOpenAPI(TSP_TEST_FILE)
    if (!result.ok) console.error('versioning error:', result.error)
    expect(result.ok).toBe(true)
  })
})
