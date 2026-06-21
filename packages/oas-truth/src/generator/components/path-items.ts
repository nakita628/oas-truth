import type { ComponentAdapter } from '../../adapter/index.js'
import { valueToCode } from '../../helper/ref-resolver.js'
import { makeSchemaReplacements } from '../../helper/schema-replacements.js'
import type { Components } from '../../openapi/index.js'
import { toIdentifierPascalCase } from '../../utils/index.js'

export function makePathItemsCode(
  components: Components,
  adapter: ComponentAdapter,
  readonly: boolean,
) {
  const { pathItems } = components
  if (!pathItems) return ''
  const entries = Object.entries(pathItems)
  if (entries.length === 0) return ''
  const asConst = readonly ? ' as const' : ''
  const exports = entries
    .map(([name, pathItem]) => {
      const constName = `${toIdentifierPascalCase(name)}PathItem`
      const replacements = makeSchemaReplacements(pathItem, adapter)
      return `export const ${constName}=${valueToCode(pathItem, replacements)}${asConst}`
    })
    .filter(Boolean)
  if (exports.length === 0) return ''
  return exports.join(';')
}
