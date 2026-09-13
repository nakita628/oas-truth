import type { ComponentAdapter } from '../../adapter/index.js'
import { valueToCode } from '../../helper/ref-resolver.js'
import { makeSchemaReplacements } from '../../helper/schema-replacements.js'
import type { Components } from '../../openapi/index.js'
import { declarationFileName, toIdentifierPascalCase } from '../../utils/index.js'
import type { ComponentCodeOptions, ComponentDeclaration } from './declaration.js'
import { joinDeclarations } from './declaration.js'

export function makeRequestBodiesDeclarations(
  components: Components,
  adapter: ComponentAdapter,
  options?: ComponentCodeOptions,
): readonly ComponentDeclaration[] {
  const { requestBodies } = components
  if (!requestBodies) return []
  const asConst = options?.readonly === true ? ' as const' : ''
  return Object.entries(requestBodies).map(([name, body]) => {
    const ident = toIdentifierPascalCase(name)
    const varName = `${ident}RequestBody`
    const replacements = makeSchemaReplacements(body, adapter, {
      slot: 'request-content',
      ...(options?.identifiers && { identifiers: options.identifiers }),
    })
    return {
      name,
      varName,
      fileName: declarationFileName(ident),
      code: `export const ${varName}=${valueToCode(body, replacements, options?.identifiers)}${asConst}`,
    }
  })
}

export function makeRequestBodiesCode(
  components: Components,
  adapter: ComponentAdapter,
  readonly: boolean,
) {
  return joinDeclarations(makeRequestBodiesDeclarations(components, adapter, { readonly }))
}
