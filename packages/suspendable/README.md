# Behave-Graph Suspendable

A drop-in engine for [behave-graph](https://github.com/Kiberon-Labs/behave-graph) that can pause a running graph, capture its complete execution state as plain serializable data, and resume it later, in another process or even on another machine.

## Why this exists

The standard engine runs a graph to completion in a single process. That is a poor fit for **long-running workflows**: a graph that waits on a human approval, a webhook, a scheduled callback, or an external job that finishes hours or days later. Holding a live engine in memory for the entire duration is fragile and does not survive a restart, a deploy, or a scale-down.

`SuspendableEngine` makes the execution state **portable**. At any suspension point it produces a snapshot that survives `JSON.stringify`, so you can persist it to a database, put it on a queue, or hand it to a different worker. When the awaited event arrives, you rehydrate a fresh engine from that snapshot and continue exactly where you left off, with the awaited data delivered into the graph.

The workflow does not occupy a process while it waits. Only its serialized state does.

## How it works

```ts
import { SuspendableEngine } from '@kiberon-labs/behave-graph-suspendable';

const engine = new SuspendableEngine(graph, registry);
engine.start();

// ...the graph runs until it reaches a wait point...

// Capture the state as plain data and let the engine go.
const suspension = engine.suspend();
await store.save(workflowId, JSON.stringify(suspension));
```

Later, in a completely separate process:

```ts
const suspension = JSON.parse(await store.load(workflowId));

const engine = new SuspendableEngine(graph, registry);
engine.unsuspend(suspension, awaitedData); // resume with the awaited result
```

The snapshot captures everything needed to continue: in-flight execution, node state, runtime connections, socket values, and graph variables. Loops resume mid-iteration, and downstream nodes see the values they expect.

## Making a node suspendable

Most flow nodes need no changes; their state is captured automatically. Nodes that own live resources such as timers, listeners, or open promises opt in through a small interface so the engine knows how to serialize and restore them. Nodes that hold live resources but do not opt in are intentionally excluded, since that state cannot be blindly cloned.

Async wait points, the nodes that make a workflow long-running, are what turn an external event (an approval, a webhook, a completed job) into a clean resume with data.

## Status

The core suspend and resume round-trip is covered by tests spanning async wait points, core flow nodes, single and nested loops, and variable serialization. The main constraint to be aware of: any node that is live and stateful at a suspension point must implement the suspendable interface, or its state will not survive the round-trip.
