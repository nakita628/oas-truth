import type { ComponentAdapter } from '../../adapter/index.js'
import type { Components } from '../../openapi/index.js'
import { declarationFileName, toIdentifierPascalCase } from '../../utils/index.js'
import type { ComponentCodeOptions, ComponentDeclaration } from './declaration.js'
import { joinDeclarations } from './declaration.js'

export function makeMediaTypesDeclarations(
  components: Components,
  adapter: ComponentAdapter,
  options?: ComponentCodeOptions,
): readonly ComponentDeclaration[] {
  const { mediaTypes } = components
  if (!mediaTypes) return []
  return Object.entries(mediaTypes).flatMap(([name, media]) => {
    if ('$ref' in media && media.$ref) return []
    if (!('schema' in media) || !media.schema) return []
    const ident = toIdentifierPascalCase(name)
    const varName = `${ident}MediaTypeSchema`
    const raw = adapter.toExpression(media.schema)
    const expr = adapter.wrapSchema ? adapter.wrapSchema(raw, 'media-type') : raw
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

export function makeMediaTypesCode(
  components: Components,
  adapter: ComponentAdapter,
  exportTypes?: boolean,
) {
  return joinDeclarations(
    makeMediaTypesDeclarations(
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
