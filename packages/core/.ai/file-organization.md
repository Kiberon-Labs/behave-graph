# File Organization

## Directory Structure

```
src/
├── Execution/
│   ├── Engine.ts              # Graph execution engine
│   └── Fiber.ts               # Per-node execution state
├── Graphs/
│   ├── Graph.ts               # Graph API and types
│   ├── IO/
│   │   ├── GraphJSON.ts       # JSON type definitions
│   │   ├── readGraphFromJSON.ts
│   │   └── writeGraphToJSON.ts
│   └── Validation/
│       ├── validateGraphAcyclic.ts
│       └── validateGraphLinks.ts
├── Nodes/
│   ├── Node.ts                # Base node class
│   ├── NodeDefinitions.ts     # makeXxxNodeDefinition helpers
│   ├── NodeInstance.ts        # Node instance types
│   ├── FunctionNode.ts
│   ├── FlowNode.ts
│   ├── EventNode.ts
│   ├── AsyncNode.ts
│   ├── Registry/
│   │   ├── NodeDescription.ts
│   │   └── NodeDefinitionsMap.ts
│   └── Validation/
│       └── validateNodeRegistry.ts
├── Profiles/
│   ├── Core/
│   │   ├── registerCoreProfile.ts
│   │   ├── Flow/              # Flow control nodes
│   │   │   ├── Branch.ts
│   │   │   ├── Sequence.ts
│   │   │   └── ...
│   │   ├── Logic/             # Math/logic nodes
│   │   │   └── ...
│   │   ├── Values/            # Value type definitions
│   │   │   ├── BooleanValue.ts
│   │   │   ├── FloatNodes.ts
│   │   │   └── ...
│   │   ├── Lifecycle/         # Lifecycle event nodes
│   │   └── Time/              # Time-related nodes
│   └── registerSerializersForValueType.ts
├── Sockets/
│   └── Socket.ts
├── Values/
│   ├── ValueType.ts           # ValueType interface
│   ├── ValueTypeMap.ts
│   ├── Variables/
│   │   └── Variable.ts
│   └── Validation/
│       └── validateValueRegistry.ts
└── index.ts                   # Main exports

tests/
├── testUtils.ts               # Test helpers (testExec)
├── Graphs/
│   └── IO/
│       └── readGraphFromJSON.test.ts
└── profiles/
    └── core/
        └── registerCoreProfile.test.ts
```

## Adding New Nodes

### 1. Create Node File

Place in appropriate category:

```typescript
// src/Profiles/Core/Logic/MyNode.ts
import { makeFunctionNodeDefinition, NodeCategory } from '@kiberon-labs/behave-graph';

export const MyNode = makeFunctionNodeDefinition({
  typeName: 'logic/myNode',
  category: NodeCategory.Logic,
  label: 'My Node',
  in: { /* ... */ },
  out: { /* ... */ },
  exec: ({ read, write }) => {
    // Implementation
  }
});
```

### 2. Export from Barrel File

```typescript
// src/Profiles/Core/Logic/index.ts
export * from './MyNode.js';
export * from './OtherNode.js';
```

### 3. Register in Profile

```typescript
// src/Profiles/Core/registerCoreProfile.ts
import * as LogicNodes from './Logic/index.js';

export const getCoreNodesMap = memo<Record<string, NodeDefinition>>(() => {
  const nodeDefinitions = [
    ...getNodeDescriptions(LogicNodes),
    // ...
  ];
  return Object.fromEntries(
    nodeDefinitions.map((nd) => [nd.typeName, nd])
  );
});
```

## Adding New Value Types

### 1. Create Value Type

```typescript
// src/Profiles/Core/Values/MyValue.ts
import type { ValueType } from '../../../Values/ValueType.js';

export const MyValue: ValueType = {
  name: 'myType',
  creator: () => (/* default value */),
  serialize: (value) => value,
  deserialize: (value) => value
};
```

### 2. Register in Profile

```typescript
// src/Profiles/Core/registerCoreProfile.ts
import { MyValue } from './Values/MyValue.js';

export const getCoreValuesMap = memo<ValueTypeMap>(() => {
  const valueTypes = [BooleanValue, StringValue, MyValue];
  return Object.fromEntries(
    valueTypes.map((vt) => [vt.name, vt])
  );
});
```

## Naming Conventions

### Files

- PascalCase for node/value files: `Branch.ts`, `FloatValue.ts`
- camelCase for utilities: `testUtils.ts`, `nodeFactory.ts`

### Exports

- Named exports for nodes: `export const Branch = ...`
- Named exports for values: `export const FloatValue: ValueType = ...`

### Node Type Names

- Lowercase with slash: `'math/add'`, `'flow/branch'`
- Category first, then name
- Use existing categories when possible

### Socket Names

- camelCase: `'inputValue'`, `'result'`
- Or snake_case: `'input_value'`
- No hyphens or spaces

## Import Paths

### Within Core Package

Use relative imports:

```typescript
import { Socket } from '../Sockets/Socket.js';
import type { ValueType } from '../Values/ValueType.js';
```

### From Other Packages

Use package name:

```typescript
// In packages/scene/src/...
import { makeFunctionNodeDefinition } from '@kiberon-labs/behave-graph';
```

## Test File Organization

Mirror source structure:

```
tests/
└── Graphs/
    └── IO/
        └── readGraphFromJSON.test.ts  # Tests src/Graphs/IO/readGraphFromJSON.ts
```

Test file naming:
- `*.test.ts` for unit tests
- Co-locate with source or in `tests/` directory
