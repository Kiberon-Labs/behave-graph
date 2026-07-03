import { docsPlugin } from '@/plugin/docs';

import { SystemProvider, GraphProvider } from '@/system/provider';
import { System } from '@/system/system';
import {
  registerCoreProfile,
  type ValueType
} from '@kiberon-labs/behave-graph';

import { alignmentPlugin } from '@/plugin/alignment';
import { downloadJson, localGraphRunnerPlugin } from '@/index';

export const ColorValue: ValueType = {
  name: 'color',
  creator: () => '#000000',
  deserialize: (value: string) => value,
  serialize: (value: string) => value,
  lerp: (start: string, end: string, t: number) => (t < 0.5 ? start : end),
  equals: (a: string, b: string) => a === b,
  clone: (value: string) => value
};

// Create the old-style registry for node definitions
let coreRegistry = registerCoreProfile({
  nodes: {},
  values: {
    color: ColorValue
  },
  dependencies: {}
});
// Convert to INodeRegistry
const nodeRegistry = {
  values: coreRegistry.values,
  specs: []
};

//Basic system generator for tests and stories
export const systemGenerator = () => {
  const defaultSys = new System(nodeRegistry);
  return defaultSys;
};

const defaultSys = new System(nodeRegistry);
const defaultSession = defaultSys.createSession('graph');

defaultSys.registerPlugin(alignmentPlugin);
defaultSys.registerPlugin(docsPlugin);
defaultSys.registerPlugin(localGraphRunnerPlugin, {
  registry: coreRegistry,
  events: [
    {
      id: '0',
      name: 'Example Event',
      parameters: [
        {
          name: 'exampleParam',
          valueTypeName: 'string',
          defaultValue: 'Foo'
        }
      ],
      description: 'An example event for demonstration purposes.',
      readonly: true
    }
  ],
  variables: [
    {
      id: '0',
      name: 'Example Variable',
      valueTypeName: 'string',
      initialValue: 'Hello, World!',
      description: 'An example variable for demonstration purposes.',
      readonly: true
    }
  ]
});

defaultSys.pubsub.subscribe('graph:saved', (_, graph) => {
  downloadJson('graph.json', graph);
});

defaultSession.flowStore.getState().setGraph({
  nodes: [
    {
      type: 'lifecycle/onStart',
      id: '0',
      flows: {
        flow: {
          nodeId: '1',
          socket: 'flow'
        }
      }
    },
    {
      type: 'flow/branch',
      id: '1',
      parameters: {
        condition: {
          value: false
        }
      },
      flows: {
        true: {
          nodeId: '2',
          socket: 'flow'
        },
        false: {
          nodeId: '3',
          socket: 'flow'
        }
      }
    },
    {
      type: 'debug/log',
      id: '2',
      parameters: {
        text: {
          value: 'Condition is true!'
        }
      }
    },
    {
      type: 'debug/log',
      id: '3',
      parameters: {
        text: {
          value: 'Condition is false!'
        }
      }
    }
  ]
});

// Seed a few example log entries so the Logs panel renders representative
// content in stories and visual tests. Timestamps use fixed local components so
// they render deterministically regardless of timezone.
const exampleLogTime = (h: number, m: number, s: number, ms: number) =>
  new Date(2024, 0, 1, h, m, s, ms);

[
  { type: 'info' as const, message: 'Graph compiled successfully.' },
  { type: 'verbose' as const, message: 'lifecycle/onStart fired (node 0).' },
  {
    type: 'info' as const,
    message: 'flow/branch evaluated condition = false.'
  },
  {
    type: 'warning' as const,
    message: 'Variable "Example Variable" is unused.'
  },
  {
    type: 'error' as const,
    message: 'debug/log: failed to resolve socket "value" on node 3.'
  }
].forEach((entry, index) => {
  defaultSession.logsStore.getState().append({
    type: entry.type,
    data: { message: entry.message },
    time: exampleLogTime(13, 45, 30 + index, 120 + index * 37)
  });
});

export const DefaultSystemProvider = ({
  children
}: {
  children: React.ReactElement;
}) => {
  return (
    <SystemProvider value={defaultSys}>
      <GraphProvider value={defaultSession}>{children}</GraphProvider>
    </SystemProvider>
  );
};
