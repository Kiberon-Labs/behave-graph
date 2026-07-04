import { type System } from '@/system/system';
import type { NodeDocumentation } from '@/store/documentation';
import { BounceRight, Flash, GitFork, PauseWindow } from 'iconoir-react';
import { DocumentationBrowserPanel } from './panel';
import { ErrorBoundary } from 'react-error-boundary';
import { MenuItemElement } from '../../components/menubar/menuItem';
import { plugin } from '@/system/plugin';

/**
 * This is a plugin that sets up default documentation for core behave-graph nodes.
 * It uses the documentation store to add rich markdown descriptions,
 * short descriptions, and tags for various node types.
 * @param sys
 */
export const docsPluginLoader = (sys: System, _options: void) => {
  const docStore = sys.documentationStore.getState();

  sys.tabLoader.register('docbrowser', () => {
    return {
      id: 'docbrowser',
      closable: true,
      cached: true,
      title: 'Documentation',
      group: 'headless',
      content: () => (
        <ErrorBoundary fallback={'whoops'}>
          <DocumentationBrowserPanel />
        </ErrorBoundary>
      )
    };
  });

  // Flow control nodes
  const flowDocs: NodeDocumentation[] = [
    {
      type: 'flow/debounce',
      shortDescription: 'Debounce rapid flow executions',
      tags: ['flow', 'control', 'async'],
      markdownDescription: `
Prevents a flow from executing too frequently by enforcing a minimum delay between executions.
`,
      icon: <BounceRight />
    },

    {
      type: 'customEvent/trigger',
      shortDescription: 'Trigger a custom event by name',
      tags: ['event', 'custom', 'trigger'],
      markdownDescription: `
Triggers a custom event by name, allowing other parts of the graph to respond to it.

You will need to pass through the required parameters of the event when triggering it.
        `.trim(),
      icon: <Flash />
    },

    {
      type: 'time/delay',
      shortDescription: 'Delay execution for a specified duration',
      tags: ['time', 'async', 'delay', 'control'],
      markdownDescription: `
Pauses execution for a specified number of seconds before continuing.

Useful for creating timed behaviors, animations, or cooldown mechanics.
      `.trim(),
      icon: <PauseWindow />
    },

    {
      type: 'debug/expectTrue',
      shortDescription: 'Asserts that a condition is true during execution',
      tags: ['debug', 'assertion', 'testing'],
      markdownDescription: `
## Purpose
The Assert Expect True node is a debugging and validation tool used during graph execution to verify runtime conditions. It validates that a boolean condition evaluates to true at a specific point in the execution flow.

## Use Cases
Testing & Debugging: Validate that graph logic produces expected intermediate results
Runtime Invariants: Enforce constraints that must always hold true during execution
Quality Assurance: Catch logic errors early in development by asserting expected states
Documentation: The description field serves as inline documentation of assumptions

`.trim()
    },

    {
      icon: <GitFork />,
      type: 'flow/branch',
      shortDescription: 'Execute different flows based on a boolean condition',
      tags: ['flow', 'conditional', 'control'],
      markdownDescription: `
Conditionally executes one of two flow paths based on a boolean input.

## Common Use Cases
- Implementing if/else logic
- State-based behavior
- Conditional event handling
      `.trim()
    },
    {
      type: 'flow/sequence',
      shortDescription: 'Execute multiple flows in order',
      tags: ['flow', 'control', 'sequential'],
      markdownDescription: `
# Sequence

Executes multiple flow outputs in order, one after another.

Perfect for chaining multiple actions that need to happen sequentially.
      `.trim()
    },
    {
      type: 'flow/delay',
      shortDescription: 'Delay execution for a specified duration',
      tags: ['flow', 'time', 'async'],
      markdownDescription: `
# Delay

Pauses execution for a specified number of seconds before continuing.

Useful for creating timed behaviors, animations, or cooldown mechanics.
      `.trim()
    }
  ];

  // Math nodes
  const mathDocs: NodeDocumentation[] = [
    {
      type: 'math/add',
      shortDescription: 'Add two numbers',
      tags: ['math', 'arithmetic', 'basic'],
      markdownDescription: 'Calculates the sum of two numeric values: a + b'
    },
    {
      type: 'math/subtract',
      shortDescription: 'Subtract two numbers',
      tags: ['math', 'arithmetic', 'basic'],
      markdownDescription: 'Calculates the difference: a - b'
    },
    {
      type: 'math/multiply',
      shortDescription: 'Multiply two numbers',
      tags: ['math', 'arithmetic', 'basic'],
      markdownDescription: 'Calculates the product: a * b'
    },
    {
      type: 'math/divide',
      shortDescription: 'Divide two numbers',
      tags: ['math', 'arithmetic', 'basic'],
      markdownDescription:
        'Calculates the quotient: a / b\\n\\n⚠️ Division by zero returns 0'
    }
  ];

  // Logic nodes
  const logicDocs: NodeDocumentation[] = [
    {
      type: 'logic/and',
      shortDescription: 'Logical AND of two boolean values',
      tags: ['logic', 'boolean', 'gates'],
      markdownDescription: 'Returns true only if both inputs are true'
    },
    {
      type: 'logic/or',
      shortDescription: 'Logical OR of two boolean values',
      tags: ['logic', 'boolean', 'gates'],
      markdownDescription: 'Returns true if at least one input is true'
    },
    {
      type: 'logic/not',
      shortDescription: 'Logical NOT - inverts a boolean value',
      tags: ['logic', 'boolean', 'gates'],
      markdownDescription:
        'Inverts the input: true becomes false, false becomes true'
    }
  ];

  // Variable nodes
  const variableDocs: NodeDocumentation[] = [
    {
      type: 'variable/get',
      shortDescription: 'Read a variable value',
      tags: ['variable', 'state', 'getter'],
      markdownDescription: `
Retrieves the current value of a named variable.

Variables are shared across the entire graph and persist between executions.
      `.trim()
    },
    {
      type: 'variable/set',
      shortDescription: 'Write a variable value',
      tags: ['variable', 'state', 'setter'],
      markdownDescription: `
Sets the value of a named variable.

This executes as a flow and passes through to allow chaining.
      `.trim()
    }
  ];

  // Event nodes
  const eventDocs: NodeDocumentation[] = [
    {
      type: 'lifecycle/onStart',
      shortDescription: 'Triggered when the graph starts',
      tags: ['event', 'lifecycle', 'entry'],
      markdownDescription: `
Fires once when the graph begins execution.

Perfect for initialization logic and setup tasks.
      `.trim()
    },
    {
      type: 'lifecycle/onEnd',
      shortDescription: 'Triggered when the graph ends',
      tags: ['event', 'lifecycle', 'cleanup'],
      markdownDescription: `
# On End

Fires once when the graph stops execution.

Useful for cleanup, saving state, or final actions.
      `.trim()
    },
    {
      type: 'lifecycle/onTick',
      shortDescription: 'Triggered every frame/update',
      tags: ['event', 'lifecycle', 'update', 'loop'],
      markdownDescription: `
# On Tick

Fires continuously on every update cycle.

⚠️ Use carefully - runs every frame! Great for animations and real-time updates.
      `.trim()
    }
  ];

  // Combine and set all documentation
  const allDocs = [
    ...flowDocs,
    ...mathDocs,
    ...logicDocs,
    ...variableDocs,
    ...eventDocs
  ];

  docStore.setMultipleDocumentation(allDocs);

  console.log(`✅ Loaded documentation for ${allDocs.length} nodes`);

  // Register the documentation panel with TabLoader
  sys.tabLoader.register('docs', () => {
    return {
      id: 'docs',
      closable: true,
      title: 'Documentation',
      group: 'default',
      content: () => (
        <ErrorBoundary fallback={'Error loading Documentation panel'}>
          <DocumentationBrowserPanel />
        </ErrorBoundary>
      )
    };
  });

  // Add menu item to Window menu
  const menuStore = sys.menubarStore;
  const currentItems = menuStore.getState().items;
  const windowMenu = currentItems.find((menu) => menu.name === 'window');

  if (windowMenu) {
    // Add the Documentation menu item to the Window menu
    const newMenuItem = {
      name: 'docs',
      render: function DocsMenuItem() {
        return (
          <MenuItemElement
            onClick={() => sys.tabStore.getState().openTab('docs')}
            key="docs"
          >
            Documentation
          </MenuItemElement>
        );
      }
    };

    menuStore
      .getState()
      .setSubMenuItems('window', [...windowMenu.items, newMenuItem]);
  }
};

export const docsPlugin = plugin(docsPluginLoader, {
  name: 'docs'
});
