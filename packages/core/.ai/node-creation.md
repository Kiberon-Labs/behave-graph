# Node Creation Patterns

Use helper functions from `NodeDefinitions.ts` to create nodes.

## FunctionNode (Pure Computation)

For nodes that perform pure computation without side effects:

```typescript
import { makeFunctionNodeDefinition, NodeCategory } from '@kiberon-labs/behave-graph';

export const Add = makeFunctionNodeDefinition({
  typeName: 'math/add',
  category: NodeCategory.Logic,
  label: 'Add',
  in: { a: 'float', b: 'float' },
  out: { result: 'float' },
  exec: ({ read, write }) => {
    write('result', read('a') + read('b'));
  }
});
```

**Key points**:
- No flow sockets
- Evaluated on-demand when outputs are needed
- Must be deterministic (same inputs = same outputs)

## FlowNode (Stateful Flow Control)

For nodes that control execution flow (branches, loops, sequences):

```typescript
import { makeFlowNodeDefinition, NodeCategory } from '@kiberon-labs/behave-graph';

export const Branch = makeFlowNodeDefinition({
  typeName: 'flow/branch',
  category: NodeCategory.Flow,
  label: 'Branch',
  in: { flow: 'flow', condition: 'boolean' },
  out: { true: 'flow', false: 'flow' },
  initialState: undefined,
  triggered: ({ read, commit }) => {
    const condition = read<boolean>('condition');
    commit(condition ? 'true' : 'false');
  }
});
```

**Key points**:
- Has flow input and output sockets
- Requires `initialState` (can be `undefined`)
- `triggered` called when flow arrives
- Use `commit('outputName')` to continue execution

## EventNode (Lifecycle/Events)

For nodes that respond to external events:

```typescript
import { makeEventNodeDefinition, NodeCategory } from '@kiberon-labs/behave-graph';

export const OnStart = makeEventNodeDefinition({
  typeName: 'lifecycle/onStart',
  category: NodeCategory.Event,
  out: { flow: 'flow' },
  initialState: undefined,
  init: ({ commit, graph }) => {
    const emitter = graph.getDependency<ILifecycleEventEmitter>('ILifecycleEventEmitter');
    return emitter?.startEvent.addListener(() => commit('flow'));
  },
  dispose: ({ state }) => state?.() // Cleanup listener
});
```

**Key points**:
- No flow inputs (entry points to graph)
- `init` called once on graph creation
- Return cleanup function or listener reference in state
- `dispose` called on graph teardown

## AsyncNode (Async Operations)

For nodes performing asynchronous operations:

```typescript
import { makeAsyncNodeDefinition, NodeCategory } from '@kiberon-labs/behave-graph';

export const Delay = makeAsyncNodeDefinition({
  typeName: 'time/delay',
  category: NodeCategory.Time,
  in: { flow: 'flow', duration: 'float' },
  out: { flow: 'flow' },
  initialState: undefined,
  triggered: ({ read, commit, finished }) => {
    const duration = read<number>('duration') * 1000;
    const timeout = setTimeout(() => {
      commit('flow');
      finished(); // Signal async completion
    }, duration);
    return timeout; // Store for cleanup
  },
  dispose: ({ state }) => {
    if (state) clearTimeout(state);
  }
});
```

**Key points**:
- Call `finished()` when async operation completes
- Return state for cleanup (timers, listeners, etc.)
- `dispose` called on cancellation or graph teardown

## Socket Definitions

### Simple Sockets

```typescript
in: { a: 'float', b: 'float' }
out: { result: 'float' }
```

### Sockets with Default Values

```typescript
in: { 
  a: { valueType: 'float', defaultValue: 0 },
  b: { valueType: 'float', defaultValue: 1 }
}
```

### Dynamic Sockets (Generated from Config)

```typescript
in: (config, graph) => {
  const sockets = [
    { key: 'flow', valueType: 'flow' },
    { key: 'condition', valueType: 'boolean' }
  ];
  // Add dynamic sockets based on config
  for (let i = 0; i < config.count; i++) {
    sockets.push({ key: `input${i}`, valueType: 'float' });
  }
  return sockets;
}
```

## Node Configuration

For nodes that need user-configurable settings:

```typescript
export const MyNode = makeFlowNodeDefinition({
  typeName: 'custom/myNode',
  configuration: {
    count: {
      valueType: 'integer',
      defaultValue: 3
    }
  },
  // ... rest of definition
});
```

Access in node:
```typescript
triggered: ({ read, configuration }) => {
  const count = configuration.count;
  // ...
}
```
