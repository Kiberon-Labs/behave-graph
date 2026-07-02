import type { GraphSession } from '@/system/graphSession';
import { Graph } from 'graphlib';
import { create } from 'zustand';
import copyToClipboard from 'copy-to-clipboard';
import type { Edge, Node, XYPosition } from 'reactflow';
import { getNodesBounds } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import { hidden, pinned } from '@/annotations';
import { buildUIGraphJSON } from '@/transformers/Uigraph';
import type { UIGraphJSON } from '../types/graph';
import type { IBehaveNode } from '@/types/nodes';

const FILTERED_CLASS_NAME = 'filtered';

type NodeClipboardPayloadV1 = {
  type: 'behave-graph/flow-nodes';
  v: 1;
  nodes: Node[];
  edges?: Edge[];
};

const NODE_CLIPBOARD_PREFIX = 'behave-graph:nodes:';

let inMemoryClipboard: string | null = null;
let pasteSequence = 0;

const encodeNodeClipboardPayload = (payload: NodeClipboardPayloadV1) =>
  `${NODE_CLIPBOARD_PREFIX}${JSON.stringify(payload)}`;

const decodeNodeClipboardPayload = (
  text: string
): NodeClipboardPayloadV1 | null => {
  try {
    const raw = text.startsWith(NODE_CLIPBOARD_PREFIX)
      ? text.slice(NODE_CLIPBOARD_PREFIX.length)
      : text;
    const parsed = JSON.parse(raw) as Partial<NodeClipboardPayloadV1>;
    if (parsed?.type !== 'behave-graph/flow-nodes') return null;
    if (parsed?.v !== 1) return null;
    if (!Array.isArray(parsed?.nodes)) return null;
    if (parsed?.edges && !Array.isArray(parsed.edges)) return null;
    return parsed as NodeClipboardPayloadV1;
  } catch {
    return null;
  }
};

const deepClone = <T,>(value: T): T => {
  const sc = (globalThis as any).structuredClone as
    | ((value: any) => any)
    | undefined;
  if (typeof sc === 'function') {
    return sc(value) as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

/**
 * Extend or modify this interface to add more actions as needed.
 */
export interface Actions {
  traceUpstream: (nodeId: string) => void;
  traceDownstream: (nodeId: string) => void;
  focusNode: (nodeId: string) => void;
  resetTrace: () => void;
  addBehaveNode: (nodeType: string, position: XYPosition) => void;
  copySelectionToClipboard: () => void;
  pasteFromClipboard: () => Promise<void>;
  toggleNodeHidden: (nodeId: string) => void;
  toggleNodePinned: (nodeId: string) => void;
  groupNodes: () => void;
  ungroupNodes: (groupId: string) => void;
  deleteNodes: (nodeIds: string[]) => void;
  updateGroupColor: (groupId: string, color: string) => void;
  // Triggers the save graph
  save: () => Promise<UIGraphJSON>;
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
const convertToGraph = (sys: GraphSession) => {
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

const applyFilters = (sys: GraphSession, lookup: Record<string, boolean>) => {
  sys.nodeStore.getState().setNodes((nodes) => {
    const newNodes = nodes.map((x) => {
      if (!lookup[x.id]) {
        return {
          ...x,
          className: FILTERED_CLASS_NAME // clsx(x.className ?? '', FILTERED_CLASS_NAME)
        };
      }
      return {
        ...x,
        className: (x.className ?? '')
          .split(' ')
          .filter((c) => c !== FILTERED_CLASS_NAME)
          .join(' ')
      };
    });
    return newNodes;
  });
};

export const actionStoreFactory = (sys: GraphSession) =>
  create<ActionStore>((set, get) => ({
    actions: {
      save: async () => {
        try {
          const uiGraph = buildUIGraphJSON(sys);
          sys.editor.pubsub.publish('graph:saved', uiGraph);
          return uiGraph;
        } catch (err) {
          sys.notifications.error('Failed to save graph');
          throw err;
        }
      },
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
      },
      focusNode: (nodeId: string) => {
        const reactflow = sys.refStore.getState().getRef('reactflow');
        if (!reactflow) {
          return;
        }

        const node = reactflow.getNodes().find((n) => n.id === nodeId);

        if (node) {
          reactflow.fitView({
            padding: 0.2,
            duration: 200,
            includeHiddenNodes: true,
            nodes: [node]
          });
        }
      },
      addBehaveNode: (nodeType: string, position: XYPosition) => {
        const newNode: IBehaveNode = {
          id: uuidv4(),
          type: 'behaveNode',
          position,
          data: {
            configuration: {},
            type: nodeType,
            ports: {},
            dynamicPorts: {}
          }
        };

        sys.undoManager.execute({
          name: `Add node (${nodeType})`,
          execute: () => {
            sys.nodeStore.getState().addNode(newNode);
          },
          undo: () => {
            sys.nodeStore
              .getState()
              .setNodes((existing) =>
                existing.filter((n) => n.id !== newNode.id)
              );
          }
        });
      },
      copySelectionToClipboard: () => {
        const selected = sys.nodeStore
          .getState()
          .nodes.filter((n) => n.selected);

        if (selected.length === 0) return;

        const selectedIds = new Set(selected.map((n) => n.id));
        const selectedEdges = sys.edgeStore
          .getState()
          .edges.filter(
            (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
          );

        pasteSequence = 0;
        const payload: NodeClipboardPayloadV1 = {
          type: 'behave-graph/flow-nodes',
          v: 1,
          nodes: selected,
          edges: selectedEdges
        };

        const encoded = encodeNodeClipboardPayload(payload);
        inMemoryClipboard = encoded;
        copyToClipboard(encoded);
      },
      pasteFromClipboard: async () => {
        let text: string | null = inMemoryClipboard;
        if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
          try {
            text = await navigator.clipboard.readText();
          } catch {
            // ignore and fall back to in-memory clipboard
          }
        }

        if (!text) return;
        const payload = decodeNodeClipboardPayload(text);
        if (!payload) return;

        const sourceNodes = payload.nodes;
        if (!sourceNodes.length) return;

        const sourceEdges = payload.edges ?? [];

        const selectedIds = new Set(sourceNodes.map((n) => n.id));
        const idMap = new Map<string, string>();
        for (const node of sourceNodes) {
          idMap.set(node.id, uuidv4());
        }

        const offset = 20 * (pasteSequence + 1);
        const dx = offset;
        const dy = offset;

        const newNodes: Node[] = sourceNodes.map((n) => {
          const cloned = deepClone(n);
          const newId = idMap.get(cloned.id);
          if (!newId) return cloned;

          const hasValidParent =
            !!cloned.parentId && selectedIds.has(cloned.parentId);

          // If the parent isn't being copied too, detach so it pastes in global space
          if (cloned.parentId && !hasValidParent) {
            const posAbs = cloned.positionAbsolute as
              | { x: number; y: number }
              | undefined;
            if (posAbs) {
              cloned.position = { x: posAbs.x, y: posAbs.y };
            }
            cloned.parentId = undefined;
            cloned.extent = undefined;
          }

          cloned.id = newId;
          cloned.selected = true;

          if (cloned.parentId && hasValidParent) {
            cloned.parentId = idMap.get(cloned.parentId) ?? cloned.parentId;
          }

          cloned.position = {
            x: (cloned.position?.x ?? 0) + dx,
            y: (cloned.position?.y ?? 0) + dy
          };

          const abs = cloned.positionAbsolute as
            | { x: number; y: number }
            | undefined;
          if (abs) {
            cloned.positionAbsolute = { x: abs.x + dx, y: abs.y + dy };
          }

          return cloned;
        });

        const newEdges: Edge[] = sourceEdges
          .filter((e) => idMap.has(e.source) && idMap.has(e.target))
          .map((e) => {
            const cloned = deepClone(e);
            cloned.id = uuidv4();
            cloned.source = idMap.get(e.source) ?? e.source;
            cloned.target = idMap.get(e.target) ?? e.target;
            return cloned;
          });

        const newIds = new Set(newNodes.map((n) => n.id));
        const newEdgeIds = new Set(newEdges.map((e) => e.id));
        const prevSelected: Record<string, boolean> = {};
        for (const node of sys.nodeStore.getState().nodes) {
          prevSelected[node.id] = !!node.selected;
        }

        sys.undoManager.execute({
          name: 'Paste',
          execute: () => {
            sys.nodeStore.getState().setNodes((nodes) => {
              const unselected = nodes.map((n) => ({ ...n, selected: false }));
              return [...unselected, ...newNodes];
            });
            if (newEdges.length) {
              const existingEdges = sys.edgeStore.getState().edges;
              sys.edgeStore
                .getState()
                .setEdges([...existingEdges, ...newEdges]);
            }
          },
          undo: () => {
            sys.nodeStore
              .getState()
              .setNodes((nodes) =>
                nodes
                  .filter((n) => !newIds.has(n.id))
                  .map((n) => ({ ...n, selected: prevSelected[n.id] ?? false }))
              );
            if (newEdgeIds.size) {
              sys.edgeStore
                .getState()
                .setEdges(
                  sys.edgeStore
                    .getState()
                    .edges.filter((e) => !newEdgeIds.has(e.id))
                );
            }
          }
        });

        pasteSequence += 1;
      },
      toggleNodeHidden: (nodeId: string) => {
        const currentNode = sys.nodeStore
          .getState()
          .nodes.find((n) => n.id === nodeId);

        if (!currentNode || !('data' in currentNode)) return;

        const currentHiddenState =
          currentNode.data.annotations?.[hidden] ?? false;
        const newHiddenState = !currentHiddenState;

        sys.undoManager.execute({
          name: newHiddenState ? 'Hide node' : 'Show node',
          execute: () => {
            sys.nodeStore.getState().setNodes((nodes) =>
              nodes.map((node) =>
                node.id === nodeId && 'data' in node
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        annotations: {
                          ...node.data.annotations,
                          [hidden]: newHiddenState
                        }
                      }
                    }
                  : node
              )
            );
          },
          undo: () => {
            sys.nodeStore.getState().setNodes((nodes) =>
              nodes.map((node) =>
                node.id === nodeId && 'data' in node
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        annotations: {
                          ...node.data.annotations,
                          [hidden]: currentHiddenState
                        }
                      }
                    }
                  : node
              )
            );
          }
        });
      },
      toggleNodePinned: (nodeId: string) => {
        const currentNode = sys.nodeStore
          .getState()
          .nodes.find((n) => n.id === nodeId);

        if (!currentNode || !('data' in currentNode)) return;

        const currentPinnedState =
          currentNode.data.annotations?.[pinned] ?? false;
        const newPinnedState = !currentPinnedState;

        sys.undoManager.execute({
          name: newPinnedState ? 'Pin node' : 'Unpin node',
          execute: () => {
            sys.nodeStore.getState().setNodes((nodes) =>
              nodes.map((node) =>
                node.id === nodeId && 'data' in node
                  ? {
                      ...node,
                      draggable: !newPinnedState,
                      data: {
                        ...node.data,
                        annotations: {
                          ...node.data.annotations,
                          [pinned]: newPinnedState
                        }
                      }
                    }
                  : node
              )
            );
          },
          undo: () => {
            sys.nodeStore.getState().setNodes((nodes) =>
              nodes.map((node) =>
                node.id === nodeId && 'data' in node
                  ? {
                      ...node,
                      draggable: currentPinnedState,
                      data: {
                        ...node.data,
                        annotations: {
                          ...node.data.annotations,
                          [pinned]: currentPinnedState
                        }
                      }
                    }
                  : node
              )
            );
          }
        });
      },
      groupNodes: () => {
        const nodes = sys.nodeStore.getState().nodes;
        // Only group nodes that don't already have a parent
        const selectedNodes = nodes.filter((n) => n.selected && !n.parentId);

        if (selectedNodes.length === 0) return;

        // Calculate bounds of selected nodes
        const rect = getNodesBounds(selectedNodes);
        const groupId = uuidv4();

        const padding = 25;
        const groupNode: Node = {
          id: groupId,
          type: 'group',
          position: { x: rect.x - padding, y: rect.y - padding },
          data: { color: '#6366f1' },
          style: {
            width: rect.width + padding * 2,
            height: rect.height + padding * 2
          },
          selected: false,
          draggable: true
        };

        // Store original state for undo
        const originalNodes = selectedNodes.map((n) => ({
          id: n.id,
          parentId: n.parentId,
          position: { ...n.position },
          extent: n.extent
        }));

        sys.undoManager.execute({
          name: 'Group nodes',
          execute: () => {
            sys.nodeStore.getState().setNodes((nodes) => {
              const updatedNodes = nodes.map((node) => {
                const selectedNode = selectedNodes.find(
                  (sn) => sn.id === node.id
                );
                if (!selectedNode) return node;

                return {
                  ...node,
                  parentId: groupId,
                  position: {
                    x: node.position.x - rect.x + padding,
                    y: node.position.y - rect.y + padding
                  },
                  extent: 'parent' as const
                };
              });

              // Add group node at the head of the array
              return [groupNode, ...updatedNodes];
            });
          },
          undo: () => {
            sys.nodeStore.getState().setNodes((nodes) => {
              // Remove the group node and restore original state
              const filteredNodes = nodes.filter((n) => n.id !== groupId);
              return filteredNodes.map((node) => {
                const original = originalNodes.find((on) => on.id === node.id);
                if (!original) return node;

                return {
                  ...node,
                  parentId: original.parentId,
                  position: original.position,
                  extent: original.extent
                };
              });
            });
          }
        });
      },
      ungroupNodes: (groupId: string) => {
        const nodes = sys.nodeStore.getState().nodes;
        const childNodes = nodes.filter((n) => n.parentId === groupId);

        if (childNodes.length === 0) return;

        const groupNode = nodes.find((n) => n.id === groupId);
        if (!groupNode) return;

        // Store original state for undo
        const originalChildNodes = childNodes.map((n) => ({
          id: n.id,
          parentId: n.parentId,
          position: { ...n.position },
          extent: n.extent
        }));

        sys.undoManager.execute({
          name: 'Ungroup nodes',
          execute: () => {
            sys.nodeStore.getState().setNodes((nodes) => {
              return nodes
                .filter((n) => n.id !== groupId)
                .map((node) => {
                  const childNode = childNodes.find((cn) => cn.id === node.id);
                  if (!childNode) return node;

                  const posAbs = node.positionAbsolute || node.position;
                  return {
                    ...node,
                    parentId: undefined,
                    position: {
                      x: posAbs.x,
                      y: posAbs.y
                    },
                    extent: undefined
                  };
                });
            });
          },
          undo: () => {
            sys.nodeStore.getState().setNodes((nodes) => {
              const restoredNodes = nodes.map((node) => {
                const original = originalChildNodes.find(
                  (on) => on.id === node.id
                );
                if (!original) return node;

                return {
                  ...node,
                  parentId: original.parentId,
                  position: original.position,
                  extent: original.extent
                };
              });

              // Add back the group node at the head
              return [groupNode, ...restoredNodes];
            });
          }
        });
      },
      deleteNodes: (nodeIds: string[]) => {
        const nodes = sys.nodeStore.getState().nodes;
        const edges = sys.edgeStore.getState().edges;

        // Get edges connected to these nodes
        const edgesToDelete = edges.filter(
          (e) => nodeIds.includes(e.source) || nodeIds.includes(e.target)
        );

        sys.undoManager.execute({
          name:
            nodeIds.length === 1
              ? 'Delete node'
              : `Delete ${nodeIds.length} nodes`,
          execute: () => {
            sys.edgeStore
              .getState()
              .setEdges(
                edges.filter((e) => !edgesToDelete.some((ed) => ed.id === e.id))
              );
            sys.nodeStore
              .getState()
              .setNodes(nodes.filter((n) => !nodeIds.includes(n.id)));
          },
          undo: () => {
            sys.nodeStore.getState().setNodes([...nodes]);
            sys.edgeStore.getState().setEdges([...edges]);
          }
        });
      },
      updateGroupColor: (groupId: string, color: string) => {
        const nodes = sys.nodeStore.getState().nodes;
        const groupNode = nodes.find((n) => n.id === groupId);

        if (!groupNode) return;

        const oldColor = groupNode.data?.color || '#6366f1';

        sys.undoManager.execute({
          name: 'Change group color',
          execute: () => {
            sys.nodeStore
              .getState()
              .setNodes(
                nodes.map((n) =>
                  n.id === groupId ? { ...n, data: { ...n.data, color } } : n
                )
              );
          },
          undo: () => {
            sys.nodeStore
              .getState()
              .setNodes(
                sys.nodeStore
                  .getState()
                  .nodes.map((n) =>
                    n.id === groupId
                      ? { ...n, data: { ...n.data, color: oldColor } }
                      : n
                  )
              );
          }
        });
      }
    },
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
