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

## License

[MIT](https://github.com/nakita628/oas-truth/blob/main/LICENSE)
