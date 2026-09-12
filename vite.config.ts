import { defineConfig } from 'vite-plus'

export default defineConfig({
  // Single source of truth for formatting style. Vite+ merges this root config into every
  // workspace config, so `packages/oas-truth` inherits these options and only declares what is
  // specific to it (pack / test / lint).
  //
  // Do not add a broad `fmt.ignorePatterns` here: it is inherited too, and a root-relative pattern
  // such as `packages/**` makes the workspaces' own `vp check` exclude every file.
  fmt: {
    printWidth: 100,
    singleQuote: true,
    semi: false,
    sortPackageJson: true,
    sortImports: {},
  },
  staged: {
    '*.{js,mjs,ts}': 'vp check --fix',
  },
})
