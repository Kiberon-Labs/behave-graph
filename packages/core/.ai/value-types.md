# Value Types

Custom value types enable you to use domain-specific data structures in your graphs.

## Defining a Value Type

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

**Required properties**:
- `name`: Unique identifier for the value type
- `creator`: Factory function returning default value
- `serialize`: Convert runtime value → JSON-safe format
- `deserialize`: Convert JSON format → runtime value

## Simple Value Types

For value types that don't need transformation:

```typescript
export const BooleanValue: ValueType = {
  name: 'boolean',
  creator: () => false,
  deserialize: (value) => value === 'true' || value === true,
  serialize: (value) => value
};
```

## Complex Value Types

For structured data:

```typescript
export const ColorValue: ValueType = {
  name: 'color',
  creator: () => ({ r: 1, g: 1, b: 1, a: 1 }),
  deserialize: (value: string | object) => {
    if (typeof value === 'string') {
      const [r, g, b, a] = value.split(',').map(parseFloat);
      return { r, g, b, a: a ?? 1 };
    }
    return value;
  },
  serialize: (value: { r: number; g: number; b: number; a: number }) => {
    return `${value.r},${value.g},${value.b},${value.a}`;
  }
};
```

## Registering Value Types

Create a values map for your profile:

```typescript
import type { ValueTypeMap } from './Values/ValueTypeMap';

export const getMyValuesMap = (): ValueTypeMap => {
  const valueTypes = [Vec3Value, QuaternionValue, ColorValue];
  return Object.fromEntries(
    valueTypes.map((vt) => [vt.name, vt])
  );
};
```

Register in profile:

```typescript
export const registerMyProfile = (registry: IRegistry): IRegistry => ({
  values: { ...registry.values, ...getMyValuesMap() },
  nodes: { ...registry.nodes, ...getMyNodesMap() },
  dependencies: { ...registry.dependencies }
});
```

## Using Value Types in Nodes

Reference by name in socket definitions:

```typescript
export const MyNode = makeFunctionNodeDefinition({
  typeName: 'math/vectorAdd',
  in: { a: 'vec3', b: 'vec3' },
  out: { result: 'vec3' },
  exec: ({ read, write }) => {
    const a = read<{ x: number; y: number; z: number }>('a');
    const b = read<{ x: number; y: number; z: number }>('b');
    write('result', {
      x: a.x + b.x,
      y: a.y + b.y,
      z: a.z + b.z
    });
  }
});
```

## Validation

Value type names must match `/^[\w|\[|\]]+$/` (alphanumeric, underscore, brackets).

✅ Valid: `'vec3'`, `'float[]'`, `'my_type'`
❌ Invalid: `'vec-3'`, `'my type'`
