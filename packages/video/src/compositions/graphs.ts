// Demo graphs for the editor scenes  authored here (not pulled from graphs/)
// so every node carries explicit `metadata.positionX/Y` and each scene looks
// deliberately composed instead of auto-laid-out. The image pipeline is a
// factory because its fetch URL must go through staticFile (Remotion runtime),
// which is also why scenes reference graphs by key instead of embedding them in
// the narration script.
import { staticFile } from 'remotion';

const pos = (x: number, y: number) => ({
  positionX: String(x),
  positionY: String(y)
});

/** On Start → Branch: a real split in processing, the hello-world of flow. */
const gameLoot = () => ({
  nodes: [
    {
      type: 'lifecycle/onStart',
      id: '0',
      metadata: pos(60, 240),
      flows: { flow: { nodeId: '1', socket: 'flow' } }
    },
    {
      type: 'debug/log',
      id: '1',
      metadata: pos(330, 240),
      parameters: { text: { value: 'A wild chest appears…' } },
      flows: { flow: { nodeId: '2', socket: 'flow' } }
    },
    {
      type: 'flow/branch',
      id: '2',
      metadata: pos(660, 240),
      parameters: { condition: { value: true } },
      flows: {
        true: { nodeId: '3', socket: 'flow' },
        false: { nodeId: '4', socket: 'flow' }
      }
    },
    {
      type: 'debug/log',
      id: '3',
      metadata: pos(980, 110),
      parameters: { text: { value: 'Legendary drop! Roll for it.' } }
    },
    {
      type: 'debug/log',
      id: '4',
      metadata: pos(980, 380),
      parameters: { text: { value: 'Common loot. Better luck next time.' } }
    }
  ]
});

/** Tick-driven heartbeat: the graph is genuinely event-driven, so the steady
 *  drip of executions/logs on camera MATCHES what the graph shows (an On Tick
 *  trigger), instead of a one-shot On Start that would drain in a single burst. */
const heartbeat = () => ({
  nodes: [
    {
      type: 'lifecycle/onTick',
      id: '0',
      metadata: pos(40, 240),
      flows: { flow: { nodeId: '1', socket: 'flow' } }
    },
    {
      type: 'flow/counter',
      id: '1',
      metadata: pos(340, 240),
      flows: { flow: { nodeId: '2', socket: 'flow' } }
    },
    {
      type: 'debug/log',
      id: '2',
      metadata: pos(660, 240),
      parameters: { text: { value: 'The world ticks forward…' } }
    }
  ]
});

/** Graph variables + custom events  the built-in state & signalling
 *  primitives. Top row banks a score and fires `levelUp`; bottom row is the
 *  listener that reacts to it. */
const primitives = () => ({
  variables: [
    { valueTypeName: 'float', name: 'score', id: 0, initialValue: 0 }
  ],
  customEvents: [{ name: 'levelUp', id: '0' }],
  nodes: [
    {
      type: 'lifecycle/onStart',
      id: '0',
      metadata: pos(40, 140),
      flows: { flow: { nodeId: '1', socket: 'flow' } }
    },
    {
      type: 'variable/set',
      id: '1',
      metadata: pos(420, 140),
      configuration: { variableId: 0 },
      parameters: { value: { value: 100 } },
      flows: { flow: { nodeId: '2', socket: 'flow' } }
    },
    {
      type: 'customEvent/trigger',
      id: '2',
      metadata: pos(860, 140),
      configuration: { customEventId: '0' }
    },
    {
      type: 'customEvent/onTriggered',
      id: '3',
      metadata: pos(420, 500),
      configuration: { customEventId: '0' },
      flows: { flow: { nodeId: '4', socket: 'flow' } }
    },
    {
      type: 'debug/log',
      id: '4',
      metadata: pos(880, 500),
      parameters: { text: { value: 'Level up! Score banked.' } }
    }
  ]
});

/** Fetch a photo → layered ImageMagick effects → preview. The image nodes are
 *  pure, so the flow spine (onStart → set-variable) is what PULLS the chain:
 *  running it evaluates every node, and with `image.showPreview` on each node
 *  captures and shows its intermediate result via the realtime runner store. */
const imagePipeline = () => ({
  // initialValue is deserialized with JSON.parse (ImageValue serializes
  // Uint8Arrays as JSON arrays)  '[]' is the empty image, '' would throw.
  variables: [
    { valueTypeName: 'image', name: 'result', id: 0, initialValue: '[]' }
  ],
  nodes: [
    {
      type: 'lifecycle/onStart',
      id: '0',
      metadata: pos(40, 40),
      flows: { flow: { nodeId: '6', socket: 'flow' } }
    },
    {
      type: 'variable/set',
      id: '6',
      metadata: pos(360, 40),
      configuration: { variableId: 0 },
      parameters: { value: { link: { nodeId: '5', socket: 'image' } } }
    },
    {
      type: 'image/fetch',
      id: '1',
      metadata: pos(40, 260),
      parameters: { url: { value: staticFile('image-demo/source.png') } }
    },
    {
      type: 'image/resize',
      id: '2',
      metadata: pos(340, 260),
      parameters: {
        image: { link: { nodeId: '1', socket: 'image' } },
        width: { value: 640 },
        height: { value: 480 }
      }
    },
    {
      type: 'image/oilpaint',
      id: '3',
      metadata: pos(640, 260),
      parameters: {
        image: { link: { nodeId: '2', socket: 'image' } },
        radius: { value: 3 }
      }
    },
    {
      type: 'image/sepia',
      id: '4',
      metadata: pos(940, 260),
      parameters: { image: { link: { nodeId: '3', socket: 'image' } } }
    },
    {
      type: 'image/preview',
      id: '5',
      metadata: pos(1240, 260),
      parameters: { image: { link: { nodeId: '4', socket: 'image' } } }
    }
  ]
});

/** AI pack: provider → agent → conversation, driven by a flow that sends a
 *  message and logs the model's reply. Display-only (no run  no API key). */
const aiConversation = () => ({
  nodes: [
    {
      type: 'lifecycle/onStart',
      id: '0',
      metadata: pos(40, 80),
      flows: { flow: { nodeId: '4', socket: 'flow' } }
    },
    {
      type: 'ai/provider',
      id: '1',
      metadata: pos(40, 380),
      parameters: { apiKey: { value: '••••••••••' } }
    },
    {
      type: 'ai/agent',
      id: '2',
      metadata: pos(440, 380),
      parameters: {
        provider: { link: { nodeId: '1', socket: 'provider' } },
        model: { value: 'claude-sonnet-5' }
      }
    },
    {
      type: 'ai/conversation',
      id: '3',
      metadata: pos(840, 380),
      parameters: { agent: { link: { nodeId: '2', socket: 'agent' } } }
    },
    {
      type: 'ai/setupConversation',
      id: '4',
      metadata: pos(420, 80),
      parameters: { agent: { link: { nodeId: '2', socket: 'agent' } } },
      flows: { flow: { nodeId: '5', socket: 'flow' } }
    },
    {
      type: 'ai/sendMessage',
      id: '5',
      metadata: pos(840, 80),
      parameters: {
        conversation: { link: { nodeId: '3', socket: 'conversation' } },
        message: { value: 'Welcome the player and offer them a quest.' }
      },
      flows: { flow: { nodeId: '6', socket: 'flow' } }
    },
    {
      type: 'debug/log',
      id: '6',
      metadata: pos(1260, 80),
      parameters: { text: { link: { nodeId: '5', socket: 'response' } } }
    }
  ]
});

const GRAPHS: Record<string, () => object> = {
  gameLoot,
  heartbeat,
  primitives,
  imagePipeline,
  aiConversation
};

export function graphForKey(key: string): object {
  const build = GRAPHS[key];
  if (!build) {
    throw new Error(
      `unknown graph key "${key}"  add it to compositions/graphs.ts`
    );
  }
  return build();
}

/**
 * The authored node positions for a graph, as numbers. The editor's mount
 * path round-trips the graph through flowToBehave (which drops position
 * metadata) and re-runs auto-layout, so scenes re-assert these directly on the
 * node store every frame (idempotent  see EditorScene).
 */
export function positionsForKey(
  key: string
): Record<string, { x: number; y: number }> {
  const graph = graphForKey(key) as {
    nodes: Array<{
      id: string;
      metadata?: { positionX?: string; positionY?: string };
    }>;
  };
  const out: Record<string, { x: number; y: number }> = {};
  for (const n of graph.nodes) {
    if (
      n.metadata?.positionX !== undefined &&
      n.metadata?.positionY !== undefined
    ) {
      out[n.id] = {
        x: Number(n.metadata.positionX),
        y: Number(n.metadata.positionY)
      };
    }
  }
  return out;
}
