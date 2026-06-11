import type { Meta, StoryObj } from '@storybook/react-vite';
import { LayoutController } from '@/components/layoutController';
import { SystemProvider } from '@/system';
import { webWorkerGraphRunnerPlugin } from '@/plugin/graphrunner-webworker';
import { systemGenerator } from '~/defaults/systemGenerator';
import { useMemo } from 'react';

const meta: Meta<typeof LayoutController> = {
  component: LayoutController,
  title: 'Apex/Layout Controller (Web worker)',
  decorators: [(Story) => <Story />],
  parameters: {
    layout: 'fullscreen'
  }
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Webworker: Story = {
  render: () => {
    const webworkerSystem = useMemo(() => {
      const webworkerSystem = systemGenerator();

      // Create worker instance from the example worker file
      // The example-graph.worker.ts file shows how to:
      // 1. Import and set up your registry with custom nodes
      // 2. Import the message handling scaffold from graph-executor.worker.ts
      // 3. Handle graph execution in the worker thread
      const graphWorker = new Worker(
        new URL('./example-graph.worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Register the webworker plugin
      // No registry needed - it's defined inside the worker
      webworkerSystem.registerPlugin(webWorkerGraphRunnerPlugin, {
        worker: graphWorker,
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

      // Set up a sample graph
      webworkerSystem.flowStore.getState().setGraph({
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
            type: 'debug/log',
            id: '1',
            parameters: {
              text: {
                value: 'Hello from Web Worker!'
              }
            }
          }
        ]
      });
      return webworkerSystem;
    }, []);

    return (
      <div className="h-dvh">
        <SystemProvider value={webworkerSystem}>
          <LayoutController />
        </SystemProvider>
      </div>
    );
  },
  args: {}
};
