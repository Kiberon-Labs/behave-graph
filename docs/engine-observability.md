# Observing graph execution

The core engine emits execution observations without depending on OpenTelemetry,
storage, Node.js async context, or a particular host. An adapter can map each
invocation to a span and enqueue the same records for a run inspector.

## Configure the observer before initialization

```ts
const engine = new Engine(graph, registry, {
  executionId: runId,
  attributes: { graphId, graphVersionId, triggerSource },
  deferInitialization: true,
  onExecution: event => diagnosticQueue.push(event),
  observer: event => diagnosticQueue.push(event),
  captureValue: (value, socket, node) => redactAndSnapshot(value, socket, node)
});
await engine.initialize();
lifecycle.startEvent.emit();
const result = await engine.executeWithOutcome(30, 100_000);
```

Initialization remains eager by default for existing callers. Both execution
methods await initialization. Hosts must await initialize() before emitting
lifecycle events, so async event subscriptions are ready and initialization
failures propagate. The observer supplied to the constructor sees initialization
even in eager mode.

## Records and causality

onExecution emits one execution_started and one execution_finished record for the
root run, including outcome, duration, successful step count and optional external
parent. Use executionId to correlate a host run with its observations. Root and
invocation records share a sequence counter.

Each invocation has a unique ID, execution ID, node ID/type, phase, optional
fiber ID, parent invocation ID, and triggering socket. Phases distinguish event
initialization, event activation, node execution, and continuation callbacks.
Repeated and overlapping executions of one node have different invocation IDs.
Observations have ordered sequence numbers, wall-clock timestamps, and monotonic
terminal durations. One started invocation emits at most one finished record.
Inputs are observed after resolution; outputs are observed at completion. Socket
records include connection endpoints. Commits include the selected flow socket
and its downstream targets, including unconnected outputs.

Function input calculations nest below the consuming invocation. Their failures
have their own failed record; downstream consumers also fail when resolution
fails. Legacy error events may therefore contain both the cause and affected
consumers. Async completion is guarded against duplicate finished() calls.
Disposal closes open invocations as cancelled before invoking node cleanup.

## Manual instrumentation

Factory function, flow, async, and event initialization callbacks receive an
optional invocation. Retain that explicit context across await or callbacks:

```ts
triggered: async ({ invocation, read, write, finished }) => {
  invocation?.emit('request.started', { operation: 'lookup' });
  const value = await lookup(read('id'));
  invocation?.emit('request.completed', { matched: value !== null });
  write('result', value);
  finished?.();
}
```

Async nodes can call finished(error) to report a failure from a detached callback; the execution method propagates it (or executeWithOutcome returns failed). Events after invocation completion are ignored. Diagnostic attributes must be
redacted and snapshotted by the node or adapter. No ambient current-node global
is used. Class-based nodes can accept the optional context on exec, triggered,
or init and pass it to engine.commitToNewFiber as the fourth argument. Custom
execution handlers receive args.invocation and must call
engine.finishInvocation(args.invocation) at their actual completion, alongside
their legacy end event and step accounting. Continuation callbacks receive the
context as their optional second argument.

## Capture and export policy

Values are omitted unless captureValue is configured. It must return an
independent, immutable snapshot, applying secret redaction and payload limits.
The engine copies socket metadata and endpoints; it does not serialize arbitrary
custom values. Capture failures omit that value. Observer exceptions and rejected callback promises are isolated
from graph execution. Returned observer promises are not awaited or flushed by
core; the host owns export completion. Observers must be synchronous and bounded: enqueue records
and perform asynchronous persistence/export outside core. pendingAsyncInvocations exposes distinct operation IDs for overlapping async work.
Realtime engines accept the same observer options, initialize added event nodes
through the shared lifecycle, and cancel every invocation of a removed node.
Hosts own buffering,
overflow/incomplete indicators, retention, tenant isolation, sampling and trace
context propagation across processes or subgraphs.

## Outcomes and budgets

executeWithOutcome returns completed, failed, cancelled, timed_out, or step_limit,
plus pending-work counts captured before cleanup and the failure cause when
applicable. Every executeWithOutcome call closes remaining invocations and awaits node cleanup
before returning. Cleanup failures produce a failed outcome after all hooks have
been attempted. Successful step counts include detached async completions and
work completed before a later failure. The root lifecycle total also includes
event initialization; execution method counts exclude initialization.
Legacy executeAllSync/executeAllAsync still return step counts and throw failures;
their callers remain responsible for disposal. Prefer await disposeAsync() to
finish root observations after cleanup. dispose() remains synchronous and
initiates cleanup; its background promise cannot cause an unhandled rejection. Time and step budgets are
cooperative: they cannot preempt synchronous JavaScript or a node promise that
never settles. Hosts needing hard deadlines must enforce them at the worker
boundary. Core does not guarantee flushing on process termination.


## Nested graphs and suspension

Pass observation options to runSubgraph. The built-in guarded resolver inherits
observer callbacks and capture policy for nested graphs, assigns a new execution
ID to each child, and links the child root to its calling invocation. External
IGraphApi implementations receive the optional invocation as runGraph's third
argument and should pass it as runSubgraph's parentInvocation. Use local parent
invocation IDs to nest node spans within an execution; cross-engine causality
belongs to the root's parent reference. Missing graphs and recursion/depth guards
emit subgraph.skipped diagnostics. Child execution failures propagate to the
caller rather than returning empty outputs.

SuspendableEngine accepts the same observation options. Serialized fibers carry
parent execution/invocation references. A resumed engine records a new
continuation invocation linked to that saved parent. Custom suspendable nodes
can accept unsuspend's optional fifth invocation argument and pass it to
commitToNewFiber for downstream causality. A host should supply a distinct
execution ID for each resumed segment and retain their correlation in storage.
