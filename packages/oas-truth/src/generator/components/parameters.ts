import type { ComponentAdapter } from '../../adapter/index.js'
import type { Components } from '../../openapi/index.js'
import { toIdentifierPascalCase } from '../../utils/index.js'

export function makeParametersCode(
  components: Components,
  adapter: ComponentAdapter,
  exportTypes?: boolean,
) {
  const { parameters } = components
  if (!parameters) return ''
  const entries = Object.entries(parameters)
  if (entries.length === 0) return ''
  const imports = adapter.renderImport()
  const exports = entries
    .map(([name, param]) => {
      if (!param.schema) return ''
      const paramIn = param.in === 'query' || param.in === 'path' ? param.in : undefined
      const constName = `${toIdentifierPascalCase(name)}ParamsSchema`
      const expr = adapter.toExpression(param.schema, paramIn)
      const typeExport = exportTypes ? `\n\n${adapter.renderTypeInfer(constName)}` : ''
      return `export const ${constName}=${expr}${typeExport}`
    })
    .filter(Boolean)
    .join(';')
  return exports ? `${imports}\n\n${exports}\n` : ''
}
