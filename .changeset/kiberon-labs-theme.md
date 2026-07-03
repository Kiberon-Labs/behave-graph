---
"@kiberon-labs/behave-graph-flow": minor
---

Add a Kiberon Labs theme — an opt-in alternate theme for the editor.

- `css/themes/kiberon.css` re-declares the `--ds-*` bridge with the Kiberon Labs
  design tokens (dark, brand-canonical): crystal-purple accents, Geist type, and
  the brand surfaces/shadows. It is scoped (`[data-flow-theme="kiberon"]` /
  `.flow-theme-kiberon`) and ships inert in the bundle, so it coexists with the
  built-in theme rather than replacing it.
- Graph node category accents are now themeable tokens (`--ds-node-*`); the
  Kiberon theme recolors them to the crystal palette and rounds the node corners.
- A Storybook toolbar **Theme** toggle switches Default ↔ Kiberon for previewing.

Activate by putting `data-flow-theme="kiberon"` (or `class="flow-theme-kiberon"`)
on the editor's root container or `<html>`. Fonts fall back gracefully when Geist
isn't loaded by the host.
