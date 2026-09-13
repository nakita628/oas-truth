import { valueToCode } from '../../helper/ref-resolver.js'
import type { Components } from '../../openapi/index.js'
import { declarationFileName, toIdentifierPascalCase } from '../../utils/index.js'
import type { ComponentCodeOptions, ComponentDeclaration } from './declaration.js'
import { joinDeclarations } from './declaration.js'

export function makeSecuritySchemesDeclarations(
  components: Components,
  options?: ComponentCodeOptions,
): readonly ComponentDeclaration[] {
  const { securitySchemes } = components
  if (!securitySchemes) return []
  const asConst = options?.readonly === true ? ' as const' : ''
  return Object.entries(securitySchemes).map(([name, scheme]) => {
    const ident = toIdentifierPascalCase(name)
    const varName = `${ident}SecurityScheme`
    return {
      name,
      varName,
      fileName: declarationFileName(ident),
      code: `export const ${varName}=${valueToCode(scheme)}${asConst}`,
    }
  })
}

export function makeSecuritySchemesCode(components: Components, readonly: boolean) {
  return joinDeclarations(makeSecuritySchemesDeclarations(components, { readonly }), {
    trailingNewline: true,
  })
}
