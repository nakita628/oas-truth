import type { ComponentAdapter } from '../../adapter/index.js'
import type { Components } from '../../openapi/index.js'
import { declarationFileName, toIdentifierPascalCase } from '../../utils/index.js'
import type { ComponentCodeOptions, ComponentDeclaration } from './declaration.js'
import { joinDeclarations } from './declaration.js'

export function makeHeadersDeclarations(
  components: Components,
  adapter: ComponentAdapter,
  options?: ComponentCodeOptions,
): readonly ComponentDeclaration[] {
  const { headers } = components
  if (!headers) return []
  return Object.entries(headers).flatMap(([name, header]) => {
    if (!('schema' in header) || !header.schema) return []
    const ident = toIdentifierPascalCase(name)
    const varName = `${ident}HeaderSchema`
    const raw = adapter.toExpression(header.schema)
    const expr = adapter.wrapSchema ? adapter.wrapSchema(raw, 'header') : raw
    const typeExport =
      options?.exportTypes === true ? `\n\n${adapter.renderTypeInfer(varName)}` : ''
    return [
      {
        name,
        varName,
        fileName: declarationFileName(ident),
        code: `export const ${varName}=${expr}${typeExport}`,
      },
    ]
  })
}

export function makeHeadersCode(
  components: Components,
  adapter: ComponentAdapter,
  exportTypes?: boolean,
) {
  return joinDeclarations(
    makeHeadersDeclarations(
      components,
      adapter,
      exportTypes === true ? { exportTypes: true } : undefined,
    ),
    {
      trailingNewline: true,
      importLine: adapter.renderImport(),
    },
  )
}
