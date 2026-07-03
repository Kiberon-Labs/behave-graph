---
"@kiberon-labs/behave-graph-nodes-image": minor
---

Add a setting to toggle the inline image previews on image nodes.

The image plugin now contributes an `image.showPreview` setting (via the editor's
`system.registerSetting` API), so it auto-appears in the Settings panel under an
"Image" section, persists, and defaults on. When turned off, the inline preview
on image-producing nodes is hidden and its watch/decode work is skipped; turning
it back on restores the previews live.
