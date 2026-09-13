import { describe, expect, it } from 'vite-plus/test'

import { analyzeSchemas, collectSchemaRefs, makeCyclicType } from './graph.js'

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })

describe('collectSchemaRefs', () => {
  it('finds component schema refs at any depth, decoding names', () => {
    expect(
      collectSchemaRefs({
        properties: { a: ref('A'), list: { type: 'array', items: ref('B') } },
        oneOf: [ref('%E6%97%A5')],
        other: { $ref: '#/components/responses/R' },
      }),
    ).toStrictEqual(['A', 'B', '日'])
  })
})

describe('analyzeSchemas', () => {
  it('orders dependencies first and groups every cycle', () => {
    const { order, cycles } = analyzeSchemas({
      User: { properties: { posts: { items: ref('Post') }, tag: ref('Tag') } },
      Post: { properties: { author: ref('User') } },
      Tag: {},
      Tree: { properties: { children: { items: ref('Tree') } } },
      Leaf: { properties: { tree: ref('Tree') } },
    } as never)
    expect(order).toStrictEqual(['Tag', 'User', 'Post', 'Tree', 'Leaf'])
    expect([...cycles]).toStrictEqual([
      ['User', ['User', 'Post']],
      ['Post', ['User', 'Post']],
      ['Tree', ['Tree']],
    ])
  })
})

const infer = (name: string) => `z.infer<typeof ${name}Schema>`

describe('makeCyclicType', () => {
  it('refers to itself by the type name and to other schemas through infer', () => {
    expect(
      makeCyclicType(
        'Node',
        'NodeType',
        {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'integer' },
            kind: { enum: ['a', 'b'] },
            parent: { oneOf: [ref('Node'), { type: 'null' }] },
            children: { type: 'array', items: ref('Node') },
            owner: ref('User'),
            meta: { type: 'object', additionalProperties: { type: 'string' } },
            label: { type: ['string', 'null'] },
          },
        } as never,
        infer,
        false,
      ),
    ).toBe(
      'type NodeType={"id":number;"kind"?:"a"|"b";"parent"?:(NodeType|null);"children"?:(NodeType)[];"owner"?:z.infer<typeof UserSchema>;"meta"?:{[key:string]:string};"label"?:(string|null)}',
    )
  })

  it('marks properties and arrays readonly', () => {
    expect(
      makeCyclicType(
        'Node',
        'NodeType',
        {
          type: 'object',
          properties: { children: { type: 'array', items: ref('Node') } },
        } as never,
        infer,
        true,
      ),
    ).toBe('type NodeType={readonly "children"?:readonly (NodeType)[]}')
  })

  it('adds | undefined on optional fields when the library infers that', () => {
    expect(
      makeCyclicType(
        'Node',
        'NodeType',
        {
          type: 'object',
          properties: { children: { type: 'array', items: ref('Node') } },
        } as never,
        infer,
        false,
        { optionalUndefined: true },
      ),
    ).toBe('type NodeType={"children"?:(NodeType)[]|undefined}')
  })

  it('marks arrays readonly and optionals undefined for Effect', () => {
    expect(
      makeCyclicType(
        'Node',
        'NodeType',
        {
          type: 'object',
          properties: { children: { type: 'array', items: ref('Node') } },
        } as never,
        infer,
        false,
        { optionalUndefined: true, readonlyArrays: true },
      ),
    ).toBe('type NodeType={"children"?:readonly (NodeType)[]|undefined}')
  })
})
