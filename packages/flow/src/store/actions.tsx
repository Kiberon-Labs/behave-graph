import type { System } from '@/system';
import { Graph } from 'graphlib';
import { create } from 'zustand';
import clsx from 'clsx';

const FILTERED_CLASS_NAME = 'filtered';

/**
 * Extend or modify this interface to add more actions as needed.
 */
export interface Actions {
  traceUpstream: (nodeId: string) => void;
  traceDownstream: (nodeId: string) => void;
  focusNode: (nodeId: string) => void;
  resetTrace: () => void;
}

export type ActionStore = {
  actions: Actions;
  setAction: <K extends keyof Actions>(key: K, action: Actions[K]) => void;
  getAction: <K extends keyof Actions>(key: K) => Actions[K] | undefined;
};

/**
 * Converts to a graph lib graph
 * @param sys
 * @returns
 */
const convertToGraph = (sys: System) => {
  const nodes = sys.nodeStore.getState().nodes;
  const edges = sys.edgeStore.getState().edges;

  const graph = new Graph({ multigraph: true });
  nodes.forEach((node) => graph.setNode(node.id));
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  return graph;
};

const findAllUpstream = (id: string, graph: Graph): string[] => {
  return (graph.predecessors(id) || []).flatMap((x) =>
    [x].concat(findAllUpstream(x, graph))
  );
};

const findAllDownstream = (id: string, graph: Graph): string[] => {
  return (graph.successors(id) || []).flatMap((x) =>
    [x].concat(findAllDownstream(x, graph))
  );
};

const createNodeLookup = (nodes: string[]) => {
  return nodes.reduce(
    (acc, node) => {
      acc[node] = true;
      return acc;
    },
    {} as Record<string, boolean>
  );
};

const applyFilters = (sys: System, lookup: Record<string, boolean>) => {
  sys.nodeStore.getState().setNodes((nodes) =>
    nodes.map((x) => {
      if (!lookup[x.id]) {
        return {
          ...x,
          className: clsx(x.className, FILTERED_CLASS_NAME)
        };
      }
      return {
        ...x,
        className: (x.className ?? '')
          .split(' ')
          .filter((c) => c !== FILTERED_CLASS_NAME)
          .join(' ')
      };
    })
  );
};

export const actionStoreFactory = (sys: System) =>
  create<ActionStore>((set, get) => ({
    actions: {
      traceUpstream: (nodeId: string) => {
        const graph = convertToGraph(sys);
        const foundNodes = createNodeLookup(
          findAllUpstream(nodeId, graph).concat([nodeId])
        );
        applyFilters(sys, foundNodes);
      },
      traceDownstream: (nodeId: string) => {
        const graph = convertToGraph(sys);
        const foundNodes = createNodeLookup(
          findAllDownstream(nodeId, graph).concat([nodeId])
        );
        applyFilters(sys, foundNodes);
      },
      resetTrace: () => {
        sys.nodeStore.getState().setNodes((nodes) =>
          nodes.map((x) => {
            //Remove filtering
            return {
              ...x,
              className: (x.className ?? '')
                .split(' ')
                .filter((c) => c !== FILTERED_CLASS_NAME)
                .join(' ')
            };
          })
        );
      }
    } as Actions,
    setAction: (key, action) =>
      set((state) => ({
        actions: {
          ...state.actions,
          [key]: action
        }
      })),
    getAction: (key) => {
      const state = get();
      return state.actions[key];
    }
  }));
