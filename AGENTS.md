# AGENTS.md

Instructions for coding agents working on this repository. The full rules live in
[`.cursor/rules/`](.cursor/rules) and are also read automatically by Cursor:

| Rule               | Applies to                         | Covers                                                         |
| ------------------ | ---------------------------------- | -------------------------------------------------------------- |
| `project.mdc`      | always                             | repository map, commands, invariants, definition of done, Git  |
| `typescript.mdc`   | `**/*.ts`                          | the code conventions the oxlint configuration enforces         |
| `architecture.mdc` | `packages/oas-truth/src/**`        | layering, responsibilities, emitted code, public API           |
| `testing.mdc`      | `**/*.test.ts`                     | vitest conventions and exact-output assertions                 |
| `docs.mdc`         | `**/*.md`                          | markdownlint, textlint and cspell                              |
| `ci-config.mdc`    | workflows, manifests, lint configs | action pinning, editing the lint config, dependencies, release |
| `playbooks.mdc`    | on request                         | step-by-step recipes for the recurring tasks                   |

## The short version

```sh
pnpm install --frozen-lockfile
pnpm fix                  # formatting, oxlint, markdownlint, textlint autofixes
vp run oas-truth#build    # build dist
pnpm test                 # unit tests
pnpm check                # format check, lint, type check, repository linters
```

Build, test and check must all pass before a change is finished — they are exactly what CI runs.
Never relax a linter to get a change through, never change what the code builders emit without
saying so (every consumer's output changes with it), and write everything committed in English.
