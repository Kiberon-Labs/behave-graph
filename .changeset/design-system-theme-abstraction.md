---
"@kiberon-labs/behave-graph-flow": minor
---

Abstract the editor's design system behind an intermediary `--ds-*` token layer
so theming no longer hard-codes VS Code variables.

- `css/vars.css` now defines a `--ds-*` "theme bridge" (canonical VS Code-dark
  defaults), and the semantic tokens (`--colors-*`, `--color-neutral-*`, …)
  resolve through it. Components reference `--ds-*` only — the ~283 raw
  `var(--vscode-*)` references across the component CSS were migrated, and the
  bundled `css/vscode.css` defaults file was removed.
- VS Code coupling now lives in a single mapping the host owns: the extension
  re-declares the `--ds-*` layer as `var(--vscode-*, …)`, so the editor still
  tracks the user's active VS Code theme. (The lone remaining `--vscode-*`
  reference in the components is `--vscode-tree-item-padding`, a
  `@vscode-elements` component API var, not a theme token.)

Migration note for VS Code webview hosts: map the editor's `--ds-*` tokens from
`--vscode-*` in a small `:root` rule so the chrome follows the active VS Code
theme. Standalone hosts (web, Storybook, tests) need no setup — they get the
canonical dark defaults.
