import type { Meta, StoryObj } from '@storybook/react-vite';
import { GraphRunnerPanel } from '@/plugin/graphrunner/panel';
import { graphRunnerClientPlugin } from '@/plugin/graphrunner';
import { System } from '@/system/system';
import {
  registerCoreProfile,
  writeNodeSpecsToJSON
} from '@kiberon-labs/behave-graph';
import { SystemProvider } from '@/system/provider';

const meta: Meta<typeof GraphRunnerPanel> = {
  title: 'Components/Panels/GraphRunner',
  component: GraphRunnerPanel,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'GraphRunnerPanel component for managing remote graph execution via WebSocket connections.'
      }
    }
  }
};

export default meta;
type Story = StoryObj<typeof GraphRunnerPanel>;

/**
 * Default story showing the GraphRunnerPanel in disconnected state
 */
export const Disconnected: Story = {
  render: () => {
    // Create a system with the graphRunnerClient plugin
    const coreRegistry = registerCoreProfile({
      nodes: {},
      values: {},
      dependencies: {}
    });
    const nodeSpecs = writeNodeSpecsToJSON(coreRegistry);
    const nodeRegistry = {
      values: coreRegistry.values,
      specs: nodeSpecs
    };

    const system = new System(nodeRegistry);
    system.registerPlugin(graphRunnerClientPlugin);

    return (
      <SystemProvider value={system}>
        <GraphRunnerPanel system={system} />
      </SystemProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Default disconnected state with connection form.'
      }
    }
  }
};

/**
 * Story showing the GraphRunnerPanel with connection configuration
 */
export const WithConfiguration: Story = {
  render: () => {
    const coreRegistry = registerCoreProfile({
      nodes: {},
      values: {},
      dependencies: {}
    });
    const nodeSpecs = writeNodeSpecsToJSON(coreRegistry);
    const nodeRegistry = {
      values: coreRegistry.values,
      specs: nodeSpecs
    };

    const system = new System(nodeRegistry);
    system.registerPlugin(graphRunnerClientPlugin);

    // Pre-configure connection settings
    system.runner.store.getState().setConnectionConfig({
      url: 'ws://localhost:8080',
      auth: { type: 'bearer' },
      autoReconnect: true
    });

    return (
      <SystemProvider value={system}>
        <GraphRunnerPanel system={system} />
      </SystemProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'GraphRunnerPanel with pre-configured connection settings.'
      }
    }
  }
};

/**
 * Story simulating a connected state with server metadata
 */
export const Connected: Story = {
  render: () => {
    const coreRegistry = registerCoreProfile({
      nodes: {},
      values: {},
      dependencies: {}
    });
    const nodeSpecs = writeNodeSpecsToJSON(coreRegistry);
    const nodeRegistry = {
      values: coreRegistry.values,
      specs: nodeSpecs
    };

    const system = new System(nodeRegistry);
    system.registerPlugin(graphRunnerClientPlugin);

    const store = system.runner.store;

    // Simulate connected state
    store.getState().setConnectionState('connected');
    store.getState().setConnectionConfig({
      url: 'ws://localhost:8080',
      auth: { type: 'none' },
      autoReconnect: true
    });
    store.getState().setConnectionInfo({
      serverId: 'demo-server-01',
      userId: 'user-123',
      sessionId: 'session-abc-456',
      authenticated: true,
      capabilities: {
        execute: true,
        pause: true,
        step: true,
        variables: true,
        events: true
      }
    });

    // Add sample server variables
    store.getState().setServerVariables([
      { name: 'playerHealth', type: 'float', currentValue: 100 },
      { name: 'gameScore', type: 'integer', currentValue: 1500 },
      { name: 'playerName', type: 'string', currentValue: 'Hero' },
      { name: 'isGameActive', type: 'boolean', currentValue: true }
    ]);

    // Add sample server events
    store.getState().setServerEvents([
      {
        id: 'event-1',
        name: 'onPlayerDamage',
        description: 'Triggered when player takes damage',
        readonly: true,
        parameters: [
          { name: 'damage', valueTypeName: 'number', defaultValue: 0 },
          { name: 'source', valueTypeName: 'string', defaultValue: 'xx' }
        ]
      },
      {
        id: 'event-2',
        name: 'onScoreUpdate',
        description: 'Triggered when score changes',
        readonly: true,
        parameters: [
          { name: 'newScore', valueTypeName: 'number', defaultValue: 0 },
          { name: 'delta', valueTypeName: 'number', defaultValue: 0 }
        ]
      }
    ]);

    // Add sample node types
    store.getState().setNodeTypes([
      {
        type: 'game/dealDamage',
        label: 'Deal Damage',
        description: 'Applies damage to a target',
        category: 'Game',
        inputs: [
          { name: 'target', type: 'string' },
          { name: 'amount', type: 'float' }
        ],
        outputs: [{ name: 'success', type: 'boolean' }]
      },
      {
        type: 'game/updateScore',
        label: 'Update Score',
        description: 'Modifies the player score',
        category: 'Game',
        inputs: [{ name: 'delta', type: 'integer' }],
        outputs: [{ name: 'newScore', type: 'integer' }]
      }
    ]);

    // Add sample message activity
    store.getState().addMessageActivity('sent', {
      type: 'connect',
      id: 'msg-001'
    });
    store.getState().addMessageActivity('received', {
      type: 'welcome',
      id: 'msg-002',
      serverId: 'demo-server-01',
      capabilities: {
        execute: true,
        pause: true,
        step: true,
        variables: true,
        events: true
      }
    });
    store.getState().addMessageActivity('sent', {
      type: 'getMetadata',
      id: 'msg-003'
    });

    return (
      <SystemProvider value={system}>
        <GraphRunnerPanel system={system} />
      </SystemProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'GraphRunnerPanel in connected state with server variables, events, node types, and message activity.'
      }
    }
  }
};

/**
 * Story showing the connecting state
 */
export const Connecting: Story = {
  render: () => {
    const coreRegistry = registerCoreProfile({
      nodes: {},
      values: {},
      dependencies: {}
    });
    const nodeSpecs = writeNodeSpecsToJSON(coreRegistry);
    const nodeRegistry = {
      values: coreRegistry.values,
      specs: nodeSpecs
    };

    const system = new System(nodeRegistry);
    system.registerPlugin(graphRunnerClientPlugin);

    system.runner.store.getState().setConnectionState('connecting');
    system.runner.store.getState().setConnectionConfig({
      url: 'ws://localhost:8080',
      auth: { type: 'none' },
      autoReconnect: true
    });

    return (
      <SystemProvider value={system}>
        <GraphRunnerPanel system={system} />
      </SystemProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'GraphRunnerPanel in connecting state.'
      }
    }
  }
};

/**
 * Story showing an error state
 */
export const WithError: Story = {
  render: () => {
    const coreRegistry = registerCoreProfile({
      nodes: {},
      values: {},
      dependencies: {}
    });
    const nodeSpecs = writeNodeSpecsToJSON(coreRegistry);
    const nodeRegistry = {
      values: coreRegistry.values,
      specs: nodeSpecs
    };

    const system = new System(nodeRegistry);
    system.registerPlugin(graphRunnerClientPlugin);

    system.runner.store.getState().setConnectionState('disconnected');
    system.runner.store
      .getState()
      .setError('Failed to connect: Connection timeout after 30 seconds');

    return (
      <SystemProvider value={system}>
        <GraphRunnerPanel system={system} />
      </SystemProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'GraphRunnerPanel displaying a connection error.'
      }
    }
  }
};
