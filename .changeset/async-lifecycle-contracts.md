---
"@kiberon-labs/behave-graph": patch
---

Correct async invocation settlement for suppressed Delay/Throttle calls and
superseded, cancelled, and concurrent Debounce calls. Clear pending Delay timers
and settle their invocations on disposal without committing downstream flow.
Await async/event factory cleanup and allow resource-free base nodes to dispose
without throwing.

Declare asynchronous initialization, invocation, and disposal in the public node
types. Add regression coverage for lifecycle settlement, timer isolation, and
awaited cleanup so these contracts travel with the engine package.
