# Game example

A fixed-timestep game loop. The `game/integrate` event node advances one
entity's position every tick, running on **`RealtimeEngine`**.

## Run it

Open [`game.kbgraph`](game.kbgraph) and press **Run**. Each tick integrates the
entity and logs its position:

```
[game] a.x = 0.500
[game] a.x = 1.000
[game] a.x = 1.500
```

## What it demonstrates

- **Swapping the engine.** [`registry.ts`](registry.ts) exports a `createEngine`
  factory returning a `RealtimeEngine` (an `Engine` subclass that rides the
  engine's execution-strategy seam). The run server uses it instead of the
  default `Engine` — no server changes required.
- **A tick-subscribing event node.** `game/integrate` subscribes to the host
  tick on `init` and unsubscribes on `dispose` — the same lifecycle that makes
  nodes safe to add and remove at runtime.
- **A typed host capability.** The game `World` is provided in the dependency
  bag and read back by capability key.

## Not expressible in a static graph

The original showcase also spawned and despawned entities (and their integrator
nodes) **mid-loop** via `RealtimeEngine.addNode` / `removeNode`. That is a
host-API capability driven by code, so a saved `.kbgraph` can't trigger it; this
example shows the static half (one integrator running on `RealtimeEngine`).
