import type { GraphSession } from '@/system/graphSession';
import { annotatedTitle, uiVersion } from '@/annotations';
import type { UIGraphJSON } from '@/types/graph';

const DEFAULT_UI_GRAPH_VERSION = '1.0.0';
const DEFAULT_UI_GRAPH_NAME = 'Untitled Graph';

function getStringAnnotation(
  annotations: Record<string, unknown>,
  key: string
): string | undefined {
  const value = annotations[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

/**
 * Assembles the full UI graph definition for saving.
 */
export function buildUIGraphJSON(system: GraphSession): UIGraphJSON {
  system.flowStore.getState().invalidateCache();

  const flow = system.flowStore.getState().getGraph();
  const nodes = system.nodeStore.getState().nodes;
  const edges = system.edgeStore.getState().edges;

  const annotations = system.graph.getAnnotations?.() ?? {};

  const reactflow = system.refStore.getState().getRef('reactflow');
  const viewport = reactflow?.getViewport?.() ??
    system.graph.viewports[0] ?? { x: 0, y: 0, zoom: 1 };

  const graphVersion =
    getStringAnnotation(annotations, uiVersion) ?? DEFAULT_UI_GRAPH_VERSION;
  const graphName =
    system.metaStore.getState().name ||
    getStringAnnotation(annotations, annotatedTitle) ||
    flow.name ||
    DEFAULT_UI_GRAPH_NAME;

  const viewports = system.graph.viewports.length
    ? system.graph.viewports.map((v) => ({ x: v.x, y: v.y, zoom: v.zoom }))
    : undefined;

  return {
    v: graphVersion,
    name: graphName,
    annotations,
    data: {
      layers: system.layerStore.getState().serialize()
    },
    flow,
    nodes,
    edges,
    user: {
      viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
      viewports
    }
  };
}
