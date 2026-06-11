# Creating Custom Specifics for Nodes

Specifics are UI extensions that add custom controls and functionality to specific node types. They allow you to create dynamic interfaces for nodes with configurable sockets, special controls, or custom rendering.

## What are Specifics?

A "specific" is a React component that gets rendered inside a node when certain conditions are met. It's perfect for:
- Adding/removing dynamic sockets (like the Switch nodes)
- Custom dropdown controls (like Custom Event selection)
- Preview panels (like image previews)
- Any node-specific UI controls

## Creating a Specific

A specific consists of three parts:

1. **Check function** - Determines if this specific applies to a node
2. **Render component** - The React component to render
3. **Unique name** - An identifier for the specific

### Example: Dynamic Socket Management

Here's how the SwitchOnString specific works:

```typescript
import React, { useCallback } from 'react';
import { VscodeButton } from '@vscode-elements/react-elements';
import { Plus, Minus } from 'iconoir-react';
import { useSystem } from '@/system/provider';
import type { SpecificRenderProps } from '@/store/specific';

const NAME = 'flow/switch/string.dynamicSockets';

export function getSwitchOnStringSpecific() {
  return {
    name: NAME,
    check: (spec: any) => spec?.type === 'flow/switch/string',
    render: SwitchOnStringSpecific
  };
}

const SwitchOnStringSpecific: React.FC<SpecificRenderProps> = ({ node }) => {
  const system = useSystem();
  const numCases = node.data?.configuration?.numCases ?? 0;

  const updateNumCases = useCallback(
    (newNumCases: number) => {
      if (newNumCases < 0) return;

      // Update the node configuration
      system.nodeStore.getState().setNodes((prev) =>
        prev.map((n: any) => {
          if (n.id !== node.id) return n;
          return {
            ...n,
            data: {
              ...n.data,
              configuration: {
                ...n.data?.configuration,
                numCases: newNumCases
              }
            }
          };
        })
      );

      // Invalidate cache to trigger socket recalculation
      system.flowStore.getState().invalidateCache();
    },
    [node.id, system]
  );

  const addCase = useCallback(() => {
    updateNumCases(numCases + 1);
  }, [numCases, updateNumCases]);

  const removeCase = useCallback(() => {
    updateNumCases(Math.max(0, numCases - 1));
  }, [numCases, updateNumCases]);

  return (
    <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.9 }}>Cases: {numCases}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        <VscodeButton onClick={addCase}>
          <Plus width={16} height={16} /> Add Case
        </VscodeButton>
        <VscodeButton onClick={removeCase} disabled={numCases === 0}>
          <Minus width={16} height={16} /> Remove
        </VscodeButton>
      </div>
    </div>
  );
};
```

## Registering Specifics

### Built-in Registration

Default specifics are automatically registered in `registerDefaultSpecifics`. To add yours:

```typescript
// In registerDefaultSpecifics.ts
import { getYourCustomSpecific } from './YourCustomSpecific';

export function registerDefaultSpecifics(system: System): () => void {
  const store = system.specificStore.getState();
  
  const yourCustom = getYourCustomSpecific();
  store.registerSpecific(yourCustom);
  
  return () => {
    system.specificStore.getState().unregisterSpecific(yourCustom.name);
  };
}
```

### External Registration

You can also register specifics from external packages:

```typescript
import { System } from '@kiberon-labs/behave-graph-flow';
import { getSwitchOnStringSpecific } from '@kiberon-labs/behave-graph-flow';

export function registerMyPlugin(system: System) {
  const switchSpecific = getSwitchOnStringSpecific();
  system.specificStore.getState().registerSpecific(switchSpecific);
  
  // Or create your own
  const mySpecific = {
    name: 'my-custom-specific',
    check: (spec) => spec.type === 'my/custom/node',
    render: MyCustomComponent
  };
  
  system.specificStore.getState().registerSpecific(mySpecific);
}
```

## Key Patterns

### Updating Node Configuration

When your specific needs to update node configuration (like changing socket counts):

```typescript
system.nodeStore.getState().setNodes((prev) =>
  prev.map((n: any) => {
    if (n.id !== node.id) return n;
    return {
      ...n,
      data: {
        ...n.data,
        configuration: {
          ...n.data?.configuration,
          yourConfigKey: newValue
        }
      }
    };
  })
);

// Important: Invalidate cache to recalculate sockets
system.flowStore.getState().invalidateCache();
```

### Accessing Node Data

The `node` prop contains:
- `id` - Node ID
- `data` - Node data (configuration, ports, annotations)
- `spec` - Node specification
- `selected` - Whether node is selected

## Available Specifics

Currently registered specifics:

1. **CustomEventOnTriggered** - Dropdown for selecting custom events
2. **SwitchOnString** - Add/remove string case sockets
3. **SwitchOnInteger** - Add/remove integer case sockets

## Tips

- Keep specifics focused on a single node type
- Use unique names to avoid conflicts
- Always invalidate the flow cache when changing node configuration that affects sockets
- Use inline styles or CSS modules (not Tailwind per AI instructions)
- Leverage the `useSystem` hook to access all system stores
