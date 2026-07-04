import { CustomEdge } from '@/components/edges';
import type { GraphSession } from '@/system/graphSession';
import { behaveToFlow } from '@/transformers/behaveToFlow';
import { flowToBehave } from '@/transformers/flowToBehave';
import { autoLayout } from '@/util/autoLayout';
import { hasPositionMetaData } from '@/util/hasPositionMetaData';
import type { GraphJSON } from '@kiberon-labs/behave-graph';
import {
  applyEdgeChanges,
  type Edge,
  type Node,
  type EdgeChange,
  type NodeChange,
  applyNodeChanges as nativeNodeChanges,
  type EdgeProps,
  type NodeProps
} from 'reactflow';
import { create } from 'zustand';
import { nonDeletable } from '@/annotations';
import GroupNode from '@/components/nodes/group';
import { BehaveNode } from '@/components/nodes/behave';

export type FlowStore = {
  graphJson: GraphJSON | null;
  setGraph: (graph: GraphJSON, options?: { skipLayout?: boolean }) => void;
  getGraph: () => GraphJSON;
  nodeTypes: Record<string, React.ComponentType<NodeProps>>;
  edgeTypes: Record<string, React.ComponentType<EdgeProps>>;
  invalidateCache: () => void;
  registerNodeType: (
    type: string,
    component: React.ComponentType<NodeProps>
  ) => void;
  registerEdgeType: (
    type: string,
    component: React.ComponentType<EdgeProps>
  ) => void;
};

export const flowStoreFactory = (session: GraphSession) => {
  const flowStore = create<FlowStore>((set, get) => ({
    graphJson: null,
    // `noteNode` (and its legacy `commentNode` alias) is contributed by the
    // optional notes plugin (`@/plugin/notes`), which owns the heavy
    // tiptap/prosemirror dependency.
    nodeTypes: {
      group: GroupNode,
      behaveNode: BehaveNode
    },
    invalidateCache: () => set({ graphJson: null }),
    getGraph: () => {
      const cached = get().graphJson;
      if (cached) {
        return cached;
      }

      const nodes = session.nodeStore.getState().nodes;
      const edges = session.edgeStore.getState().edges;
      const _variables = session.variableStore.getState().variables;
      const specs = session.editor.specStore.getState().specs;

      const computed = flowToBehave(session, nodes, edges, specs);

      set({ graphJson: computed });
      return computed;
    },

    setGraph: (graphJson: GraphJSON, options?: { skipLayout?: boolean }) => {
      session.eventsStore
        .getState()
        .setCustomEvents(
          Object.fromEntries(
            (graphJson.customEvents ?? []).map((evt) => [evt.id, evt])
          )
        );

      // Parse variables from JSON directly (no need to instantiate graph)
      const variables: Record<string, any> = {};
      if (graphJson.variables) {
        graphJson.variables.forEach((varJson) => {
          const valueType =
            session.editor.registry.getState().values[varJson.valueTypeName];
          const initialValue = valueType?.deserialize
            ? valueType.deserialize(varJson.initialValue)
            : varJson.initialValue;

          variables[varJson.id] = {
            id: varJson.id,
            name: varJson.name,
            valueTypeName: varJson.valueTypeName,
            initialValue
          };
        });
      }

      // Only convert and set nodes/edges if not skipping layout
      // (when loading UIGraphJSON, nodes/edges are already set by deseralize)
      if (!options?.skipLayout) {
        const [nodes, edges] = behaveToFlow(graphJson);

        if (!hasPositionMetaData(graphJson)) {
          autoLayout(nodes, edges);
        }
        session.nodeStore.getState().setNodes(nodes);
        session.edgeStore.getState().setEdges(edges);
      }

      // custom events stored in session.eventsStore
      session.variableStore.getState().setVariables(variables);
      get().invalidateCache();
    },
    edgeTypes: {
      default: CustomEdge as React.ComponentType<EdgeProps>
    },

    registerNodeType(type: string, component: React.ComponentType<NodeProps>) {
      set((state) => ({
        nodeTypes: {
          ...state.nodeTypes,
          [type]: component
        }
      }));
    },
    registerEdgeType(type: string, component: React.ComponentType<EdgeProps>) {
      set((state) => ({
        edgeTypes: {
          ...state.edgeTypes,
          [type]: component
        }
      }));
    }
  }));

  session.nodeStore.subscribe(() => {
    flowStore.getState().invalidateCache();
  });

  session.eventsStore.subscribe(() => {
    flowStore.getState().invalidateCache();
  });

  return flowStore;
};

export type NodeStore = {
  nodes: Node[];
  addNode: (node: Node) => void;
  setNodes: (nodes: Node[] | ((existing: Node[]) => Node[])) => void;
  clearNodes: () => void;
  applyNodeChanges: (changes: NodeChange[]) => void;
};

export const nodeStoreFactory = (session: GraphSession) =>
  create<NodeStore>((set) => ({
    nodes: [],
    addNode(node) {
      set((x) => ({ nodes: [...x.nodes, node] }));
      session.pubsub.publish('node:added', node);
    },
    applyNodeChanges(changes: NodeChange[]) {
      set((p) => {
        // Filter out remove changes for nodes with nonDeletable annotation
        const filteredChanges = changes.filter((change) => {
          if (change.type === 'remove') {
            const node = p.nodes.find((n) => n.id === change.id);
            if (node?.data?.metadata?.[nonDeletable]) {
              return false;
            }
            // Publish nodeRemoved event for deletable nodes
            if (node) {
              session.pubsub.publish('node:removed', node);
            }
          }
          return true;
        });
        return {
          nodes: nativeNodeChanges(filteredChanges, p.nodes)
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

export const edgeStoreFactory = (session: GraphSession) =>
  create<EdgeStore>((set) => ({
    edges: [],

    addEdge(edge) {
      set((x) => ({ edges: [...x.edges, edge] }));
    },
    applyEdgeChanges(changes: EdgeChange[]) {
      set((p) => {
        // Publish events for edge removals
        changes.forEach((change) => {
          if (change.type === 'remove') {
            const edge = p.edges.find((e) => e.id === change.id);
            if (edge) {
              session.pubsub.publish('edge:removed', edge);
            }
          }
        });
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
