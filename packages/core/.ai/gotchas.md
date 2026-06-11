# Core Package Gotchas

## Socket Naming Rules

Socket names must match `/^\w+$/` (alphanumeric + underscore only).

❌ Bad:
```typescript
in: { 'input-value': 'float' }  // Hyphens not allowed
in: { 'my input': 'float' }     // Spaces not allowed
in: { 'flow/input': 'float' }   // Slashes not allowed
```

✅ Good:
```typescript
in: { inputValue: 'float' }
in: { input_value: 'float' }
in: { input1: 'float' }
```

## Node Type Naming

Node type names must use `category/name` format (lowercase, slash-separated).

❌ Bad:
```typescript
typeName: 'Add'           // Missing category
typeName: 'math_add'      // Underscore instead of slash
typeName: 'Math/Add'      // Uppercase (avoid for consistency)
```

✅ Good:
```typescript
typeName: 'math/add'
typeName: 'flow/branch'
typeName: 'logic/and'
```

## Graph Cycles

Flow graphs **must be acyclic**. The validator will catch this.

❌ Creates cycle:
```json
{
  "nodes": [
    {
      "id": "1",
      "type": "flow/branch",
      "flows": { "true": { "nodeId": "2", "socket": "flow" } }
    },
    {
      "id": "2",
      "type": "debug/log",
      "flows": { "flow": { "nodeId": "1", "socket": "flow" } }
    }
  ]
}
```

**Note**: Data flow (non-flow sockets) CAN have cycles - only flow sockets are restricted.

## Link Direction (Counterintuitive!)

Links are stored **on input sockets** pointing to **upstream output sockets**.

```typescript
// Node A outputs → Node B inputs
// Link is stored ON NODE B's input socket:
nodeB.inputs[0].links = [
  new Link(nodeA.id, 'result')  // Points to nodeA's output
];
```

In JSON:
```json
{
  "id": "nodeB",
  "parameters": {
    "value": {
      "link": { "nodeId": "nodeA", "socket": "result" }
    }
  }
}
```

This can be confusing - the link is on the *downstream* node but points *upstream*.

## Value Type Serialization

All value types **must** implement `serialize` and `deserialize`.

❌ Missing methods:
```typescript
export const Vec3Value: ValueType = {
  name: 'vec3',
  creator: () => ({ x: 0, y: 0, z: 0 })
  // ← Missing serialize/deserialize!
};
```

✅ Complete:
```typescript
export const Vec3Value: ValueType = {
  name: 'vec3',
  creator: () => ({ x: 0, y: 0, z: 0 }),
  serialize: (v) => v,
  deserialize: (v) => v
};
```

## Node Registration

Nodes must be registered in the registry before use.

❌ Error: "no registered node descriptions with typeName X"
```typescript
const graph = readGraphFromJSON({ 
  graphJson, 
  registry: { nodes: {}, values: {}, dependencies: {} } 
});
```

✅ Register first:
```typescript
let registry = registerCoreProfile({
  nodes: {},
  values: {},
  dependencies: {}
});
const graph = readGraphFromJSON({ graphJson, registry });
```

## Socket Value Types

Socket value types must exist in the registry.

❌ Error: "unknown value type"
```typescript
// Using 'vec3' without registering Vec3Value
makeFunctionNodeDefinition({
  in: { position: 'vec3' }  // ← Vec3Value not in registry!
});
```

✅ Register value type first:
```typescript
registry = {
  values: { ...registry.values, vec3: Vec3Value },
  nodes: { ...registry.nodes },
  dependencies: {}
};
```

## Flow Socket JSON Representation

Flow sockets stored differently than data sockets.

```json
{
  "type": "flow/branch",
  "flows": {
    "true": { "nodeId": "downstream", "socket": "flow" }
  },
  "parameters": {
    "condition": { "value": true }
  }
}
```

- `flows`: Flow **outputs** (execution paths)
- `parameters`: Data **inputs** (values or links)

**Never** define flow inputs in JSON - they're inferred from upstream `flows`.

## State Initialization

Flow/Event/Async nodes require `initialState`.

❌ Missing initialState:
```typescript
makeFlowNodeDefinition({
  typeName: 'my/node',
  // ...
  triggered: ({ state, read }) => {
    // state is undefined here!
  }
});
```

✅ Provide initialState:
```typescript
makeFlowNodeDefinition({
  typeName: 'my/node',
  // ...
  initialState: 0,  // or undefined, [], {}, etc.
  triggered: ({ state, read }) => {
    // state is now typed and initialized
  }
});
```

## Dependency Injection

Dependencies must be in registry **before** graph loading.

❌ Too late:
```typescript
const graph = readGraphFromJSON({ graphJson, registry });
// Later: graph.getDependency('ILogger') → undefined!
```

✅ Set up first:
```typescript
const registry = registerCoreProfile({
  nodes: {},
  values: {},
  dependencies: {
    ILogger: new Logger(),
    ILifecycleEventEmitter: new ManualLifecycleEventEmitter()
  }
});
const graph = readGraphFromJSON({ graphJson, registry });
```

## Async Node Cleanup

Always cleanup async operations in `dispose`.

❌ Memory leak:
```typescript
makeAsyncNodeDefinition({
  triggered: ({ commit, finished }) => {
    setTimeout(() => {
      commit('flow');
      finished();
    }, 1000);
    // No return value = no cleanup!
  }
});
```

✅ Proper cleanup:
```typescript
makeAsyncNodeDefinition({
  triggered: ({ commit, finished }) => {
    const timeout = setTimeout(() => {
      commit('flow');
      finished();
    }, 1000);
    return timeout; // Store for cleanup
  },
  dispose: ({ state }) => {
    if (state) clearTimeout(state);
  }
});
```
