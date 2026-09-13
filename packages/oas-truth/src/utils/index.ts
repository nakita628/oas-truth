export function toPascalCase(str: string) {
  return str
    .replaceAll(/[^a-zA-Z0-9]+(.)/gu, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/u, (_, c: string) => c.toUpperCase())
}

/**
 * Decode percent-encoding, falling back to the raw input on malformed sequences
 * (e.g. `%ZZ`, a lone `%`) so a single bad `$ref` never throws and aborts the
 * whole generation run.
 */
function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Extract the component name from a `$ref`, decoding percent-encoding so the
 * result matches the (decoded) key under `components.schemas`. Pure-ASCII refs
 * are returned unchanged. Used for component lookup, not variable naming.
 */
export function schemaRefToName(ref: string) {
  const parts = ref.split('/')
  return safeDecode(parts.at(-1) ?? '')
}

/**
 * Encode non-ASCII characters as `u<hex codepoint>` so they survive identifier
 * normalization instead of collapsing every non-ASCII name to the same value.
 */
function encodeNonAscii(name: string) {
  // Code points are the unit being encoded here (`codePointAt` below), not grapheme clusters.
  // oxlint-disable-next-line typescript/no-misused-spread
  return [...name]
    .map((ch) => {
      const cp = ch.codePointAt(0) ?? 0
      return cp > 0x7f ? `u${cp.toString(16)}` : ch
    })
    .join('')
}

/**
 * Convert a name to a valid PascalCase TypeScript identifier. Mirrors
 * schema-to-library's `toIdentifierPascalCase` so reference identifiers match
 * the component declaration names it emits. Non-ASCII names are encoded
 * injectively so distinct names never collide.
 */
export function toIdentifierPascalCase(name: string) {
  const parts = encodeNonAscii(name)
    .split(/[^a-zA-Z0-9]+/u)
    .filter(Boolean)
  if (parts.length === 0) return 'Schema'
  const result = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')
  if (/^[0-9]/u.test(result)) {
    const prefixed = `_${result}`
    return prefixed.replace(/([0-9])([a-z])/u, (_, d, c: string) => `${d}${c.toUpperCase()}`)
  }
  return result
}

/**
 * `name`, or the first of `name2`, `name3`, … not in `used`.
 */
export function claimName(name: string, used: ReadonlySet<string>, i = 2): string {
  if (!used.has(name)) return name
  return used.has(`${name}${i}`) ? claimName(name, used, i + 1) : `${name}${i}`
}

/**
 * `toIdentifierPascalCase` folds `user` and `User` into one identifier; later
 * colliders get a numeric suffix so no declaration is lost. The map is
 * `OpenAPI key → identifier` (`user` → `User`, `User` → `User2`).
 */
export function makeSchemaIdentifiers(schemas: { readonly [k: string]: unknown }) {
  return Object.keys(schemas).reduce(
    (acc, key) => acc.set(key, claimName(toIdentifierPascalCase(key), new Set(acc.values()))),
    new Map<string, string>(),
  )
}

/** Lowercase the first character for a split-file name (`User` → `user`). */
export function declarationFileName(ident: string) {
  return `${ident.charAt(0).toLowerCase()}${ident.slice(1)}`
}

/**
 * Resolve a `#/components/schemas/...` `$ref` to its generated schema variable
 * identifier (`UserSchema`), or `undefined` when the ref does not point at a
 * component schema. Shared by ref-resolver and schema-replacements. Pass the
 * collision map from `makeSchemaIdentifiers` so a later collider resolves to
 * the suffixed name (`User` → `User2Schema`).
 */
export function makeSchemaVarName(ref: string, identifiers?: ReadonlyMap<string, string>) {
  const match = ref.match(/^#\/components\/schemas\/(.+)$/u)
  const name = match?.[1]
  if (name === undefined) return undefined
  const key = safeDecode(name)
  return `${identifiers?.get(key) ?? toIdentifierPascalCase(key)}Schema`
}

/**
 * Encode a property key for object-literal output: bare identifiers stay
 * unquoted, everything else is JSON-encoded so hyphenated/reserved/numeric
 * keys (e.g. `X-Request-ID`) emit as valid TypeScript.
 */
export function makeSafeKey(key: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key) ? key : JSON.stringify(key)
}

/** Narrow an unknown value to a plain object (excludes arrays and null). */
export function isRecord(v: unknown): v is { readonly [k: string]: unknown } {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
