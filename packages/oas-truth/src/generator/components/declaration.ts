export type ComponentDeclaration = {
  readonly name: string
  readonly varName: string
  readonly fileName: string
  readonly code: string
}

export type ComponentCodeOptions = {
  readonly exportTypes?: boolean
  readonly readonly?: boolean
  readonly identifiers?: ReadonlyMap<string, string>
}

/**
 * Join declaration bodies the way `make<Kind>Code` already does: `;` between
 * entries, no `import ` line. `trailingNewline` matches examples / links /
 * security-schemes / parameters / headers.
 */
export function joinDeclarations(
  declarations: readonly ComponentDeclaration[],
  options?: { readonly trailingNewline?: boolean; readonly importLine?: string },
) {
  if (declarations.length === 0) return ''
  const body = declarations.map((d) => d.code).join(';')
  const text = options?.trailingNewline === true ? `${body}\n` : body
  return options?.importLine === undefined ? text : `${options.importLine}\n\n${text}`
}
