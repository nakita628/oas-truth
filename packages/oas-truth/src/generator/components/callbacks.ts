import type { ComponentAdapter } from '../../adapter/index.js'
import { valueToCode } from '../../helper/ref-resolver.js'
import { makeSchemaReplacements } from '../../helper/schema-replacements.js'
import type { Components } from '../../openapi/index.js'
import { declarationFileName, toIdentifierPascalCase } from '../../utils/index.js'
import type { ComponentCodeOptions, ComponentDeclaration } from './declaration.js'
import { joinDeclarations } from './declaration.js'

export function makeCallbacksDeclarations(
  components: Components,
  adapter: ComponentAdapter,
  options?: ComponentCodeOptions,
): readonly ComponentDeclaration[] {
  const { callbacks } = components
  if (!callbacks) return []
  const asConst = options?.readonly === true ? ' as const' : ''
  return Object.entries(callbacks).flatMap(([name, callback]) => {
    if ('$ref' in callback && callback.$ref) return []
    const ident = toIdentifierPascalCase(name)
    const varName = `${ident}Callback`
    const replacements = makeSchemaReplacements(callback, adapter, {
      slot: 'response-content',
      ...(options?.identifiers && { identifiers: options.identifiers }),
    })
    return [
      {
        name,
        varName,
        fileName: declarationFileName(ident),
        code: `export const ${varName}=${valueToCode(callback, replacements, options?.identifiers)}${asConst}`,
      },
    ]
  })
}

export function makeCallbacksCode(
  components: Components,
  adapter: ComponentAdapter,
  readonly: boolean,
) {
  return joinDeclarations(makeCallbacksDeclarations(components, adapter, { readonly }))
}
