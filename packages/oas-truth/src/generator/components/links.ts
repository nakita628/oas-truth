import { valueToCode } from '../../helper/ref-resolver.js'
import type { Components } from '../../openapi/index.js'
import { toIdentifierPascalCase } from '../../utils/index.js'

export function makeLinksCode(components: Components, readonly: boolean) {
  const { links } = components
  if (!links) return ''
  const entries = Object.entries(links)
  if (entries.length === 0) return ''
  const asConst = readonly ? ' as const' : ''
  const exports = entries
    .map(([name, link]) => {
      const constName = `${toIdentifierPascalCase(name)}Link`
      return `export const ${constName}=${valueToCode(link)}${asConst}`
    })
    .join(';')
  return `${exports}\n`
}
