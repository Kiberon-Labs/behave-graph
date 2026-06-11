---
title: Compiler & Code Generation
description: Separating authoring metadata from runtime execution
---

The Behave-Graph Compiler is a build-time code generation tool that separates authoring-time metadata from runtime execution logic. This separation is fundamental to achieving optimal performance while maintaining excellent developer experience.

## The Problem: Mixed Concerns

Traditional node-based systems often mix authoring metadata with runtime logic:

```typescript
// Traditional approach - everything mixed together
export const addNode = {
  // Authoring metadata (needed in editor)
  category: 'Math',
  description: 'Adds two numbers together',
  label: 'Add',
  color: '#4CAF50',
  icon: 'plus',
  documentation: 'https://docs.example.com/math/add',
  tags: ['arithmetic', 'basic', 'math'],
  
  // Runtime metadata (needed for execution)
  type: 'math/add',
  inputs: ['a', 'b'],
  outputs: ['result'],
  
  // Execution logic
  exec: (context) => {
    context.write('result', context.read('a') + context.read('b'));
  }
};
```

**Problems with this approach:**
1. **Bundle bloat**: Runtime includes unnecessary authoring metadata
2. **Performance**: Extra properties to parse and skip at runtime
3. **Coupling**: UI concerns leak into execution engine
4. **Maintenance**: Changes to UI require changing runtime code

## The Solution: Separation via Compilation

The compiler transforms **developer-friendly TypeScript functions** into **runtime-optimized node definitions**:

### Source (Authoring Time)

```typescript
/**
 * Adds two numbers together
 * @category Math
 * @tags arithmetic, basic
 */
export function add(a: number, b: number, result: Output<number>): void {
  result.value = a + b;
}
```

### Generated (Runtime)

```typescript
import { makeInNOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { add as add_impl } from './mathNodes.js';

export const add = makeInNOutFunctionDesc({
  name: 'add',
  in: { a: 'number', b: 'number' },
  out: { result: 'number' },
  exec: add_impl
});
```

## How It Works

### 1. TypeScript Analysis

The compiler uses TypeScript's compiler API to analyze source files:

```typescript
// Compiler collects:
// - Exported functions
- Parameter types
// - Output<T> parameters (identified as outputs)
// - JSDoc annotations (for metadata)
// - Type imports and references
```

### 2. Type Inference

Parameter types are automatically inferred:

```typescript
function process(
  count: number,              // → input: 'number'
  name: string,               // → input: 'string'
  enabled: boolean,           // → input: 'boolean'
  result: Output<string>,     // → output: 'string'
  valid: Output<boolean>      // → output: 'boolean'
): void {
  // ...
}
```

The compiler:
- Detects `Output<T>` wrapper type
- Extracts `T` as the output value type
- Treats non-Output parameters as inputs
- Validates type compatibility

### 3. Code Generation

Generated code imports the original function and wraps it:

```typescript
// Original function is imported
import { process as process_impl } from './source.js';

// Wrapped in node descriptor
export const process = makeInNOutFunctionDesc({
  name: 'process',
  in: {
    count: 'number',
    name: 'string',
    enabled: 'boolean'
  },
  out: {
    result: 'string',
    valid: 'boolean'
  },
  exec: process_impl  // Reference to original
});
```

## Benefits

### 1. Developer Experience

Write nodes as plain functions:

```typescript
// No boilerplate, just logic
export function lerp(a: number, b: number, t: number, result: Output<number>) {
  result.value = a + (b - a) * t;
}
```

### 2. Type Safety

TypeScript's type checker validates everything:

```typescript
export function convert(
  value: number,
  output: Output<string>  // Type-checked!
): void {
  output.value = value.toString();
}

// Compiler error if types don't match
```

### 3. Separation of Concerns

#### Authoring Environment (Source)
- JSDoc comments for documentation
- Clear parameter names
- Type annotations for validation
- Comments explaining logic

#### Runtime Environment (Generated)
- Minimal metadata (just what's needed)
- Optimized for execution
- No UI-specific data
- Tree-shakeable

### 4. Multiple Targets

The same source can generate different outputs:

```typescript
// Web runtime (minimal)
export const add = makeInNOutFunctionDesc({
  name: 'add',
  in: { a: 'number', b: 'number' },
  out: { result: 'number' },
  exec: add_impl
});

// Editor metadata (rich)
export const addMetadata = {
  description: 'Adds two numbers',
  category: 'Math',
  tags: ['arithmetic'],
  examples: [...]
};
```

### 5. Performance

Runtime bundles are smaller:

```typescript
// Before: ~200 lines per node (with metadata)
// After: ~10 lines per node (just descriptors)
```

## Integration with Flow UI

The compiler works seamlessly with the Flow editor:

### Build Process

```bash
# 1. Compile nodes during build
npx behave-graph-compile src/nodes/*.ts --out dist/nodes.ts

# 2. Bundle with your app
# Generated nodes are imported like any other module
```

### Loading Compiled Nodes

```typescript
import { System } from '@kiberon-labs/behave-graph-flow';
import * as compiledNodes from './dist/nodes';

const system = new System();

// Register all compiled nodes
Object.values(compiledNodes).forEach(nodeDesc => {
  system.registry.getState().registerNode(nodeDesc);
});
```

### Metadata for UI

Authoring metadata can be kept separate:

```typescript
// nodes/metadata.ts (not compiled, used only in editor)
export const nodeMetadata = {
  'math/add': {
    description: 'Adds two numbers',
    category: 'Math',
    icon: 'plus',
    color: '#4CAF50'
  },
  // ...
};

// In editor
import { nodeMetadata } from './metadata';

system.registry.getState().setMetadata(nodeMetadata);
```

## Advanced Patterns

### 1. Class-Based Nodes

```typescript
export class Vector3Math {
  static exec(
    a: Vector3,
    b: Vector3,
    operation: string,
    result: Output<Vector3>
  ): void {
    switch (operation) {
      case 'add':        result.value = { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
        break;
      case 'subtract':
        result.value = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
        break;
    }
  }
}

// Generates: { exec: Vector3Math.exec }
```

### 2. Multi-Output Nodes

```typescript
export function divmod(
  dividend: number,
  divisor: number,
  quotient: Output<number>,
  remainder: Output<number>
): void {
  quotient.value = Math.floor(dividend / divisor);
  remainder.value = dividend % divisor;
}

// Generates two outputs: quotient, remainder
```

### 3. Custom Value Types

```typescript
type Color = { r: number; g: number; b: number; a: number };

export function blendColors(
  color1: Color,
  color2: Color,
  factor: number,
  result: Output<Color>
): void {
  result.value = {
    r: color1.r + (color2.r - color1.r) * factor,
    g: color1.g + (color2.g - color1.g) * factor,
    b: color1.b + (color2.b - color1.b) * factor,
    a: color1.a + (color2.a - color1.a) * factor
  };
}
```

### 4. Conditional Outputs

```typescript
export function parseNumber(
  input: string,
  value: Output<number>,
  isValid: Output<boolean>
): void {
  const parsed = Number(input);
  value.value = parsed;
  isValid.value = !isNaN(parsed);
}
```

## Configuration

### Compiler Options

```typescript
import { generateNodesFromFile } from '@kiberon-labs/behave-graph-compiler';

const { code, nodes } = generateNodesFromFile('src/nodes.ts', {
  // Module names to search for behave-graph imports
  behaveGraphModuleNames: ['@kiberon-labs/behave-graph'],
  
  // Additional files (ambient types, etc.)
  extraRootFiles: ['src/types/global.d.ts'],
  
  // TypeScript compiler options
  compilerOptions: {
    strict: true,
    target: 'ESNext',
    module: 'ESNext'
  },
  
  // Output file path for relative imports
  outputFilePath: 'dist/generated-nodes.ts'
});
```

### Build Integration

#### package.json

```json
{
  "scripts": {
    "build:nodes": "behave-graph-compile src/nodes/**/*.ts --out dist/nodes.ts",
    "build": "npm run build:nodes && vite build",
    "dev": "npm run build:nodes && vite"
  }
}
```

#### Watch Mode

```bash
# Watch for changes and recompile
npx behave-graph-compile src/nodes/*.ts --out dist/nodes.ts --watch
```

## Comparison: Before vs After

### Before Compilation

**Developer writes:**
```typescript
export const complexNode = {
  type: 'custom/complex',
  category: 'Advanced',
  description: 'Complex operation',
  in: {
    input1: { type: 'number', default: 0 },
    input2: { type: 'string', default: '' }
  },
  out: {
    result: 'boolean'
  },
  exec: (inputs) => {
    // Logic here
  }
};
```

**Bundle includes:** All metadata + logic (~50-100 lines)

### After Compilation

**Developer writes:**
```typescript
export function complex(
  input1: number,
  input2: string,
  result: Output<boolean>
): void {
  // Logic here
}
```

**Compiler generates:**
```typescript
export const complex = makeInNOutFunctionDesc({
  name: 'complex',
  in: { input1: 'number', input2: 'string' },
  out: { result: 'boolean' },
  exec: complex_impl
});
```

**Bundle includes:** Minimal descriptor + logic (~10 lines)

## Best Practices

### 1. Explicit Types

Always annotate parameter types:

```typescript
// ✅ Good
export function process(value: number, out: Output<string>): void {
  out.value = value.toString();
}

// ❌ Bad - compiler can't infer
export function process(value, out) {
  out.value = value.toString();
}
```

### 2. Descriptive Names

Use clear, self-documenting names:

```typescript
// ✅ Good
export function calculateDistance(
  x1: number, y1: number,
  x2: number, y2: number,
  distance: Output<number>
): void {
  // ...
}

// ❌ Bad
export function calc(a: number, b: number, c: number, d: number, o: Output<number>): void {
  // ...
}
```

### 3. JSDoc for Metadata

Use JSDoc for authoring metadata:

```typescript
/**
 * Interpolates between two values
 * @category Math
 * @tags interpolation, animation
 */
export function lerp(a: number, b: number, t: number, result: Output<number>): void {
  result.value = a + (b - a) * t;
}
```

## Troubleshooting

### Type Inference Issues

**Problem:** Compiler can't infer output type

**Solution:** Ensure `Output<T>` is properly imported:

```typescript
import type { Output } from '@kiberon-labs/behave-graph';

export function myNode(out: Output<number>): void {
  //                      ^^^^^^ This must be the exact Output type
  out.value = 42;
}
```

### Module Resolution

**Problem:** Generated imports don't resolve

**Solution:** Set `outputFilePath` option:

```typescript
generateNodesFromFile('src/nodes.ts', {
  outputFilePath: 'dist/nodes.ts'  // Compiler will calculate relative path
});
```

## Next Steps

- [Compiler CLI Reference](../reference/compiler-cli) - Command-line options
- [Plugin System](./plugins) - Loading compiled nodes as plugins
- [Custom Value Types](../core-concepts/values) - Defining custom types
