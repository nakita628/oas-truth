import { valueToCode } from '../../helper/ref-resolver.js'
import type { Components } from '../../openapi/index.js'
import { declarationFileName, toIdentifierPascalCase } from '../../utils/index.js'
import type { ComponentCodeOptions, ComponentDeclaration } from './declaration.js'
import { joinDeclarations } from './declaration.js'

export function makeExamplesDeclarations(
  components: Components,
  options?: ComponentCodeOptions,
): readonly ComponentDeclaration[] {
  const { examples } = components
  if (!examples) return []
  const asConst = options?.readonly === true ? ' as const' : ''
  return Object.entries(examples).map(([name, example]) => {
    const ident = toIdentifierPascalCase(name)
    const varName = `${ident}Example`
    return {
      name,
      varName,
      fileName: declarationFileName(ident),
      code: `export const ${varName}=${valueToCode(example)}${asConst}`,
    }
  })
}

export function makeExamplesCode(components: Components, readonly: boolean) {
  return joinDeclarations(makeExamplesDeclarations(components, { readonly }), {
    trailingNewline: true,
  })
}
