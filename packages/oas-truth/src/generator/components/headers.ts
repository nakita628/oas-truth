import type { ComponentAdapter } from '../../adapter/index.js'
import type { Components } from '../../openapi/index.js'
import { toIdentifierPascalCase } from '../../utils/index.js'

export function makeHeadersCode(
  components: Components,
  adapter: ComponentAdapter,
  exportTypes?: boolean,
) {
  const { headers } = components
  if (!headers) return ''
  const entries = Object.entries(headers)
  if (entries.length === 0) return ''
  const imports = adapter.renderImport()
  const exports = entries
    .map(([name, header]) => {
      if (!('schema' in header) || !header.schema) return ''
      const constName = `${toIdentifierPascalCase(name)}HeaderSchema`
      const expr = adapter.toExpression(header.schema)
      const typeExport = exportTypes ? `\n\n${adapter.renderTypeInfer(constName)}` : ''
      return `export const ${constName}=${expr}${typeExport}`
    })
    .filter(Boolean)
    .join(';')
  return exports ? `${imports}\n\n${exports}\n` : ''
}
