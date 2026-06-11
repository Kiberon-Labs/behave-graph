

# AI Instructions for packages/core

## Overview

The core package contains the behavior graph engine with no UI dependencies. It provides:
- Node system (Function, Flow, Event, Async nodes)
- Registry pattern for nodes and value types
- Graph I/O (JSON serialization/deserialization)
- Execution engine (Engine, Fiber)
- Core node library (math, logic, flow control)

## Critical Rules

- **NEVER use `any` type** - Use proper generics or `unknown` with type guards
- **Node type naming**: Use `category/name` format (e.g., `math/add`, `flow/branch`)
- **Socket naming**: Must match `/^\w+$/` (alphanumeric + underscore only)

## Detailed Guides

- **[Node Creation](.ai/node-creation.md)** - Patterns for Function, Flow, Event, and Async nodes
- **[Value Types](.ai/value-types.md)** - Defining and registering custom value types
- **[Graph JSON](.ai/graph-json.md)** - JSON structure for graphs, nodes, and connections
- **[Common Gotchas](.ai/gotchas.md)** - Core-specific pitfalls and solutions
- **[Testing](.ai/testing.md)** - Testing patterns for nodes and graphs
- **[File Organization](.ai/file-organization.md)** - Project structure and conventions

## Quick Reference

### Value Types

Custom value types require serialization:

```typescript
import type { ValueType } from './Values/ValueType';

export const Vec3Value: ValueType = {
  name: 'vec3',
  creator: () => ({ x: 0, y: 0, z: 0 }),
  deserialize: (value: string) => {
    const [x, y, z] = value.split(',').map(parseFloat);
    return { x, y, z };
  },
  serialize: (value: { x: number; y: number; z: number }) => {
    return `${value.x},${value.y},${value.z}`;
  }
};
```

Register in profile:
```typescript
export const getMyValuesMap = (): ValueTypeMap => {
  const valueTypes = [Vec3Value, QuaternionValue];
  return Object.fromEntries(
    valueTypes.map((vt) => [vt.name, vt])
  );
};
```

## Graph JSON Structure

### Node Definition

```json
{
  "type": "math/add",
  "id": "node-1",
  "label": "My Add Node",
  "parameters": {
    "a": { "value": 5 },
    "b": { "link": { "nodeId": "node-0", "socket": "result" } }
  },
  "flows": {
    "flow": { "nodeId": "node-2", "socket": "flow" }
  }
}
```

**Key differences**:
- Data inputs: Use `parameters` with `value` or `link`
- Flow outputs: Use `flows` with downstream `{nodeId, socket}`

## Common Gotchas

### Socket Naming Rules

Must match `/^\w+$/` (alphanumeric + underscore):

❌ `'input-value'`, `'my input'`
✅ `'inputValue'`, `'input_value'`, `'input1'`


### Link Direction

Links stored **on input sockets** pointing to **upstream outputs**:

```typescript
// Node A → Node B
nodeB.inputs[0].links = [new Link(nodeA.id, 'result')];
```

### Value Type Serialization

All value types must implement serialize/deserialize:

❌ Missing methods:
```typescript
{ name: 'vec3', creator: () => ({ x: 0, y: 0, z: 0 }) }
```

✅ Complete:
```typescript
{ 
  name: 'vec3', 
  creator: () => ({ x: 0, y: 0, z: 0 }),
  serialize: (v) => v,
  deserialize: (v) => v
}
```


## Testing Patterns

Use `testExec` helper:

```typescript
import { testExec } from '@/tests/testUtils';

const result = await testExec({
  nodeInputVals: { a: 5, b: 3 },
  nodeDefinition: Add
});

expect(result.outputs.result).toBe(8);
```

Graph validation:

```typescript
import { readGraphFromJSON, validateGraphAcyclic } from '@kiberon-labs/behave-graph';

const graph = readGraphFromJSON({ graphJson, registry });
expect(validateGraphAcyclic(graph.nodes)).toHaveLength(0);
```

