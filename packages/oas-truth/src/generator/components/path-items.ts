import type { ComponentAdapter } from '../../adapter/index.js'
import { valueToCode } from '../../helper/ref-resolver.js'
import { makeSchemaReplacements } from '../../helper/schema-replacements.js'
import type { Components } from '../../openapi/index.js'
import { declarationFileName, toIdentifierPascalCase } from '../../utils/index.js'
import type { ComponentCodeOptions, ComponentDeclaration } from './declaration.js'
import { joinDeclarations } from './declaration.js'

export function makePathItemsDeclarations(
  components: Components,
  adapter: ComponentAdapter,
  options?: ComponentCodeOptions,
): readonly ComponentDeclaration[] {
  const { pathItems } = components
  if (!pathItems) return []
  const asConst = options?.readonly === true ? ' as const' : ''
  return Object.entries(pathItems).map(([name, pathItem]) => {
    const ident = toIdentifierPascalCase(name)
    const varName = `${ident}PathItem`
    const replacements = makeSchemaReplacements(pathItem, adapter, {
      slot: 'response-content',
      ...(options?.identifiers && { identifiers: options.identifiers }),
    })
    return {
      name,
      varName,
      fileName: declarationFileName(ident),
      code: `export const ${varName}=${valueToCode(pathItem, replacements, options?.identifiers)}${asConst}`,
    }
  })
}

export function makePathItemsCode(
  components: Components,
  adapter: ComponentAdapter,
  readonly: boolean,
) {
  return joinDeclarations(makePathItemsDeclarations(components, adapter, { readonly }))
}
