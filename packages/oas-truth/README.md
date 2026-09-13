# oas-truth

Read OpenAPI / TypeSpec as the single source of truth and get a typed `OpenAPI` document back.

## Installation

```sh
npm install oas-truth
```

## Quick Start

```ts
import { parseOpenAPI } from 'oas-truth'

const result = await parseOpenAPI('openapi.yaml') // supports .json / .yaml / .tsp

if (result.ok) {
  result.value // resolved, typed OpenAPI document
} else {
  console.error(result.error)
}
```

`parseOpenAPI` does the following:

- OpenAPI files (`.json` / `.yaml`) are bundled with `@apidevtools/swagger-parser` to resolve `$ref`
- TypeSpec files (`.tsp`) are compiled with `@typespec/compiler` and then bundled
- Returns `{ ok: true, value } | { ok: false, error }` (never throws)

## Component schemas

`makeSchemasCode` emits one file: the library import and every `components.schemas` declaration, in
dependency order. `makeSchemaDeclarations` returns the same declarations one by one (`name`,
`varName`, `fileName`, `importLine`, `code`) so a host can split a file per schema.

Recursive `$ref` cycles keep a helper type so the const can be annotated (`z.ZodType<NodeType>`,
`v.GenericSchema<NodeType>`, `Schema.Codec<NodeType>`). That helper matches what the library
infers — `| undefined` on Valibot and Effect optionals, `readonly` arrays on Effect — so it
type-checks under `exactOptionalPropertyTypes`. Arktype cycles become
`scope({...}).export().Member`; that declaration's `importLine` is then
`import { type, scope } from 'arktype'`. `schemaImportLine` is the same function
`makeSchemasCode` uses when the declarations stay in one file.

Every other component kind has the same split: `make<Kind>Declarations` returns `{ name,
varName, fileName, code }` with no import line, and `make<Kind>Code` joins those bodies.
`makeMediaTypesCode` covers `components.mediaTypes`. `makeSchemaIdentifiers` is the collision
map (`user` / `User` → `User` / `User2`); `$ref`s resolve through it, so a later collider is
`User2Schema`.

`wrapSchema(expr, slot)` is slot-aware (`response-content`, `request-content`, `header`,
`parameter`, `media-type`). TypeBox imports from `typebox` and reserves `Compile`. Pass
`{ ref: true }` to `makeSchemaDeclarations` to register the OpenAPI key — TypeBox writes it
into the outermost builder options; the other libraries use an outer wrap.

```ts
import { makeAdapter, makeSchemaDeclarations, makeSchemaIdentifiers } from 'oas-truth'

const identifiers = makeSchemaIdentifiers(schemas)
const declarations = makeSchemaDeclarations(schemas, makeAdapter('arktype'))
// a cyclic file: import { type, scope } from 'arktype'
// a non-cyclic file: import { type } from 'arktype'
const source = `${declarations[0]?.importLine}\n\n${declarations[0]?.code}`
```

## License

[MIT](https://github.com/nakita628/oas-truth/blob/main/LICENSE)
