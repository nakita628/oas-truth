import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'

import { makeAdapter } from '../../adapter/index.js'
import type { Components, Schema } from '../../openapi/index.js'
import { makeSchemaDeclarations, makeSchemasCode, schemaImportLine } from './schemas.js'

const tmpDir = path.resolve(import.meta.dirname, '../../../tmp-schemas')

const zod = makeAdapter('zod')
const arktype = makeAdapter('arktype')
const typebox = makeAdapter('typebox')

const libs = ['zod', 'valibot', 'arktype', 'typebox', 'effect'] as const

const selfCycle = {
  Node: {
    type: 'object',
    properties: { children: { type: 'array', items: { $ref: '#/components/schemas/Node' } } },
  },
} as const

const mutualCycle = {
  A: { type: 'object', properties: { b: { $ref: '#/components/schemas/B' } } },
  B: {
    type: 'object',
    properties: {
      a: { $ref: '#/components/schemas/A' },
      tag: { $ref: '#/components/schemas/Tag' },
    },
  },
  Tag: { type: 'string' },
} as const

const colliding = {
  user: { type: 'string' },
  User: { type: 'integer' },
} as const

describe('makeSchemasCode', () => {
  it('returns an empty string when schemas is missing', () => {
    expect(makeSchemasCode({}, zod)).toBe('')
  })

  it('returns an empty string when schemas is empty', () => {
    expect(makeSchemasCode({ schemas: {} }, zod)).toBe('')
  })

  it('emits a zod schema with a z.infer alias when requested', () => {
    const components = { schemas: { Tag: { type: 'string' } } } as unknown as Components
    expect(makeSchemasCode(components, zod, { exportTypes: true })).toBe(
      "import * as z from 'zod'\n\nexport const TagSchema=z.string()\n\nexport type TagSchema=z.infer<typeof TagSchema>\n",
    )
  })

  it('names the exported type after the OpenAPI key when typeAlias is key', () => {
    const components = { schemas: { Tag: { type: 'string' } } } as unknown as Components
    expect(makeSchemasCode(components, zod, { exportTypes: true, typeAlias: 'key' })).toBe(
      "import * as z from 'zod'\n\nexport const TagSchema=z.string()\n\nexport type Tag=z.infer<typeof TagSchema>\n",
    )
  })

  it('applies wrapDeclaration around each expression', () => {
    const components = { schemas: { Tag: { type: 'string' } } } as unknown as Components
    expect(
      makeSchemasCode(components, zod, {
        wrapDeclaration: (expr, name) => `${expr}.meta({ref:${JSON.stringify(name)}})`,
      }),
    ).toBe('import * as z from \'zod\'\n\nexport const TagSchema=z.string().meta({ref:"Tag"})\n')
  })
})

describe('makeSchemaDeclarations', () => {
  it('emits dependencies first and unwraps references outside a cycle', () => {
    const schemas = {
      Pet: {
        type: 'object',
        description: 'A pet',
        required: ['name'],
        properties: { name: { type: 'string' }, tag: { $ref: '#/components/schemas/Tag' } },
      },
      Tag: { type: 'string' },
      ...selfCycle,
    } as unknown as { readonly [k: string]: Schema }
    expect(makeSchemaDeclarations(schemas, zod, { exportTypes: true })).toStrictEqual([
      {
        name: 'Tag',
        varName: 'TagSchema',
        fileName: 'tag',
        importLine: "import * as z from 'zod'",
        code: 'export const TagSchema=z.string()\n\nexport type TagSchema=z.infer<typeof TagSchema>',
      },
      {
        name: 'Pet',
        varName: 'PetSchema',
        fileName: 'pet',
        importLine: "import * as z from 'zod'",
        code: 'export const PetSchema=z.object({name:z.string(),tag:TagSchema.exactOptional()}).meta({description:"A pet"})\n\nexport type PetSchema=z.infer<typeof PetSchema>',
      },
      {
        name: 'Node',
        varName: 'NodeSchema',
        fileName: 'node',
        importLine: "import * as z from 'zod'",
        code: 'type NodeType={"children"?:(NodeType)[]}\n\nexport const NodeSchema:z.ZodType<NodeType>=z.object({children:z.array(z.lazy(() => NodeSchema)).exactOptional()})\n\nexport type NodeSchema=z.infer<typeof NodeSchema>',
      },
    ])
  })

  it.each([
    [
      'valibot',
      'export const PetSchema=v.pipe(v.object({name:v.string(),tag:v.optional(TagSchema)}),v.description("A pet"))',
      'type NodeType={"children"?:(NodeType)[]|undefined}\n\nexport const NodeSchema:v.GenericSchema<NodeType>=v.partial(v.object({children:v.array(v.lazy(() => NodeSchema))}))',
    ],
    [
      'typebox',
      'export const PetSchema=Type.Object({name:Type.String(),tag:Type.Optional(TagSchema)},{description:"A pet"})',
      "export const NodeSchema=Type.Cyclic({\nNodeSchema: Type.Object({children:Type.Optional(Type.Array(Type.Ref('NodeSchema')))})\n},'NodeSchema')",
    ],
    [
      'arktype',
      'export const PetSchema=type({name:"string","tag?":TagSchema}).describe("A pet")',
      'export const NodeSchema=scope({NodeSchema:{"children?":"NodeSchema[]"}}).export().NodeSchema',
    ],
    [
      'effect',
      'export const PetSchema=Schema.Struct({name:Schema.String,tag:Schema.optional(TagSchema)}).annotate({description:"A pet"})',
      'type NodeType={"children"?:readonly (NodeType)[]|undefined}\n\nexport const NodeSchema:Schema.Codec<NodeType>=Schema.Struct({children:Schema.optional(Schema.Array(Schema.suspend(() => NodeSchema)))})',
    ],
  ] as const)('%s: declares a dependency and a self-cycle', (lib, pet, node) => {
    const schemas = {
      Pet: {
        type: 'object',
        description: 'A pet',
        required: ['name'],
        properties: { name: { type: 'string' }, tag: { $ref: '#/components/schemas/Tag' } },
      },
      Tag: { type: 'string' },
      ...selfCycle,
    } as unknown as { readonly [k: string]: Schema }
    expect(
      makeSchemaDeclarations(schemas, makeAdapter(lib))
        .map((d) => d.code)
        .slice(1),
    ).toStrictEqual([pet, node])
  })

  it('carries readonly into the schemas and the recursive type', () => {
    const schemas = {
      Tag: { type: 'string' },
      Pet: {
        type: 'object',
        description: 'A pet',
        required: ['name'],
        properties: { name: { type: 'string' }, tag: { $ref: '#/components/schemas/Tag' } },
      },
      ...selfCycle,
    } as unknown as { readonly [k: string]: Schema }
    expect(
      makeSchemaDeclarations(schemas, zod, { readonly: true }).map((d) => d.code),
    ).toStrictEqual([
      'export const TagSchema=z.string()',
      'export const PetSchema=z.object({name:z.string(),tag:TagSchema.exactOptional()}).readonly().meta({description:"A pet"})',
      'type NodeType={readonly "children"?:readonly (NodeType)[]}\n\nexport const NodeSchema:z.ZodType<NodeType>=z.object({children:z.array(z.lazy(() => NodeSchema)).readonly().exactOptional()}).readonly()',
    ])
  })

  it.each([
    [
      'zod',
      [
        'export const TagSchema=z.string()',
        'type AType={"b"?:z.infer<typeof BSchema>}\n\nexport const ASchema:z.ZodType<AType>=z.object({b:z.lazy(() => BSchema).exactOptional()})',
        'type BType={"a"?:z.infer<typeof ASchema>;"tag"?:z.infer<typeof TagSchema>}\n\nexport const BSchema:z.ZodType<BType>=z.object({a:z.lazy(() => ASchema).exactOptional(),tag:TagSchema.exactOptional()})',
      ],
    ],
    [
      'valibot',
      [
        'export const TagSchema=v.string()',
        'type AType={"b"?:v.InferOutput<typeof BSchema>|undefined}\n\nexport const ASchema:v.GenericSchema<AType>=v.partial(v.object({b:v.lazy(() => BSchema)}))',
        'type BType={"a"?:v.InferOutput<typeof ASchema>|undefined;"tag"?:v.InferOutput<typeof TagSchema>|undefined}\n\nexport const BSchema:v.GenericSchema<BType>=v.partial(v.object({a:v.lazy(() => ASchema),tag:TagSchema}))',
      ],
    ],
    [
      'typebox',
      [
        'export const TagSchema=Type.String()',
        "export const ASchema=Type.Cyclic({\nBSchema: Type.Object({a:Type.Optional(Type.Ref('ASchema')),tag:Type.Optional(TagSchema)}),\nASchema: Type.Object({b:Type.Optional(Type.Ref('BSchema'))})\n},'ASchema')",
        "export const BSchema=Type.Cyclic({\nASchema: Type.Object({b:Type.Optional(Type.Ref('BSchema'))}),\nBSchema: Type.Object({a:Type.Optional(Type.Ref('ASchema')),tag:Type.Optional(TagSchema)})\n},'BSchema')",
      ],
    ],
    [
      'arktype',
      [
        'export const TagSchema=type("string")',
        'export const ASchema=scope({TagSchema:TagSchema,BSchema:{"a?":"ASchema","tag?":"TagSchema"},ASchema:{"b?":"BSchema"}}).export().ASchema',
        'export const BSchema=scope({TagSchema:TagSchema,BSchema:{"a?":"ASchema","tag?":"TagSchema"},ASchema:{"b?":"BSchema"}}).export().BSchema',
      ],
    ],
    [
      'effect',
      [
        'export const TagSchema=Schema.String',
        'type AType={"b"?:Schema.Schema.Type<typeof BSchema>|undefined}\n\nexport const ASchema:Schema.Codec<AType>=Schema.Struct({b:Schema.optional(Schema.suspend(() => BSchema))})',
        'type BType={"a"?:Schema.Schema.Type<typeof ASchema>|undefined;"tag"?:Schema.Schema.Type<typeof TagSchema>|undefined}\n\nexport const BSchema:Schema.Codec<BType>=Schema.Struct({a:Schema.optional(Schema.suspend(() => ASchema)),tag:Schema.optional(TagSchema)})',
      ],
    ],
  ] as const)('%s: a mutual cycle shares one container per member', (lib, expected) => {
    expect(
      makeSchemaDeclarations(mutualCycle as never, makeAdapter(lib)).map((d) => d.code),
    ).toStrictEqual(expected)
  })

  it.each(libs)('%s: colliding keys get a numeric suffix', (lib) => {
    const declarations = makeSchemaDeclarations(colliding, makeAdapter(lib))
    expect(declarations.map((d) => [d.name, d.varName, d.fileName])).toStrictEqual([
      ['user', 'UserSchema', 'user'],
      ['User', 'User2Schema', 'user2'],
    ])
  })

  it('joins colliding zod declarations with a semicolon', () => {
    expect(makeSchemasCode({ schemas: colliding }, zod)).toBe(
      "import * as z from 'zod'\n\nexport const UserSchema=z.string();export const User2Schema=z.int()\n",
    )
  })

  it('imports scope when arktype needs a cyclic container', () => {
    expect(makeSchemasCode({ schemas: selfCycle }, arktype)).toBe(
      'import { type, scope } from \'arktype\'\n\nexport const NodeSchema=scope({NodeSchema:{"children?":"NodeSchema[]"}}).export().NodeSchema\n',
    )
  })

  it('returns the arktype scope import on a cyclic declaration and type on the rest', () => {
    const declarations = makeSchemaDeclarations({ Tag: { type: 'string' }, ...selfCycle }, arktype)
    expect(
      declarations.map((d) => [
        d.name,
        d.importLine,
        d.code.includes('type('),
        d.code.includes('scope('),
      ]),
    ).toStrictEqual([
      ['Tag', "import { type } from 'arktype'", true, false],
      ['Node', "import { type, scope } from 'arktype'", false, true],
    ])
  })

  it('keeps the Zod-shaped helper when cyclicTypeStyle is literal', () => {
    expect(
      makeSchemaDeclarations(selfCycle, makeAdapter('valibot'), { cyclicTypeStyle: 'literal' })[0]
        ?.code,
    ).toBe(
      'type NodeType={"children"?:(NodeType)[]}\n\nexport const NodeSchema:v.GenericSchema<NodeType>=v.partial(v.object({children:v.array(v.lazy(() => NodeSchema))}))',
    )
  })

  it('schemaImportLine upgrades arktype and typebox from the adapter flags', () => {
    expect(schemaImportLine(arktype)).toBe("import { type } from 'arktype'")
    expect(schemaImportLine(arktype, undefined, true)).toBe("import { type, scope } from 'arktype'")
    expect(schemaImportLine(typebox, { exportTypes: true })).toBe(
      "import { Type, type Static } from '@sinclair/typebox'",
    )
  })

  it('imports Static when typebox exports types', () => {
    expect(
      makeSchemasCode({ schemas: { Tag: { type: 'string' } } } as never, typebox, {
        exportTypes: true,
      }),
    ).toBe(
      "import { Type, type Static } from '@sinclair/typebox'\n\nexport const TagSchema=Type.String()\n\nexport type TagSchema=Static<typeof TagSchema>\n",
    )
  })

  it('returns nothing for no schemas', () => {
    expect(makeSchemaDeclarations({}, zod)).toStrictEqual([])
  })
})

function rewriteTypeboxImport(code: string) {
  return code.replaceAll("'@sinclair/typebox'", "'typebox'")
}

const tscBin = path.resolve(import.meta.dirname, '../../../node_modules/typescript/bin/tsc')

function typecheck(fileName: string, source: string, extraArgs: readonly string[] = []) {
  fs.mkdirSync(tmpDir, { recursive: true })
  const file = path.join(tmpDir, fileName)
  fs.writeFileSync(file, rewriteTypeboxImport(source))
  try {
    execFileSync(
      tscBin,
      [
        '--pretty',
        'false',
        '--ignoreConfig',
        '--noEmit',
        '--strict',
        '--skipLibCheck',
        '--module',
        'nodenext',
        '--moduleResolution',
        'nodenext',
        '--target',
        'es2022',
        ...extraArgs,
        file,
      ],
      { encoding: 'utf8', cwd: path.resolve(tmpDir, '..') },
    )
    return ''
  } catch (error) {
    return error instanceof Error && 'stdout' in error ? String(error.stdout) : String(error)
  }
}

const exactOptional = ['--exactOptionalPropertyTypes', '--noUncheckedIndexedAccess'] as const

const commentCycle = {
  Comment: {
    type: 'object',
    required: ['body'],
    properties: {
      body: { type: 'string' },
      replies: { type: 'array', items: { $ref: '#/components/schemas/Comment' } },
    },
  },
} as const

const helperLibs = ['zod', 'valibot', 'effect'] as const

describe('generated schemas type-check and run', () => {
  beforeEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it.each(libs)('%s: a self-cycle type-checks', { timeout: 30_000 }, (lib) => {
    const code = makeSchemasCode({ schemas: selfCycle }, makeAdapter(lib), {
      exportTypes: true,
    })
    expect(typecheck(`${lib}-self.ts`, code)).toBe('')
  })

  it.each(libs)(
    '%s: a mutual cycle that references the outside type-checks',
    { timeout: 30_000 },
    (lib) => {
      const code = makeSchemasCode({ schemas: mutualCycle }, makeAdapter(lib), {
        exportTypes: true,
      })
      expect(typecheck(`${lib}-mutual.ts`, code)).toBe('')
    },
  )

  it('zod without the cyclic annotation fails TS7022', () => {
    const code = makeSchemasCode({ schemas: selfCycle }, zod).replace(':z.ZodType<NodeType>', '')
    expect(typecheck('zod-no-annotation.ts', code)).toContain('TS7022')
  })

  it.each(helperLibs)(
    '%s: a self-cycle type-checks under exactOptionalPropertyTypes',
    { timeout: 30_000 },
    (lib) => {
      const code = makeSchemasCode({ schemas: selfCycle }, makeAdapter(lib), {
        exportTypes: true,
      })
      expect(typecheck(`${lib}-self-exact.ts`, code, exactOptional)).toBe('')
    },
  )

  it.each(helperLibs)(
    '%s: a mutual cycle type-checks under exactOptionalPropertyTypes',
    { timeout: 30_000 },
    (lib) => {
      const code = makeSchemasCode({ schemas: mutualCycle }, makeAdapter(lib), {
        exportTypes: true,
      })
      expect(typecheck(`${lib}-mutual-exact.ts`, code, exactOptional)).toBe('')
    },
  )

  it('effect: a recursive Comment is Schema.Codec<CommentType> and rejects a bad body', () => {
    const code = makeSchemasCode({ schemas: commentCycle }, makeAdapter('effect'), {
      exportTypes: true,
    })
    expect(code).toContain('Schema.Codec<CommentType>')
    expect(typecheck('effect-comment.ts', code, exactOptional)).toBe('')
    expect(
      typecheck(
        'effect-comment-bad.ts',
        `${code}\nconst _bad: CommentSchema = { body: 123 }\n`,
        exactOptional,
      ),
    ).toContain('TS2322')
  })

  it('arktype accepts a tree and rejects a bad child', async () => {
    const file = path.join(tmpDir, 'arktype-run.mts')
    fs.writeFileSync(file, makeSchemasCode({ schemas: selfCycle }, arktype))
    const { NodeSchema: parseNode } = (await import(pathToFileURL(file).href)) as {
      NodeSchema: (value: unknown) => unknown
    }
    const { type } = await import('arktype')
    expect(parseNode({ children: [] }) instanceof type.errors).toBe(false)
    expect(parseNode({ children: 'nope' }) instanceof type.errors).toBe(true)
  })

  it('typebox accepts a tree and rejects a bad child', async () => {
    const source = `${rewriteTypeboxImport(makeSchemasCode({ schemas: selfCycle }, typebox))}
import { Value } from 'typebox/value'
export const ok = Value.Check(NodeSchema, { children: [] })
export const bad = Value.Check(NodeSchema, { children: 'nope' })
`
    const file = path.join(tmpDir, 'typebox-run.mts')
    fs.writeFileSync(file, source)
    const { ok, bad } = (await import(pathToFileURL(file).href)) as {
      ok: boolean
      bad: boolean
    }
    expect(ok).toBe(true)
    expect(bad).toBe(false)
  })
})
