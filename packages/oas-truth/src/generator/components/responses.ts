import type { ComponentAdapter } from '../../adapter/index.js'
import { valueToCode } from '../../helper/ref-resolver.js'
import { makeSchemaReplacements } from '../../helper/schema-replacements.js'
import type { Components } from '../../openapi/index.js'
import { declarationFileName, toIdentifierPascalCase } from '../../utils/index.js'
import type { ComponentCodeOptions, ComponentDeclaration } from './declaration.js'
import { joinDeclarations } from './declaration.js'

export function makeResponsesDeclarations(
  components: Components,
  adapter: ComponentAdapter,
  options?: ComponentCodeOptions,
): readonly ComponentDeclaration[] {
  const { responses } = components
  if (!responses) return []
  const asConst = options?.readonly === true ? ' as const' : ''
  return Object.entries(responses).flatMap(([name, response]) => {
    if ('$ref' in response && response.$ref) return []
    const ident = toIdentifierPascalCase(name)
    const varName = `${ident}Response`
    const replacements = makeSchemaReplacements(response, adapter, {
      slot: 'response-content',
      ...(options?.identifiers && { identifiers: options.identifiers }),
    })
    return [
      {
        name,
        varName,
        fileName: declarationFileName(ident),
        code: `export const ${varName}=${valueToCode(response, replacements, options?.identifiers)}${asConst}`,
      },
    ]
  })
}

export function makeResponsesCode(
  components: Components,
  adapter: ComponentAdapter,
  readonly: boolean,
) {
  return joinDeclarations(makeResponsesDeclarations(components, adapter, { readonly }))
}
