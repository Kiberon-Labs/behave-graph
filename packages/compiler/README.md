# Behave-Graph Compiler

**Prototype**

A TypeScript-to-Behave-Graph node compiler that automatically generates runtime-optimized node definitions from TypeScript functions, separating authoring-time metadata from runtime execution logic.

## Overview

The Behave-Graph Compiler is a build-time tool that analyzes TypeScript functions and generates corresponding node definitions for the Behave-Graph engine. It enables developers to write nodes using familiar TypeScript syntax while automatically handling the translation to graph nodes with proper type inference, input/output detection, and metadata generation.

### Key Benefits

- **Separation of Concerns**: Decouples UI/authoring metadata from runtime execution code
- **Type Safety**: Leverages TypeScript's type system for automatic input/output inference
- **Developer Experience**: Write nodes as plain TypeScript functions with type annotations
- **Performance**: Generated nodes are optimized for runtime without authoring overhead
- **Maintainability**: Single source of truth for node logic the TypeScript function itself

## Installation

```bash
pnpm add -D @kiberon-labs/behave-graph-compiler
```

## Usage

### CLI

The compiler provides a command-line interface for generating node definitions:

```bash
# Generate to stdout
behave-graph-compile src/nodes/myNodes.ts

# Generate to file
behave-graph-compile src/nodes/myNodes.ts --out dist/generated-nodes.ts

# With ambient type definitions
behave-graph-compile src/nodes/myNodes.ts --out dist/nodes.ts --dts types/ambient.d.ts
```

### Programmatic API

```typescript
import { generateNodesFromFile, writeGeneratedNodesToFile } from '@kiberon-labs/behave-graph-compiler';

// Generate code as string
const { code, nodes, diagnostics } = generateNodesFromFile('src/nodes.ts', {
  outputFilePath: 'dist/nodes.ts',
  behaveGraphModuleNames: ['@kiberon-labs/behave-graph'],
  compilerOptions: {
    strict: true,
    target: 'ESNext'
  }
});

// Write directly to file
const { nodes, diagnostics } = writeGeneratedNodesToFile(
  'src/nodes.ts',
  'dist/generated-nodes.ts'
);
```

## Writing Compilable Nodes

### Basic Function Node

Export a function with typed parameters. The compiler infers inputs from regular parameters:

```typescript
import type { Output } from '@kiberon-labs/behave-graph';

export function add(a: number, b: number, result: Output<number>): void {
  result.value = a + b;
}
```

This generates a node definition with:
- **Inputs**: `a` (number), `b` (number)
- **Outputs**: `result` (number)

### Output Parameter Detection

The compiler automatically detects output parameters using the `Output<T>` type:

```typescript
export function multiply(
  x: number,
  y: number,
  product: Output<number>,
  doubled: Output<number>
): void {
  product.value = x * y;
  doubled.value = product.value * 2;
}
```

Generated node has:
- **Inputs**: `x`, `y`
- **Outputs**: `product`, `doubled`

### Arrow Functions

Arrow functions assigned to exported variables are also supported:

```typescript
export const subtract = (a: number, b: number, result: Output<number>): void => {
  result.value = a - b;
};
```

### Class-Based Nodes

Export classes with a static `exec` method:

```typescript
export class MathOperations {
  static exec(
    operation: string,
    a: number,
    b: number,
    result: Output<number>
  ): void {
    switch (operation) {
      case 'add':
        result.value = a + b;
        break;
      case 'subtract':
        result.value = a - b;
        break;
      // ...
    }
  }
}
```

## How It Works

### Compilation Pipeline

1. **Parse**: TypeScript source files are parsed into an AST
2. **Analyze**: Exported functions are identified and analyzed
3. **Infer Types**: Parameter types are inferred using TypeScript's type checker
4. **Detect Outputs**: `Output<T>` parameters are identified as outputs
5. **Generate**: Node definition code is emitted with proper imports and metadata
6. **Format**: Generated code is formatted for readability

### Type Analysis

The compiler uses TypeScript's type checker to:
- Determine value types from parameter type annotations
- Identify `Output<T>` wrapper types (by name and symbol)
- Extract generic type arguments from `Output<T>`
- Handle type aliases and imported types
- Validate type compatibility

### Generated Code Structure

For a source file `mathNodes.ts`:

```typescript
export function add(a: number, b: number, result: Output<number>): void {
  result.value = a + b;
}
```

The compiler generates:

```typescript
import { makeInNOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { add as add_impl } from './mathNodes.js';

export const add = makeInNOutFunctionDesc({
  name: 'add',
  in: {
    a: 'number',
    b: 'number'
  },
  out: {
    result: 'number'
  },
  exec: add_impl
});
```

## Configuration Options

### `GenerateNodesOptions`

```typescript
type GenerateNodesOptions = {
  // Module names to search for behave-graph imports
  behaveGraphModuleNames?: string[];
  
  // Additional files to include (e.g., ambient types)
  extraRootFiles?: string[];
  
  // TypeScript compiler options
  compilerOptions?: ts.CompilerOptions;
  
  // Output file path for computing relative imports
  outputFilePath?: string;
  
  // Override module specifier for source imports
  sourceModuleSpecifier?: string;
};
```

## Architecture

### Separation of Authoring and Runtime

Traditional node definitions mix authoring metadata (descriptions, categories, UI hints) with runtime logic. The compiler enables separation:

**Authoring Time** (Source TS):
```typescript
/**
 * @category Math
 * @description Adds two numbers
 */
export function add(a: number, b: number, result: Output<number>): void {
  result.value = a + b;
}
```

**Runtime** (Generated):
```typescript
export const add = makeInNOutFunctionDesc({
  name: 'add',
  in: { a: 'number', b: 'number' },
  out: { result: 'number' },
  exec: add_impl  // Pure runtime logic, no metadata overhead
});
```

This separation:
- Reduces runtime bundle size (metadata can be tree-shaken)
- Enables different metadata for different contexts (web UI vs embedded)
- Simplifies node logic (just write the function)
- Improves runtime performance (no metadata parsing)

## Integration with Behave-Graph Flow

The compiler complements the Flow UI package by:

1. **Build-Time Code Gen**: Nodes are compiled before bundling
2. **Metadata Stripping**: UI-specific data stays in source, not runtime
3. **Type Preservation**: Full type safety from source to generated nodes
4. **Hot Module Replacement**: Changes to source functions auto-regenerate nodes

## Best Practices

### Type Annotations

Always provide explicit type annotations for parameters:

```typescript
// ✅ Good: Explicit types
export function process(value: number, output: Output<string>): void {
  output.value = value.toString();
}

// ❌ Bad: Inferred types may not translate correctly
export function process(value, output) {
  output.value = value.toString();
}
```

### Output Parameters

Use `Output<T>` exclusively for outputs, regular parameters for inputs:

```typescript
// ✅ Good: Clear input/output distinction
export function convert(
  input: number,
  result: Output<string>,
  isValid: Output<boolean>
): void {
  result.value = input.toString();
  isValid.value = !isNaN(input);
}
```

### Naming Conventions

Use descriptive names that reflect the node's purpose:

```typescript
// ✅ Good: Clear, descriptive names
export function calculateDistance(x1: number, y1: number, x2: number, y2: number, distance: Output<number>): void {
  // ...
}

// ❌ Avoid: Generic names
export function calc(a: number, b: number, c: number, d: number, out: Output<number>): void {
  // ...
}
```

## Examples

See the `tests/` directory for comprehensive examples of:
- Function-based nodes
- Class-based nodes  
- Multi-output nodes
- Custom value types
- Integration with profiles

## Contributing

When contributing to the compiler:
1. Add tests for new features in `tests/`
2. Ensure TypeScript diagnostics are handled gracefully
3. Update this README with new capabilities
4. Follow the existing code structure (collector → analyzer → emitter → formatter)


