import type { Meta, StoryObj } from '@storybook/react-vite';
import { TracesPanel } from '@/components/panels/traces';
import {
  DefaultSystemProvider,
  systemGenerator
} from '~/defaults/defaultStoryProvider';
import { SystemProvider } from '@/system';

const meta: Meta<typeof TracesPanel> = {
  title: 'Components/Panels/TracesPanel',
  component: TracesPanel,
  decorators: [
    (Story) => (
      <DefaultSystemProvider>
        <Story />
      </DefaultSystemProvider>
    )
  ],
  parameters: {
    docs: {
      description: {
        component: 'TracesPanel component for displaying execution traces.'
      }
    }
  }
};
export default meta;

type Story = StoryObj<typeof TracesPanel>;

function Injector() {
  // Keep the original provider for the simple empty/default story.
  // Other stories will create their own System with a prefilled collector.
  return <TracesPanel />;
}

function makeCollector(
  spans: Array<{
    nodeId: string;
    name: string;
    start: number;
    end: number;
    lane: number;
  }>
) {
  const capacity = 1000;
  const arr: any[] = Array.from({ length: capacity });
  let maxLane = -1;
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    arr[i] = {
      id: i + 1,
      nodeId: s.nodeId,
      name: s.name,
      start: s.start,
      end: s.end,
      lane: s.lane
    };
    maxLane = Math.max(maxLane, s.lane);
  }

  const laneOpen = Array.from(
    { length: Math.max(1, maxLane + 1) },
    () => false
  );
  // mark lanes with open spans
  for (const s of spans) {
    if (Number.isNaN(s.end)) laneOpen[s.lane] = true;
  }

  return {
    capacity,
    spans: arr,
    writeIndex: spans.length % capacity,
    size: spans.length,
    nextId: spans.length + 1,
    openByNodeId: new Map<string, number[]>(),
    laneOpen
  };
}

export const Default: Story = {
  render: () => (
    <DefaultSystemProvider>
      <Injector mode="empty" />
    </DefaultSystemProvider>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Default TracesPanel (no spans).'
      }
    }
  }
};

export const SampleTraces: Story = {
  render: () => {
    const sys = systemGenerator();
    // create a few sample closed spans
    const now = performance.now();
    const spans = [
      {
        nodeId: 'node-a',
        name: 'Node A',
        start: now - 900,
        end: now - 800,
        lane: 0
      },
      {
        nodeId: 'node-b',
        name: 'Node B',
        start: now - 700,
        end: now - 600,
        lane: 1
      },
      {
        nodeId: 'node-c',
        name: 'Worker C',
        start: now - 950,
        end: now - 500,
        lane: 2
      }
    ];
    const collector = makeCollector(spans);
    sys.traceStore.setState({
      collector,
      version: sys.traceStore.getState().version + 1
    });

    return (
      <SystemProvider value={sys}>
        <TracesPanel />
      </SystemProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'TracesPanel with a few sample spans (closed).'
      }
    }
  }
};

export const WithOpenSpan: Story = {
  render: () => {
    const sys = systemGenerator();
    const now = performance.now();
    const spans = [
      {
        nodeId: 'node-closed',
        name: 'Closed Node',
        start: now - 400,
        end: now - 300,
        lane: 0
      },
      {
        nodeId: 'node-open',
        name: 'Open Node',
        start: now - 200,
        end: Number.NaN,
        lane: 1
      }
    ];
    const collector = makeCollector(spans);
    sys.traceStore.setState({
      collector,
      version: sys.traceStore.getState().version + 1
    });

    return (
      <SystemProvider value={sys}>
        <TracesPanel />
      </SystemProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'TracesPanel showing an open (ongoing) span alongside closed spans.'
      }
    }
  }
};

export const ManyTraces: Story = {
  render: () => {
    const sys = systemGenerator();
    const now = performance.now();
    const spans: Array<any> = [];
    for (let i = 0; i < 80; i++) {
      const lane = i % 6;
      const start = now - (800 - i * 5);
      const end = start + 30 + (i % 5);
      spans.push({
        nodeId: `node-${lane}`,
        name: `Node ${lane}`,
        start,
        end,
        lane
      });
    }
    const collector = makeCollector(spans);
    sys.traceStore.setState({
      collector,
      version: sys.traceStore.getState().version + 1
    });

    return (
      <SystemProvider value={sys}>
        <TracesPanel />
      </SystemProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'TracesPanel populated with many short spans to test layout and performance.'
      }
    }
  }
};
