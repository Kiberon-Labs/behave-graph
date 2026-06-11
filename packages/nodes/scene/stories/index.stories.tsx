import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  docsPlugin,
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
import clickDemoGraph from './data/clickDemo.json';

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

defaultSys.controlStore.getState().registerControl('color', Vec3Control);
defaultSys.controlStore.getState().registerControl('vec3', Vec3Control);
defaultSys.controlStore.getState().registerControl('euler', Vec3Control);

defaultSys.registerPlugin(docsPlugin);
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
        <LayoutController />
      </SystemProvider>
    );
  },
  args: {}
};

// --- Click Demo story: preloads a graph with OnAnyMeshClicked → DebugLog ---

const clickDemoScene = new DemoScene();

const clickRegistry = registerSceneProfile(
  registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {
      IScene: clickDemoScene,
      ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
      ILogger: new DefaultLogger()
    }
  })
);

const clickNodeRegistry = {
  values: clickRegistry.values,
  specs: []
};

const clickSys = new System(clickNodeRegistry);

clickSys.controlStore.getState().registerControl('color', Vec3Control);
clickSys.controlStore.getState().registerControl('vec3', Vec3Control);
clickSys.controlStore.getState().registerControl('euler', Vec3Control);

clickSys.registerPlugin(docsPlugin);
clickSys.registerPlugin(localGraphRunnerPlugin, {
  registry: clickRegistry,
  tickStrategy: async () => {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
});
clickSys.registerPlugin(sceneViewerPlugin, {
  scene: clickDemoScene,
  addMenuItem: true
});

// Preload the click demo graph so the OnAnyMeshClicked event node is present
clickSys.flowStore.getState().setGraph(clickDemoGraph);

export const ClickDemo: Story = {
  render: () => {
    return (
      <SystemProvider value={clickSys}>
        <LayoutController />
      </SystemProvider>
    );
  },
  args: {}
};
