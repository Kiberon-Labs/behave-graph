import {
  GraphProvider,
  System,
  SystemProvider,
  kitchenSinkPlugin
} from '@kiberon-labs/behave-graph-flow';
import {
  registerCoreProfile,
  writeNodeSpecsToJSON,
  type Dependencies
} from '@kiberon-labs/behave-graph';
import { imagePlugin } from '@/ui';
import { nodes } from '@/nodes/index.js';
import { values } from '@/values/index.js';

/**
 * A freely-usable Unsplash photo used as the single source image for every
 * showcase story. Each category graph reads from one fetch node, so a whole
 * board renders from a single download.
 */
const UNSPLASH_URL =
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=420&q=80&fm=jpg';

/**
 * High-level groupings of the image nodes, one per story. The union of these
 * lists plus the shared `image/fetch` source covers every node in the package.
 */
const SHOWCASE_CATEGORIES: Record<string, string[]> = {
  Sources: ['image/solidColor'],
  Geometry: [
    'image/resize',
    'image/adaptiveResize',
    'image/liquidRescale',
    'image/crop',
    'image/chop',
    'image/splice',
    'image/shave',
    'image/rotate',
    'image/roll',
    'image/deskew',
    'image/autoOrient',
    'image/thumbnail',
    'image/trim',
    'image/extent',
    'image/border',
    'image/flip',
    'image/flop'
  ],
  'Color & Tone': [
    'image/grayscale',
    'image/negate',
    'image/negateGrayscale',
    'image/sepia',
    'image/solarize',
    'image/brightnessContrast',
    'image/contrast',
    'image/contrastStretch',
    'image/linearStretch',
    'image/modulate',
    'image/level',
    'image/gamma',
    'image/normalize',
    'image/autoLevel',
    'image/autoGamma',
    'image/clahe',
    'image/sigmoidalContrast',
    'image/inverseSigmoidalContrast',
    'image/threshold',
    'image/autoThreshold',
    'image/adaptiveThreshold',
    'image/blackThreshold',
    'image/whiteThreshold',
    'image/blueShift',
    'image/evaluate'
  ],
  'Alpha & Color': [
    'image/alpha',
    'image/colorAlpha',
    'image/opaque',
    'image/transparent',
    'image/floodFill'
  ],
  Effects: [
    'image/blur',
    'image/gaussianBlur',
    'image/adaptiveBlur',
    'image/motionBlur',
    'image/bilateralBlur',
    'image/sharpen',
    'image/adaptiveSharpen',
    'image/oilpaint',
    'image/charcoal',
    'image/vignette',
    'image/canny',
    'image/wave',
    'image/distort',
    'image/noise'
  ],
  'Compositing & Format': [
    'image/compose',
    'image/clut',
    'image/quantize',
    'image/strip',
    'image/convert'
  ],
  'Output & Preview': ['image/preview', 'image/properties', 'output/image']
};

const coreRegistry = registerCoreProfile({
  nodes: {},
  values: {},
  // Not important for spec projection.
  dependencies: {} as Dependencies
});
const coreSpecs = writeNodeSpecsToJSON(coreRegistry);

// Project the image node specs (types + socket value types) so we can wire each
// graph generically. Spec projection instantiates nodes but never runs them, so
// no WASM is required here.
const imageSpecs = writeNodeSpecsToJSON({
  nodes,
  values,
  dependencies: {} as Dependencies
});
const specByType = new Map(imageSpecs.map((s) => [s.type, s]));

const LAYOUT = {
  dockbox: {
    mode: 'horizontal' as const,
    children: [
      {
        size: 16,
        mode: 'vertical' as const,
        children: [
          {
            id: 'graphs',
            group: 'graph',
            tabs: [{ id: 'graph' }]
          }
        ]
      },
      {
        size: 4,
        mode: 'vertical' as const,
        children: [
          { size: 12, tabs: [{ id: 'imageOutput' }] },
          { size: 12, tabs: [{ id: 'nodeInputs' }] }
        ]
      }
    ]
  }
};

type SeedNode = {
  id: string;
  type: string;
  metadata: { positionX: string; positionY: string };
  parameters: Record<string, unknown>;
};

/**
 * Build a grid graph for one category: a single Unsplash source fetch, then one
 * instance of each node in the category with its image input(s) wired to the
 * source. Nodes that produce an `image` output render an inline preview.
 */
function buildCategoryGraph(category: string) {
  const sourceId = 'source-fetch';
  const graphNodes: SeedNode[] = [
    {
      id: sourceId,
      type: 'image/fetch',
      metadata: { positionX: '-340', positionY: '0' },
      parameters: { url: { value: UNSPLASH_URL } }
    }
  ];

  const types = (SHOWCASE_CATEGORIES[category] ?? []).filter(
    (type) => type !== 'image/fetch'
  );

  const cols = 4;
  const dx = 300;
  const dy = 360;

  types.forEach((type, i) => {
    const spec = specByType.get(type);
    const col = i % cols;
    const row = Math.floor(i / cols);

    const parameters: Record<string, unknown> = {};
    for (const input of spec?.inputs ?? []) {
      if (input.valueType === 'image') {
        parameters[input.name] = {
          link: { nodeId: sourceId, socket: 'image' }
        };
      }
    }

    graphNodes.push({
      id: `showcase-${type.replace(/[^a-z0-9]+/gi, '-')}`,
      type,
      metadata: {
        positionX: String(col * dx),
        positionY: String(row * dy + 80)
      },
      parameters
    });
  });

  return { nodes: graphNodes, variables: [], customEvents: [] };
}

type CategorySystem = {
  sys: System;
  session: ReturnType<System['createSession']>;
};

// One System/session per category, created lazily on first render and reused
// afterwards (Storybook renders a single story at a time).
const systemCache = new Map<string, CategorySystem>();

function getCategorySystem(category: string): CategorySystem {
  const cached = systemCache.get(category);
  if (cached) return cached;

  const sys = new System({ values: coreRegistry.values, specs: coreSpecs });
  const session = sys.createSession('graph');
  const entry: CategorySystem = { sys, session };
  systemCache.set(category, entry);

  Promise.all([
    sys.registerPlugin(kitchenSinkPlugin),
    sys.registerPlugin(imagePlugin)
  ]).then(() => {
    sys.tabStore.getState().setLayout(LAYOUT);
    session.flowStore.getState().setGraph(buildCategoryGraph(category));
  });

  return entry;
}

export const CategoryShowcaseProvider = ({
  category,
  children
}: {
  category: string;
  children: React.ReactElement;
}) => {
  const { sys, session } = getCategorySystem(category);
  return (
    <SystemProvider value={sys}>
      <GraphProvider value={session}>{children}</GraphProvider>
    </SystemProvider>
  );
};
