import type { ComponentAdapter } from '../../adapter/index.js'
import { isParamStyle } from '../../adapter/index.js'
import type { Components } from '../../openapi/index.js'
import { declarationFileName, toIdentifierPascalCase } from '../../utils/index.js'
import type { ComponentCodeOptions, ComponentDeclaration } from './declaration.js'
import { joinDeclarations } from './declaration.js'

export function makeParametersDeclarations(
  components: Components,
  adapter: ComponentAdapter,
  options?: ComponentCodeOptions,
): readonly ComponentDeclaration[] {
  const { parameters } = components
  if (!parameters) return []
  return Object.entries(parameters).flatMap(([name, param]) => {
    if (!param.schema) return []
    const ident = toIdentifierPascalCase(name)
    const varName = `${ident}ParamsSchema`
    const raw = adapter.toExpression(param.schema, param.in, {
      ...(param.style !== undefined && isParamStyle(param.style) && { style: param.style }),
      ...(param.explode !== undefined && { explode: param.explode }),
      ...(param.allowEmptyValue !== undefined && { allowEmptyValue: param.allowEmptyValue }),
    })
    const expr = adapter.wrapSchema ? adapter.wrapSchema(raw, 'parameter') : raw
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

export function makeParametersCode(
  components: Components,
  adapter: ComponentAdapter,
  exportTypes?: boolean,
) {
  return joinDeclarations(
    makeParametersDeclarations(
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
