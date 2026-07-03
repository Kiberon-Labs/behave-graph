---
"@kiberon-labs/behave-graph-flow": minor
---

Make the Settings panel schema-driven so plugins can contribute their own
settings, VS Code style.

- **Schema registry** (`store/settingsSchema.ts`): the panel is auto-generated
  from `SettingDescriptor`s (`boolean` / `number` / `string` / `enum` / `custom`),
  grouped by section, with a search/filter box and a per-row reset-to-default +
  "modified" indicator. Built-in settings are seeded as descriptors, so the
  rendered panel is unchanged.
- **Plugin API** on the editor `System`: `registerSetting(descriptor)` /
  `registerSettings([...])` auto-render in the panel; `getSetting` / `setSetting`
  read and write values. Plugin-contributed settings persist alongside the
  built-ins (the host storage adapter is unaffected). Typed access to built-in
  settings (`settings.edgeType`, `settings.setShowGrid`, …) is preserved.

Descriptors are plain, JSON-serializable data, so a declarative manifest
`contributes.configuration` section can feed the same registry as a follow-up.
