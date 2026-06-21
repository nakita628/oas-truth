export function toPascalCase(str: string) {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (_, c: string) => c.toUpperCase())
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
  return safeDecode(parts[parts.length - 1] ?? '')
}

/**
 * Encode non-ASCII characters as `u<hex codepoint>` so they survive identifier
 * normalization instead of collapsing every non-ASCII name to the same value.
 */
function encodeNonAscii(name: string) {
  return Array.from(name)
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
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
  if (parts.length === 0) return 'Schema'
  const result = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('')
  if (/^[0-9]/.test(result)) {
    const prefixed = `_${result}`
    return prefixed.replace(/([0-9])([a-z])/, (_, d, c: string) => `${d}${c.toUpperCase()}`)
  }
  return result
}

/**
 * Resolve a `#/components/schemas/...` `$ref` to its generated schema variable
 * identifier (`UserSchema`), or `undefined` when the ref does not point at a
 * component schema. Shared by ref-resolver and schema-replacements.
 */
export function makeSchemaVarName(ref: string) {
  const match = ref.match(/^#\/components\/schemas\/(.+)$/)
  const name = match?.[1]
  if (name === undefined) return undefined
  return `${toIdentifierPascalCase(safeDecode(name))}Schema`
}

/**
 * Encode a property key for object-literal output: bare identifiers stay
 * unquoted, everything else is JSON-encoded so hyphenated/reserved/numeric
 * keys (e.g. `X-Request-ID`) emit as valid TypeScript.
 */
export function makeSafeKey(key: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
}

/** Narrow an unknown value to a plain object (excludes arrays and null). */
export function isRecord(v: unknown): v is { readonly [k: string]: unknown } {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}
