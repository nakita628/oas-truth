import type { ComponentAdapter } from '../../adapter/index.js'
import { valueToCode } from '../../helper/ref-resolver.js'
import { makeSchemaReplacements } from '../../helper/schema-replacements.js'
import type { Components } from '../../openapi/index.js'
import { toIdentifierPascalCase } from '../../utils/index.js'

export function makeRequestBodiesCode(
  components: Components,
  adapter: ComponentAdapter,
  readonly: boolean,
) {
  const { requestBodies } = components
  if (!requestBodies) return ''
  const entries = Object.entries(requestBodies)
  if (entries.length === 0) return ''
  const asConst = readonly ? ' as const' : ''
  const exports = entries
    .map(([name, body]) => {
      const constName = `${toIdentifierPascalCase(name)}RequestBody`
      const replacements = makeSchemaReplacements(body, adapter)
      return `export const ${constName}=${valueToCode(body, replacements)}${asConst}`
    })
    .filter(Boolean)
  if (exports.length === 0) return ''
  return exports.join(';')
}
