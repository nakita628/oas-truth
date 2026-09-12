/**
 * Identifier rewriting on generated source without a parser: skip quoted
 * strings so identifier-shaped text inside descriptions and `Type.Ref('X')`
 * keys is never mistaken for a reference. The schemas builder only applies
 * this to libraries whose cycle form is a lazy wrapper (Zod, Valibot, Effect),
 * where a schema name appears as an identifier.
 */

function readQuoted(source: string, start: number) {
  const quote = source[start] ?? ''
  let i = start + 1
  while (i < source.length) {
    const ch = source[i]
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === quote) return { text: source.slice(start, i + 1), end: i + 1 }
    i += 1
  }
  return { text: source.slice(start), end: source.length }
}

function isIdentStart(ch: string) {
  return /[A-Za-z_$]/u.test(ch)
}

function isIdentPart(ch: string) {
  return /[A-Za-z0-9_$]/u.test(ch)
}

/** Rewrites every identifier in `names` with `wrap(name)`, leaving strings intact. */
export function wrapReferences(
  expr: string,
  names: ReadonlySet<string>,
  wrap: (name: string) => string,
) {
  if (names.size === 0) return expr
  let result = ''
  let i = 0
  while (i < expr.length) {
    const ch = expr[i] ?? ''
    if (ch === '"' || ch === "'" || ch === '`') {
      const quoted = readQuoted(expr, i)
      result += quoted.text
      i = quoted.end
      continue
    }
    if (isIdentStart(ch)) {
      const start = i
      i += 1
      while (i < expr.length && isIdentPart(expr[i] ?? '')) i += 1
      const ident = expr.slice(start, i)
      result += names.has(ident) ? wrap(ident) : ident
      continue
    }
    result += ch
    i += 1
  }
  return result
}
