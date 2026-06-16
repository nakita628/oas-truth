import { valueToCode } from '../../helper/ref-resolver.js'
import type { Components } from '../../openapi/index.js'
import { toIdentifierPascalCase } from '../../utils/index.js'

export function makeExamplesCode(components: Components, readonly: boolean) {
  const { examples } = components
  if (!examples) return ''
  const entries = Object.entries(examples)
  if (entries.length === 0) return ''
  const asConst = readonly ? ' as const' : ''
  const exports = entries
    .map(([name, example]) => {
      const constName = `${toIdentifierPascalCase(name)}Example`
      return `export const ${constName}=${valueToCode(example)}${asConst}`
    })
    .join(';')
  return `${exports}\n`
}
