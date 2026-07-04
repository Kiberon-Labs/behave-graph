import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  kitchenSinkPlugin,
  GraphProvider,
  LayoutController,
  localGraphRunnerPlugin,
  System,
  SystemProvider
} from '@kiberon-labs/behave-graph-flow';
import {
  DefaultLogger,
  ManualLifecycleEventEmitter,
  registerCoreProfile
} from '@kiberon-labs/behave-graph';
import { registerSceneProfile } from '@/registerSceneProfile';
import { DemoScene } from './components/DemoScene';
import { sceneViewerPlugin } from './plugin/sceneViewerPlugin';
import { Vec3Control } from '@/ui/controls/vec3';
import rotate from './data/rotate.json';

const meta: Meta<typeof LayoutController> = {
  component: LayoutController,
  title: 'Apex/default',
  decorators: [(Story) => <Story />],
  parameters: {
    layout: 'fullscreen'
  }
};

export default meta;

type Story = StoryObj<typeof meta>;

// Create a demo scene instance
const demoScene = new DemoScene();

// Create the old-style registry for node definitions
const coreRegistry = registerSceneProfile(
  registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {
      IScene: demoScene,
      ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
      ILogger: new DefaultLogger()
    }
  })
);

// Convert to INodeRegistry
const nodeRegistry = {
  values: coreRegistry.values,
  specs: []
};

const defaultSys = new System(nodeRegistry);
const defaultSession = defaultSys.createSession('graph');

defaultSys.controlStore.getState().registerControl('color', Vec3Control);
defaultSys.controlStore.getState().registerControl('vec3', Vec3Control);
defaultSys.controlStore.getState().registerControl('euler', Vec3Control);

defaultSession.graph.deseralize(rotate);
defaultSession.flowStore.getState().setGraph(rotate.flow, { skipLayout: true });

defaultSys.registerPlugin(kitchenSinkPlugin);
defaultSys.registerPlugin(localGraphRunnerPlugin, {
  registry: coreRegistry,
  // Use RAF-based tick strategy for smooth animation frame sync
  tickStrategy: async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
});
defaultSys.registerPlugin(sceneViewerPlugin, {
  scene: demoScene,
  addMenuItem: true
});

export const Default: Story = {
  render: () => {
    return (
      <SystemProvider value={defaultSys}>
        <GraphProvider value={defaultSession}>
          <LayoutController />
        </GraphProvider>
      </SystemProvider>
    );
  },
  args: {}
};
