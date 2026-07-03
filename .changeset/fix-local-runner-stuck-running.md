---
"@kiberon-labs/behave-graph-flow": patch
---

Fix the Local Graph Runner staying in a "Running" state after a graph finishes.

The local runner's `executeGraph` defaulted `autoEnd` to `true` but gated run
completion on `!autoEnd`, so the completion path — which marks the run finished,
emits the `completed` message, disposes the engine, and clears the panel's
running / active-runs state — never executed. A graph that ran out of fibers
reached the `completed` phase yet the run stayed `running` and the panel kept
showing "Running". Completion now fires when the run actually reaches the
completed phase (and isn't paused), and the manual step-through path syncs the
panel state on completion too.

The local transport kept its own copy of the run lifecycle that had drifted from
the shared `executeGraphLifecycle` used by the web-worker runner (with inverted
`autoEnd` logic). Both runners now share that single lifecycle implementation —
the runner-specific behaviour (pause-aware fiber stepping, tick timing, and the
on-complete / on-error side effects) is injected via hooks — so the completion
logic can't drift between them again.
