import { BasePanel } from '@/components/panels/base';
import { layerId } from '@/annotations';
import { useSystem } from '@/system/provider';
import { VscodeButton, VscodeDivider } from '@vscode-elements/react-elements';
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import styles from './styles.module.css';

type NodeWithAnnotations = {
  id: string;
  selected?: boolean;
  data?: {
    annotations?: Record<string, unknown>;
  };
};

const getAnnotatedLayerId = (node: NodeWithAnnotations): string | undefined => {
  const value = node.data?.annotations?.[layerId];
  return typeof value === 'string' ? value : undefined;
};

const clampOpacityFromPercent = (percent: number): number => {
  if (Number.isNaN(percent)) return 1;
  return Math.max(0, Math.min(100, percent)) / 100;
};

export function LayersPanel() {
  const system = useSystem();

  const layers = useStore(system.layerStore, (state) => state.layers);
  const nodeLayers = useStore(system.layerStore, (state) => state.nodeLayers);
  const defaultLayerId = useStore(
    system.layerStore,
    (state) => state.defaultLayerId
  );

  const nodes = useStore(system.nodeStore, (state) => state.nodes);

  const [newLayerName, setNewLayerName] = useState('');

  const selectedNodeIds = useMemo(() => {
    return nodes.filter((node) => node.selected).map((node) => node.id);
  }, [nodes]);

  const layerRows = useMemo(() => {
    const entries = Object.values(layers);
    return entries.sort((a, b) => {
      if (a.id === defaultLayerId) return -1;
      if (b.id === defaultLayerId) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [defaultLayerId, layers]);

  const selectedLayerId = useMemo(() => {
    if (selectedNodeIds.length === 0) return undefined;

    const effectiveLayerIds = selectedNodeIds.map((nodeId) => {
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return defaultLayerId;
      return (
        nodeLayers[nodeId] ??
        getAnnotatedLayerId(node as NodeWithAnnotations) ??
        defaultLayerId
      );
    });

    const first = effectiveLayerIds[0];
    const sameLayer = effectiveLayerIds.every((id) => id === first);
    return sameLayer ? first : undefined;
  }, [defaultLayerId, nodeLayers, nodes, selectedNodeIds]);

  const updateNodeAnnotationsForLayer = (
    nodeIds: string[],
    nextLayerId: string
  ): void => {
    system.nodeStore.getState().setNodes((existing) =>
      existing.map((node) => {
        if (!nodeIds.includes(node.id)) return node;

        const dataRecord =
          node.data && typeof node.data === 'object'
            ? (node.data as Record<string, unknown>)
            : {};

        const annotationsRecord =
          dataRecord.annotations && typeof dataRecord.annotations === 'object'
            ? (dataRecord.annotations as Record<string, unknown>)
            : {};

        return {
          ...node,
          data: {
            ...dataRecord,
            annotations: {
              ...annotationsRecord,
              [layerId]: nextLayerId
            }
          }
        };
      })
    );
  };

  const handleCreateLayer = (): void => {
    const nextName = newLayerName.trim();
    if (!nextName) return;

    system.layerStore.getState().createLayer(nextName);
    setNewLayerName('');
  };

  const handleAssignSelected = (targetLayerId: string): void => {
    if (selectedNodeIds.length === 0) return;

    selectedNodeIds.forEach((nodeId) => {
      system.layerStore.getState().setNodeLayer(nodeId, targetLayerId);
    });
    updateNodeAnnotationsForLayer(selectedNodeIds, targetLayerId);
  };

  const handleRemoveLayer = (targetLayerId: string): void => {
    if (targetLayerId === defaultLayerId) return;

    const affectedNodeIds = Object.entries(nodeLayers)
      .filter(([, mappedLayerId]) => mappedLayerId === targetLayerId)
      .map(([nodeId]) => nodeId);

    system.layerStore.getState().removeLayer(targetLayerId);

    if (affectedNodeIds.length > 0) {
      updateNodeAnnotationsForLayer(affectedNodeIds, defaultLayerId);
    }
  };

  return (
    <BasePanel>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>Layers</span>
          <span className={styles.subtitle}>
            {selectedNodeIds.length} selected node
            {selectedNodeIds.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className={styles.addRow}>
          <input
            className={styles.nameInput}
            value={newLayerName}
            onChange={(event) => setNewLayerName(event.target.value)}
            placeholder="New layer name"
          />
          <VscodeButton onClick={handleCreateLayer}>Add Layer</VscodeButton>
        </div>

        <VscodeDivider />

        <div className={styles.list}>
          {layerRows.map((layer) => {
            const isDefault = layer.id === defaultLayerId;
            const isSelectedLayer = selectedLayerId === layer.id;

            return (
              <div className={styles.row} key={layer.id}>
                <div className={styles.rowTop}>
                  <input
                    className={styles.layerName}
                    value={layer.name}
                    onChange={(event) =>
                      system.layerStore
                        .getState()
                        .renameLayer(layer.id, event.target.value)
                    }
                    aria-label={`Layer name ${layer.name}`}
                  />
                  {isDefault && <span className={styles.badge}>default</span>}
                  {isSelectedLayer && (
                    <span className={styles.badge}>selected</span>
                  )}
                </div>

                <div className={styles.controls}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={layer.visible}
                      onChange={(event) =>
                        system.layerStore
                          .getState()
                          .setLayerVisibility(layer.id, event.target.checked)
                      }
                    />
                    Visible
                  </label>

                  <label className={styles.opacityLabel}>
                    Opacity
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(layer.opacity * 100)}
                      onChange={(event) =>
                        system.layerStore
                          .getState()
                          .setLayerOpacity(
                            layer.id,
                            clampOpacityFromPercent(
                              Number.parseInt(event.target.value, 10)
                            )
                          )
                      }
                    />
                    <span>{Math.round(layer.opacity * 100)}%</span>
                  </label>
                </div>

                <div className={styles.actions}>
                  <VscodeButton
                    onClick={() => handleAssignSelected(layer.id)}
                    disabled={selectedNodeIds.length === 0}
                  >
                    Assign Selected
                  </VscodeButton>
                  <VscodeButton
                    secondary
                    disabled={isDefault}
                    onClick={() => handleRemoveLayer(layer.id)}
                  >
                    Delete
                  </VscodeButton>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </BasePanel>
  );
}
