import { docsPlugin } from '@/plugin/docs';

import { SystemProvider } from '@/system/provider';
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

defaultSys.flowStore.getState().setGraph({
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

export const DefaultSystemProvider = ({
  children
}: {
  children: React.ReactElement;
}) => {
  return <SystemProvider value={defaultSys}>{children}</SystemProvider>;
};
