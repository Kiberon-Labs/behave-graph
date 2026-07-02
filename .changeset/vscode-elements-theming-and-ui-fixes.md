---
"@kiberon-labs/behave-graph-flow": patch
---

Make `@vscode-elements` controls follow the active theme, and fix a few panel UI
inconsistencies.

- **Themeable vscode-elements**: `css/vscode-elements.css` feeds the `--vscode-*`
  custom properties that `VscodeButton` / `VscodeTextfield` / `VscodeCheckbox` /
  `VscodeSingleSelect` / etc. read from the editor's `--ds-*` tokens, so they
  follow the active theme (e.g. Kiberon purple) instead of falling back to their
  built-in VS Code blue. Native checkbox / range / radio controls pick up the
  theme accent via `accent-color`. (Inert in the real extension, where VS Code's
  injected `--vscode-*` win.)
- **Menu density**: tighter dropdown menu item padding.
- **Panel overflow**: vscode-elements form fields cap to their container width,
  fixing horizontal overflow in narrow panels (e.g. Graph Properties).
- **Checkbox consistency**: the Layers panel's "Visible" checkbox now uses
  `VscodeCheckbox`, matching Settings and the rest of the editor (it was a native
  browser checkbox).
- **Logs toolbar cleanup**: the toolbar action icons (auto-scroll / timestamps /
  export / clear) are sized to fit their buttons, and the active toggles use a
  boxless accent (solid icon + accent color) instead of a filled outlined box —
  ghost icon buttons throughout.
- **Local Graph Runner panel** now follows the shared panel conventions
  (`BasePanel` + `SectionTitle` + `VscodeDivider` + the design-system spacing/type
  scale) instead of its own card-style sections and bespoke headers, matching the
  Settings/Logs panels. Also added to the panel visual-regression suite.
- **Dock tabs**: dropped the bright focus-color top-accent line on the active dock
  tab, which read as a stray-line artifact when repeated across panels. The active
  tab is still set off by its lighter, content-colored background (the VS Code
  look).
