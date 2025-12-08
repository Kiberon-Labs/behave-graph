import { CustomEdge } from '@/components/edges';
import type { System } from '@/system';
import type { GraphJSON } from '@kinforge/behave-graph';
import {
  applyEdgeChanges,
  type Edge,
  type Node,
  type EdgeChange,
  type NodeChange,
  applyNodeChanges as nativeNodeChanges,
  type EdgeProps
} from 'reactflow';
import { create } from 'zustand';

export type FlowStore = {
  initialGraph?: GraphJSON;
  setInitialGraph: (graph: GraphJSON) => void;
  edgeTypes: Record<string, React.ComponentType<EdgeProps>>;
};

export const flowStoreFactory = () =>
  create<FlowStore>((set) => ({
    initialGraph: undefined,

    setInitialGraph: (initialGraph: GraphJSON) => {
      set(() => ({
        initialGraph
      }));
    },
    edgeTypes: {
      default: CustomEdge
    }
  }));

export type NodeStore = {
  nodes: Node[];
  addNode: (nodes: Node) => void;
  setNodes: (nodes: Node[] | ((existing: Node[]) => Node[])) => void;
  clearNodes: () => void;
  applyNodeChanges: (changes: NodeChange[]) => void;
};

export const nodeStoreFactory = (system: System) =>
  create<NodeStore>((set) => ({
    nodes: [],
    addNode(node) {
      set((x) => ({ nodes: [...x.nodes, node] }));
    },
    applyNodeChanges(changes: NodeChange[]) {
      set((p) => {
        return {
          nodes: nativeNodeChanges(changes, p.nodes)
        };
      });
    },
    setNodes(nodes) {
      set((p) => ({
        nodes: typeof nodes === 'function' ? nodes(p.nodes) : nodes
      }));
    },
    clearNodes() {
      set(() => ({ nodes: [] }));
    }
  }));

export type EdgeStore = {
  edges: Edge[];
  addEdge: (edge: Edge) => void;
  setEdges: (edges: Edge[]) => void;
  clearEdges: () => void;
  applyEdgeChanges: (changes: EdgeChange[]) => void;
};

export const edgeStoreFactory = (system: System) =>
  create<EdgeStore>((set) => ({
    edges: [],

    addEdge(edge) {
      set((x) => ({ edges: [...x.edges, edge] }));
    },
    applyEdgeChanges(changes: EdgeChange[]) {
      set((p) => {
        return {
          edges: applyEdgeChanges(changes, p.edges)
        };
      });
    },

    setEdges(edges) {
      set(() => ({ edges }));
    },

    clearEdges() {
      set(() => ({ edges: [] }));
    }
  }));
