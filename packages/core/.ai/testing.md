# Testing Patterns

## Testing Function Nodes

Use the `testExec` helper:

```typescript
import { testExec } from '@/tests/testUtils';
import { Add } from '@/Profiles/Core/Values/FloatNodes';
import { describe, test, expect } from 'vitest';

describe('Add', () => {
  test('adds two numbers', async () => {
    const result = await testExec({
      nodeInputVals: { a: 5, b: 3 },
      nodeDefinition: Add
    });
    
    expect(result.outputs.result).toBe(8);
  });
  
  test('handles negative numbers', async () => {
    const result = await testExec({
      nodeInputVals: { a: -5, b: 3 },
      nodeDefinition: Add
    });
    
    expect(result.outputs.result).toBe(-2);
  });
});
```

## Testing Graph Loading

Validate JSON graphs:

```typescript
import { readGraphFromJSON, validateGraphAcyclic, validateGraphLinks } from '@kiberon-labs/behave-graph';
import * as graphJson from './graphs/MyGraph.json';
import { registerCoreProfile } from '@/Profiles/Core/registerCoreProfile';

const registry = registerCoreProfile({
  nodes: {},
  values: {},
  dependencies: {}
});

test('loads graph without errors', () => {
  const graph = readGraphFromJSON({ graphJson, registry });
  
  expect(validateGraphLinks(graph.nodes)).toHaveLength(0);
  expect(validateGraphAcyclic(graph.nodes)).toHaveLength(0);
});
```

## Testing Registry Validation

```typescript
import { validateNodeRegistry, validateValueRegistry } from '@kiberon-labs/behave-graph';

test('valid node registry', () => {
  const errors = validateNodeRegistry(registry);
  expect(errors).toHaveLength(0);
});

test('valid value registry', () => {
  const errors = validateValueRegistry(registry.values);
  expect(errors).toHaveLength(0);
});
```

## Testing Flow Nodes

Flow nodes require graph execution:

```typescript
import { Engine } from '@/Execution/Engine';

test('branch takes true path', async () => {
  const graph = readGraphFromJSON({
    graphJson: {
      nodes: [
        { type: 'lifecycle/onStart', id: '0' },
        { 
          type: 'flow/branch', 
          id: '1',
          parameters: { condition: { value: true } },
          flows: { flow: { nodeId: '0', socket: 'flow' } }
        },
        {
          type: 'debug/log',
          id: '2',
          parameters: { text: { value: 'True!' } },
          flows: { flow: { nodeId: '1', socket: 'true' } }
        }
      ]
    },
    registry
  });
  
  const engine = new Engine(graph);
  await engine.executeAllAsync();
  
  // Assert on execution results, logs, etc.
});
```

## Testing Event Nodes

```typescript
import { ManualLifecycleEventEmitter } from '@/Profiles/Core/Abstractions/Drivers/ManualLifecycleEventEmitter';

test('onStart triggers', async () => {
  const emitter = new ManualLifecycleEventEmitter();
  const registry = registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {
      ILifecycleEventEmitter: emitter
    }
  });
  
  const graph = readGraphFromJSON({ graphJson, registry });
  const engine = new Engine(graph);
  
  emitter.startEvent.emit();
  await engine.executeAllAsync();
  
  // Assert on results
});
```

## Testing Value Serialization

```typescript
test('vec3 serialization round-trip', () => {
  const original = { x: 1, y: 2, z: 3 };
  const serialized = Vec3Value.serialize(original);
  const deserialized = Vec3Value.deserialize(serialized);
  
  expect(deserialized).toEqual(original);
});

test('handles string input', () => {
  const deserialized = Vec3Value.deserialize('1,2,3');
  expect(deserialized).toEqual({ x: 1, y: 2, z: 3 });
});
```

## Testing Async Nodes

```typescript
test('delay waits specified duration', async () => {
  const startTime = Date.now();
  
  const graph = readGraphFromJSON({
    graphJson: {
      nodes: [
        { type: 'lifecycle/onStart', id: '0' },
        {
          type: 'time/delay',
          id: '1',
          parameters: { duration: { value: 0.1 } }, // 100ms
          flows: { flow: { nodeId: '0', socket: 'flow' } }
        }
      ]
    },
    registry
  });
  
  const engine = new Engine(graph);
  await engine.executeAllAsync();
  
  const elapsed = Date.now() - startTime;
  expect(elapsed).toBeGreaterThanOrEqual(100);
  expect(elapsed).toBeLessThan(200);
});
```

## Common Test Patterns

### Setup/Teardown

```typescript
describe('MyNodes', () => {
  let registry: IRegistry;
  
  beforeEach(() => {
    registry = registerCoreProfile({
      nodes: {},
      values: {},
      dependencies: {
        ILogger: new Logger()
      }
    });
  });
  
  test('...', () => {
    // Use registry
  });
});
```

### Parameterized Tests

```typescript
const testCases = [
  { a: 5, b: 3, expected: 8 },
  { a: -2, b: 7, expected: 5 },
  { a: 0, b: 0, expected: 0 }
];

testCases.forEach(({ a, b, expected }) => {
  test(`${a} + ${b} = ${expected}`, async () => {
    const result = await testExec({
      nodeInputVals: { a, b },
      nodeDefinition: Add
    });
    expect(result.outputs.result).toBe(expected);
  });
});
```
