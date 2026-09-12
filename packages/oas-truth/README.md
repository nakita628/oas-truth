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

## Schema declarations

Every Components key has a `make<Kind>Code` builder. `makeSchemasCode` is the
one for `components.schemas`: it returns the adapter import and one
`export const <Name>Schema=...` declaration per entry, in dependency-first
order. `$ref` cycles stay references — lazy wrappers for Zod, Valibot and
Effect, a `scope` container for Arktype, `Type.Cyclic` for TypeBox — and keys
that fold to the same identifier (`user` / `User`) get a numeric suffix.

Hosts that write one file per schema use `makeSchemaDeclarations`, which
returns `{ name, varName, fileName, code }` per entry (no import line).

```ts
import { makeAdapter, makeSchemasCode } from 'oas-truth'

const code = makeSchemasCode(doc.components ?? {}, makeAdapter('zod'), {
  exportTypes: true,
})
```

`parseOpenAPI` never throws; the builders have nothing that can fail. Options
cover the exported type name (`User` vs `UserSchema`), `x-readonly` on object
and array nodes, and a `wrapDeclaration` hook for host-specific ref
registration.

## License

[MIT](https://github.com/nakita628/oas-truth/blob/main/LICENSE)
