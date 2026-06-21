import type { ComponentAdapter } from '../../adapter/index.js'
import { valueToCode } from '../../helper/ref-resolver.js'
import { makeSchemaReplacements } from '../../helper/schema-replacements.js'
import type { Components } from '../../openapi/index.js'
import { toIdentifierPascalCase } from '../../utils/index.js'

export function makeCallbacksCode(
  components: Components,
  adapter: ComponentAdapter,
  readonly: boolean,
) {
  const { callbacks } = components
  if (!callbacks) return ''
  const entries = Object.entries(callbacks)
  if (entries.length === 0) return ''
  const asConst = readonly ? ' as const' : ''
  const exports = entries
    .filter(([, callback]) => !('$ref' in callback && callback.$ref))
    .map(([name, callback]) => {
      const constName = `${toIdentifierPascalCase(name)}Callback`
      const replacements = makeSchemaReplacements(callback, adapter)
      return `export const ${constName}=${valueToCode(callback, replacements)}${asConst}`
    })
    .filter(Boolean)
  if (exports.length === 0) return ''
  return exports.join(';')
}
