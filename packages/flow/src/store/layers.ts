import type { GraphSession } from '@/system/graphSession';
import { create } from 'zustand';

const DEFAULT_LAYER_ID = 'default';
const DEFAULT_LAYER_NAME = 'Default';

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
};

export type SerializedLayers = {
  defaultLayerId: string;
  layers: Layer[];
  nodeLayers: Record<string, string>;
};

export type LayerStore = {
  defaultLayerId: string;
  layers: Record<string, Layer>;
  nodeLayers: Record<string, string>;
  createLayer: (name: string) => string;
  renameLayer: (layerId: string, name: string) => void;
  setLayerVisibility: (layerId: string, visible: boolean) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  removeLayer: (layerId: string) => void;
  setNodeLayer: (nodeId: string, layerId: string) => void;
  clearNodeLayer: (nodeId: string) => void;
  getNodeLayer: (nodeId: string) => Layer;
  serialize: () => SerializedLayers;
  deserialize: (serialized?: SerializedLayers) => void;
  pruneNodeAssignments: (nodeIds: string[]) => void;
};

const clampOpacity = (opacity: number): number => {
  if (Number.isNaN(opacity)) return 1;
  return Math.max(0, Math.min(1, opacity));
};

const createDefaultLayer = (): Layer => ({
  id: DEFAULT_LAYER_ID,
  name: DEFAULT_LAYER_NAME,
  visible: true,
  opacity: 1
});

const createLayerId = (): string => {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `layer-${Date.now()}-${suffix}`;
};

export const layerStoreFactory = (session: GraphSession) => {
  const store = create<LayerStore>((set, get) => ({
    defaultLayerId: DEFAULT_LAYER_ID,
    layers: {
      [DEFAULT_LAYER_ID]: createDefaultLayer()
    },
    nodeLayers: {},

    createLayer: (name) => {
      const normalized = name.trim() || 'Layer';
      const id = createLayerId();
      set((state) => ({
        layers: {
          ...state.layers,
          [id]: {
            id,
            name: normalized,
            visible: true,
            opacity: 1
          }
        }
      }));
      return id;
    },

    renameLayer: (layerId, name) => {
      const normalized = name.trim();
      if (!normalized) return;
      set((state) => {
        const existing = state.layers[layerId];
        if (!existing) return state;
        return {
          layers: {
            ...state.layers,
            [layerId]: {
              ...existing,
              name: normalized
            }
          }
        };
      });
    },

    setLayerVisibility: (layerId, visible) => {
      set((state) => {
        const existing = state.layers[layerId];
        if (!existing) return state;
        return {
          layers: {
            ...state.layers,
            [layerId]: {
              ...existing,
              visible
            }
          }
        };
      });
    },

    setLayerOpacity: (layerId, opacity) => {
      const safeOpacity = clampOpacity(opacity);
      set((state) => {
        const existing = state.layers[layerId];
        if (!existing) return state;
        return {
          layers: {
            ...state.layers,
            [layerId]: {
              ...existing,
              opacity: safeOpacity
            }
          }
        };
      });
    },

    removeLayer: (layerId) => {
      set((state) => {
        if (layerId === state.defaultLayerId) return state;
        if (!state.layers[layerId]) return state;

        const nextLayers = { ...state.layers };
        delete nextLayers[layerId];

        const nextNodeLayers: Record<string, string> = {};
        Object.entries(state.nodeLayers).forEach(([nodeId, mappedLayerId]) => {
          nextNodeLayers[nodeId] =
            mappedLayerId === layerId ? state.defaultLayerId : mappedLayerId;
        });

        return {
          layers: nextLayers,
          nodeLayers: nextNodeLayers
        };
      });
    },

    setNodeLayer: (nodeId, layerId) => {
      set((state) => {
        const resolvedLayerId = state.layers[layerId]
          ? layerId
          : state.defaultLayerId;

        return {
          nodeLayers: {
            ...state.nodeLayers,
            [nodeId]: resolvedLayerId
          }
        };
      });
    },

    clearNodeLayer: (nodeId) => {
      set((state) => {
        const next = { ...state.nodeLayers };
        delete next[nodeId];
        return {
          nodeLayers: next
        };
      });
    },

    getNodeLayer: (nodeId) => {
      const state = get();
      const mappedLayerId = state.nodeLayers[nodeId] ?? state.defaultLayerId;
      return state.layers[mappedLayerId] ?? state.layers[state.defaultLayerId]!;
    },

    serialize: () => {
      const state = get();
      return {
        defaultLayerId: state.defaultLayerId,
        layers: Object.values(state.layers),
        nodeLayers: { ...state.nodeLayers }
      };
    },

    deserialize: (serialized) => {
      const baseDefaultLayer = createDefaultLayer();
      if (!serialized) {
        set({
          defaultLayerId: DEFAULT_LAYER_ID,
          layers: { [DEFAULT_LAYER_ID]: baseDefaultLayer },
          nodeLayers: {}
        });
        return;
      }

      const requestedDefault = serialized.defaultLayerId || DEFAULT_LAYER_ID;
      const nextLayers: Record<string, Layer> = {
        [DEFAULT_LAYER_ID]: baseDefaultLayer
      };

      for (const candidate of serialized.layers ?? []) {
        if (!candidate?.id) continue;
        nextLayers[candidate.id] = {
          id: candidate.id,
          name: candidate.name?.trim() || candidate.id,
          visible: candidate.visible !== false,
          opacity: clampOpacity(candidate.opacity)
        };
      }

      const defaultLayerId = nextLayers[requestedDefault]
        ? requestedDefault
        : DEFAULT_LAYER_ID;

      const nextNodeLayers: Record<string, string> = {};
      Object.entries(serialized.nodeLayers ?? {}).forEach(
        ([nodeId, mapped]) => {
          nextNodeLayers[nodeId] = nextLayers[mapped] ? mapped : defaultLayerId;
        }
      );

      set({
        defaultLayerId,
        layers: nextLayers,
        nodeLayers: nextNodeLayers
      });
    },

    pruneNodeAssignments: (nodeIds) => {
      const valid = new Set(nodeIds);
      set((state) => {
        const nextNodeLayers: Record<string, string> = {};
        Object.entries(state.nodeLayers).forEach(([nodeId, mapped]) => {
          if (!valid.has(nodeId)) return;
          nextNodeLayers[nodeId] = state.layers[mapped]
            ? mapped
            : state.defaultLayerId;
        });

        return {
          nodeLayers: nextNodeLayers
        };
      });
    }
  }));

  session.nodeStore.subscribe((nodeState) => {
    const nodeIds = nodeState.nodes.map((node) => node.id);
    store.getState().pruneNodeAssignments(nodeIds);
  });

  return store;
};
