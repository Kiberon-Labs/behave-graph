import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  kitchenSinkPlugin,
  GraphProvider,
  LayoutController,
  localGraphRunnerPlugin,
  System,
  SystemProvider,
  type UIGraphJSON
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
const clickSession = clickSys.createSession('graph');

clickSys.controlStore.getState().registerControl('color', Vec3Control);
clickSys.controlStore.getState().registerControl('vec3', Vec3Control);
clickSys.controlStore.getState().registerControl('euler', Vec3Control);

clickSys.registerPlugin(kitchenSinkPlugin);
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

// Preload the click demo graph so the OnAnyMeshClicked event node is present.
// clickDemo.json is a full UIGraphJSON (UI state + inner flow), so deserialize
// the UI state and load the inner behave graph , the same path the menubar's
// "Load Graph" uses , rather than passing it straight to setGraph.
const clickDemoUiGraph = clickDemoGraph as unknown as UIGraphJSON;
clickSession.graph.deseralize(clickDemoUiGraph);
clickSession.flowStore
  .getState()
  .setGraph(clickDemoUiGraph.flow, { skipLayout: true });

export const ClickDemo: Story = {
  render: () => {
    return (
      <SystemProvider value={clickSys}>
        <GraphProvider value={clickSession}>
          <LayoutController />
        </GraphProvider>
      </SystemProvider>
    );
  },
  args: {}
};
