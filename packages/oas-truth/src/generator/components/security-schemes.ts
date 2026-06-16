import { valueToCode } from '../../helper/ref-resolver.js'
import type { Components } from '../../openapi/index.js'
import { toIdentifierPascalCase } from '../../utils/index.js'

export function makeSecuritySchemesCode(components: Components, readonly: boolean) {
  const { securitySchemes } = components
  if (!securitySchemes) return ''
  const entries = Object.entries(securitySchemes)
  if (entries.length === 0) return ''
  const asConst = readonly ? ' as const' : ''
  const exports = entries
    .map(([name, scheme]) => {
      const constName = `${toIdentifierPascalCase(name)}SecurityScheme`
      return `export const ${constName}=${valueToCode(scheme)}${asConst}`
    })
    .join(';')
  return `${exports}\n`
}
