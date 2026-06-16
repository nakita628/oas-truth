import type { ComponentAdapter } from '../../adapter/index.js'
import { valueToCode } from '../../helper/ref-resolver.js'
import { makeSchemaReplacements } from '../../helper/schema-replacements.js'
import type { Components } from '../../openapi/index.js'
import { toIdentifierPascalCase } from '../../utils/index.js'

export function makeResponsesCode(
  components: Components,
  adapter: ComponentAdapter,
  readonly: boolean,
) {
  const { responses } = components
  if (!responses) return ''
  const entries = Object.entries(responses)
  if (entries.length === 0) return ''
  const asConst = readonly ? ' as const' : ''
  const exports = entries
    .filter(([, response]) => !('$ref' in response && response.$ref))
    .map(([name, response]) => {
      const constName = `${toIdentifierPascalCase(name)}Response`
      const replacements = makeSchemaReplacements(response, adapter)
      return `export const ${constName}=${valueToCode(response, replacements)}${asConst}`
    })
    .filter(Boolean)
  if (exports.length === 0) return ''
  return exports.join(';')
}
