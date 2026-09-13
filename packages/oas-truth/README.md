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

```ts
import { makeAdapter, makeSchemaDeclarations } from 'oas-truth'

const declarations = makeSchemaDeclarations(schemas, makeAdapter('arktype'))
// a cyclic file: import { type, scope } from 'arktype'
// a non-cyclic file: import { type } from 'arktype'
const source = `${declarations[0]?.importLine}\n\n${declarations[0]?.code}`
```

## License

[MIT](https://github.com/nakita628/oas-truth/blob/main/LICENSE)
