<!-- intent-skills:start -->
## Skill Loading

Before substantial work:
- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

## CRITICAL RULE — Code Index Tools First

**NEVER do raw file reads (Read tool, cat, head, tail) or Task/explore agents before
using the code-index tools (code-index_search_code_advanced, code-index_find_files,
code-index_get_file_summary, code-index_get_symbol_body, code-index_build_deep_index).
ALWAYS use the index tools to locate and understand code BEFORE reading any files.**

This is the single most important rule. Violating it is unacceptable.

## Project Overview

Behave-Graph is a TypeScript visual node-based programming library (behavior graphs,
similar to Unreal Blueprints). Monorepo using **pnpm workspaces** + **Turborepo**.

**Packages** (all under `packages/`):
- `core` (`@kiberon-labs/behave-graph`) — Engine, nodes, graph I/O, execution. No UI deps.
- `flow` (`@kiberon-labs/behave-graph-flow`) — React visual editor (ReactFlow, Zustand, CSS Modules).
- `compiler` (`@kiberon-labs/behave-graph-compiler`) — Behaviour node compiler to seperate out runtime vs author time details, CLI tool.
- `nodes` A directory containing node specific packages
- `suspendable` (`@kiberon-labs/behave-graph-suspendable`) — Suspendable execution engine.
- `vscode-extension` — VS Code graph editor extension.
- `website` — Astro/Starlight documentation site.

**Always check package-specific `AGENTS.md` and `.ai/` guides before working in a package.**
Key ones: `packages/core/AGENTS.md`, `packages/core/.ai/`, `packages/flow/AGENTS.md`,
`packages/next-app/AGENTS.md`.

### Imports

- **Named imports only** .
- **`import type`** required for type-only imports (`verbatimModuleSyntax`):
  ```typescript
  import type { IGraph } from '../Graphs/Graph.js';
  import { type INode, NodeType } from './NodeInstance.js';
  ```
- **Import order** (not strictly enforced but conventional):
  1. Node built-ins (`node:path`)
  2. External packages (`react`, `three`, `zustand`)
  3. Monorepo packages (`@kiberon-labs/behave-graph`)
  4. Path alias imports (`~/`, `@/`)
  5. Relative imports (`../`, `./`)
- **Cross-package imports**: Always use package name, never relative paths.
  ```typescript
  // Correct
  import { Engine } from '@kiberon-labs/behave-graph';
  // Wrong
  import { Engine } from '../../core/src/Execution/Engine.js';
  ```


### Enums — Use Const Object Pattern

TypeScript `enum` is prohibited (`erasableSyntaxOnly`). Use this pattern:

```typescript
export const NodeType = {
  Event: 'Event',
  Flow: 'Flow',
  Async: 'Async',
  Function: 'Function'
} as const;

export type NodeType = (typeof NodeType)[keyof typeof NodeType];
```

### Types

- **NEVER use `any`** — use proper generics or `unknown` with type guards.
- Prefer explicit return types on public API functions.
- Avoid `@ts-ignore` — fix the typing at the source.
- Use interfaces for behavioral contracts (`INode`, `IGraph`).
- Use type aliases for unions, mapped types, function signatures.
- Type guards as arrow-function constants: `export const isFlowNode = (n: INode): n is IFlowNode =>`.

### Error Handling

- `Assert.mustBeTrue()` for invariant/precondition checks.
- `throw new Error('descriptive message')` — no custom error classes.
- Pattern: try/catch → emit error event → re-throw.
- Use optional chaining for optional dependencies: `getDependency('ILogger')?.log(...)`.

### Functions and Exports
- Destructured object parameters for functions with multiple args.
- Named exports exclusively. Barrel `index.ts` files use `export * from './...'`.

### React Patterns (flow package)

- Functional components only. Type with `React.FC`.
- Zustand for state management via `System` class + React Context.
- **CSS Modules** for styling — never Tailwind CSS in production flow code.
- `useCallback`/`useMemo` for performance.
- `classnames`/`cx` for conditional CSS classes.

### Testing (vitest)

- Test files: `tests/` directory mirroring `src/` structure, `*.test.ts`.
- Use `@/` path alias to import from `src/` in tests.

```typescript
import { describe, expect, it } from 'vitest';
import { testExec } from '@/tests/testUtils';
import { Add } from '@/Profiles/Core/Logic/Add.js';

describe('Add', () => {
  it('adds two numbers', async () => {
    const result = await testExec({
      nodeInputVals: { a: 5, b: 3 },
      nodeDefinition: Add
    });
    expect(result.outputs.result).toBe(8);
  });
});
```

### File Organization

- One primary concept per file (one class, one node definition, etc.).
- Split large files. Prefer multiple files rather than single large massive files
- File structure: imports → types/interfaces → main export → private helpers.
