import React, { useCallback, useMemo } from 'react';
import { useActiveGraph } from '@/system/provider';
import { useStore } from 'zustand';
import { NodePicker } from '@/components/contextMenus/NodePicker';
import type { ExtendedNodeSpecJSON } from '@/components/contextMenus/NodePicker';
import type { XYPosition } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import {
  removeTabFromLayout,
  addFloatingTab,
  findTabInLayout
} from '@/components/layoutController/utils';

export function NodePickerPanel() {
  const sys = useActiveGraph()!;
  const specJson = useStore(sys.editor.specStore, (x) => x.specs);
  const documentation = useStore(sys.editor.documentationStore, (x) => x.docs);
  const reactflowRef = useStore(sys.refStore, (x) => x.refs.reactflow);
  const screenPosition = useStore(
    sys.refStore,
    (x) => x.refs.nodePickerPosition
  );

  // Convert screen position to flow position
  const flowPosition = useMemo(() => {
    if (reactflowRef && screenPosition && reactflowRef.screenToFlowPosition) {
      return reactflowRef.screenToFlowPosition(screenPosition);
    }
    return { x: 0, y: 0 };
  }, [reactflowRef, screenPosition]);

  // For now, we'll use undefined which means no filtering
  const nodePickFilters = undefined;
  const closeNodePicker = useCallback(() => {
    const currentLayout = sys.editor.tabStore.getState().layout;
    const newLayout = removeTabFromLayout(currentLayout, 'nodepicker');
    sys.editor.tabStore.getState().setLayout(newLayout);
  }, [sys]);

  const handleShowDocumentation = useCallback(
    (nodeType: string) => {
      // Set the selected documentation type
      sys.refStore.getState().setRef('selectedDocumentationType', nodeType);

      // Open documentation browser panel
      const currentLayout = sys.editor.tabStore.getState().layout;

      // Close existing doc browser if open
      const existingPanel = findTabInLayout(currentLayout, 'docbrowser');
      let layoutToUse = currentLayout;
      if (existingPanel) {
        layoutToUse = removeTabFromLayout(currentLayout, 'docbrowser');
      }

      // Create new floating panel
      const tabData = {
        id: 'docbrowser'
      };

      const newLayout = addFloatingTab(layoutToUse, tabData, {
        left: 100,
        top: 100,
        width: 600,
        height: 700
      });

      sys.editor.tabStore.getState().setLayout(newLayout);
    },
    [sys]
  );

  const handleAddNode = useCallback(
    (spec: ExtendedNodeSpecJSON, position: XYPosition) => {
      const newNode = {
        id: uuidv4(),
        type: spec.nodeType ?? 'behaveNode',
        position,
        data: {
          configuration: {},
          type: spec.type,
          ports: {}
        }
      };

      sys.undoManager.execute({
        name: `Add node (${spec.type})`,
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

      closeNodePicker();
    },
    [closeNodePicker, sys]
  );

  return (
    <NodePicker
      position={flowPosition}
      filters={nodePickFilters}
      onPickNode={handleAddNode}
      onClose={closeNodePicker}
      specJSON={specJson}
      documentation={documentation}
      onShowDocumentation={handleShowDocumentation}
    />
  );
}
