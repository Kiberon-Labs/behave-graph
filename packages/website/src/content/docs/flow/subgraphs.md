---
title: Subgraphs
description: Make a graph reusable and call it from another graph, with a typed input/output contract.
---

A **subgraph** is an ordinary graph that another graph can call like a function.
You expose a typed set of inputs and outputs , its *contract* , and a **Call
Subgraph** node invokes it, passing values in and reading results out. This keeps
large graphs readable and lets you reuse logic.

There are three node types involved:

| Node | Type | Role |
| --- | --- | --- |
| **Graph Input** | `graph/input` | Declares the subgraph's inputs; exposes them as outputs inside the graph. |
| **Graph Output** | `graph/output` | Declares the subgraph's outputs; returns when triggered. |
| **Call Subgraph** | `flow/callSubgraph` | Invokes another graph and mirrors its contract as ports. |

## Defining a subgraph's contract

A graph becomes callable as soon as it has boundary nodes.

1. Add a **Graph Input** and/or **Graph Output** node to the graph.
2. Select the boundary node and open the **Node Inputs** panel. Each boundary
   node has a small editor where you add, **name**, and type its parameters.
3. The parameters you add to **Graph Input** become the subgraph's *inputs*; the
   parameters on **Graph Output** become its *outputs*.

Inside the graph:

- **Graph Input** exposes each declared input as an **output socket** (plus a
  `flow` output), so values flow *into* your graph's logic.
- **Graph Output** exposes each declared output as an **input socket** (plus a
  `flow` input). Triggering its flow input **returns** from the subgraph with
  whatever values are wired to it.

Parameter names are display labels and can be renamed at any time without
breaking existing connections , the underlying identity is a stable id, so
callers that already reference a parameter keep working.

## Calling a subgraph

1. Add a **Call Subgraph** node.
2. Select it and, in the **Node Inputs** panel, pick the graph to call from the
   **Subgraph** dropdown. (Only graphs currently open in the editor are listed ,
   see [Constraints](#constraints).)
3. The node's dynamic ports update to mirror the chosen graph's contract: an
   input socket per subgraph input, an output socket per subgraph output.

The Call Subgraph node also has three static flow sockets:

- a **`flow`** input that invokes the call, and
- **`started`** and **`completed`** flow outputs.

### Synchronous vs. asynchronous calls

The two flow outputs let you choose the calling style with wiring alone , there's
no mode setting:

- **Synchronous** , wire **`completed`**. It fires after the subgraph has run to
  its `Graph Output` and the result values are available on the output sockets.
- **Asynchronous** , wire **`started`**. It fires immediately when the call
  begins, letting the parent continue while the subgraph runs; read the results
  later when `completed` fires.

A subgraph behaves like a function: it **returns once**, at the first time a
`Graph Output` node is triggered. Outputs that the run never produced come back as
the value type's default (e.g. `0`, `""`), so a caller always gets well-typed
values.

## Live contract updates

Call Subgraph nodes stay in sync with the graphs they reference. If you edit a
subgraph's `Graph Input`/`Graph Output` parameters , add, remove, rename or
retype , every Call Subgraph node that targets it updates its ports
automatically, across all open graphs. You don't need to re-select the graph.

## Recursion and cycles

Subgraphs may call other subgraphs, and a graph may call itself. Execution is
guarded:

- a **maximum call depth** (64 by default) bounds runaway recursion, and
- a **cycle** (a graph already on the current call stack) is detected and refused
  rather than recursing forever.

When a call is refused by these guards, its outputs resolve to type defaults, so
the rest of the graph still runs with well-typed values.

## Constraints

- The called graph must be **open in the editor**, and you must use the
  [**local** runner](./graph-runners#local-in-browser). It resolves subgraphs
  from the currently open graph sessions; calling a graph that isn't open returns
  defaults.
- The **web worker** and **remote** runners do **not** bundle subgraphs (the
  worker and server can't reach your other open graphs), so a Call Subgraph node
  there resolves to defaults. See
  [Graph Runners](./graph-runners) for the execution models.

## Under the hood

The contract is *derived* from the boundary nodes rather than stored separately,
so it can never drift from the graph. At runtime the engine resolves a referenced
graph, seeds its `Graph Input` values, runs it, and collects the `Graph Output`
values back to the caller. For how this is wired into the editor's extension
points, see the [Socket generators](./plugins#socket-generators) section of the
Plugin System reference.
