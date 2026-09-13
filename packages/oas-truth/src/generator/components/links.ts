import { valueToCode } from '../../helper/ref-resolver.js'
import type { Components } from '../../openapi/index.js'
import { declarationFileName, toIdentifierPascalCase } from '../../utils/index.js'
import type { ComponentCodeOptions, ComponentDeclaration } from './declaration.js'
import { joinDeclarations } from './declaration.js'

export function makeLinksDeclarations(
  components: Components,
  options?: ComponentCodeOptions,
): readonly ComponentDeclaration[] {
  const { links } = components
  if (!links) return []
  const asConst = options?.readonly === true ? ' as const' : ''
  return Object.entries(links).map(([name, link]) => {
    const ident = toIdentifierPascalCase(name)
    const varName = `${ident}Link`
    return {
      name,
      varName,
      fileName: declarationFileName(ident),
      code: `export const ${varName}=${valueToCode(link)}${asConst}`,
    }
  })
}

export function makeLinksCode(components: Components, readonly: boolean) {
  return joinDeclarations(makeLinksDeclarations(components, { readonly }), {
    trailingNewline: true,
  })
}
