---
"@kiberon-labs/behave-graph": minor
---

Add optional invocation-aware execution observations, socket capture policies,
manual diagnostic events and explicit execution outcomes. Await event
initialization and guard duplicate async completion while preserving legacy hooks.

Complete root execution lifecycle and nested graph correlation. Track overlapping
async operations independently, preserve completed step counts on failures, and
await all cleanup hooks. Realtime engines share the same observation lifecycle.
Child graph errors now propagate instead of being swallowed.
