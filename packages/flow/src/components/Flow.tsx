import type { GraphJSON, IRegistry } from '@kinforge/behave-graph';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  type ReactFlowInstance
} from 'reactflow';

import { useBehaveGraphFlow } from '../hooks/useBehaveGraphFlow.js';
import { useFlowHandlers } from '../hooks/useFlowHandlers.js';
import { useGraphRunner } from '../hooks/useGraphRunner.js';
import { useNodeSpecJson } from '../hooks/useNodeSpecJson.js';
import CustomControls from './Controls.js';
import { type Examples } from './modals/LoadModal.js';
import { NodePicker } from './contextMenus/NodePicker.js';
import { useSystem } from '@/system/provider.js';
import { useStore } from 'zustand';
import {
  NodeContextMenu,
  type INodeContextMenuProps
} from './contextMenus/node.js';

type FlowProps = {
  initialGraph: GraphJSON;
  registry: IRegistry;
  examples: Examples;
};

export const Flow: React.FC<FlowProps> = ({
  initialGraph: graph,
  registry,
  examples
}) => {
  const system = useSystem();
  const specJson = useNodeSpecJson(registry);
  const showGrid = useStore(system.systemSettings, (x) => x.showGrid);
  const showMinimap = useStore(system.systemSettings, (x) => x.showMinimap);
  const snapGrid = useStore(system.systemSettings, (x) => x.snapGrid);
  const edgeTypes = useStore(system.flowStore, (x) => x.edgeTypes);

  const ref = useRef<HTMLDivElement>(null);
  const setRef = useStore(system.refStore, (x) => x.setRef);

  // Set reactflow ref
  const setReactflowRef = React.useCallback(
    (reactFlowInstance: ReactFlowInstance) => {
      if (reactFlowInstance) {
        setRef('reactflow', reactFlowInstance);
      }
    },
    [setRef]
  );

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    graphJson,
    setGraphJson,
    nodeTypes
  } = useBehaveGraphFlow({
    initialGraphJson: graph,
    specJson
  });

  const {
    onConnect,
    handleStartConnect,
    handleStopConnect,
    handlePaneClick,
    handlePaneContextMenu,
    nodePickerVisibility,
    handleAddNode,
    closeNodePicker,
    nodePickFilters
  } = useFlowHandlers({
    nodes,
    onEdgesChange,
    onNodesChange,
    specJSON: specJson
  });

  const { togglePlay, playing } = useGraphRunner({
    graphJson,
    registry
  });

  // Track node selection
  useEffect(() => {
    const selectedNode = nodes.find((n) => n.selected);
    system.selectionStore
      .getState()
      .setSelectedNodeId(selectedNode?.id ?? null);
  }, [nodes, system.selectionStore]);

  const [menu, setMenu] = useState<INodeContextMenuProps | null>(null);
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent<Element, MouseEvent>) => {
      // Prevent native context menu from showing
      event.preventDefault();
      const offset = ref.current?.getBoundingClientRect();
      //Keep ascending till we find the .react-flow__node
      let target = event.target as HTMLElement | null;
      let nodeID = null;
      while (target && !target.classList.contains('react-flow__node')) {
        target = target.parentElement;
      }
      if (target) {
        nodeID = target.getAttribute('data-id');
      }
      setMenu({
        //We should be safe here as reactflow only triggers this on nodes
        nodeID: nodeID!,
        top: event.clientY - (offset?.top ?? 0),
        left: event.clientX - (offset?.left ?? 0)
      });
    },
    [setMenu]
  );

  const onPaneClick = useCallback(() => {
    setMenu(null);
    handlePaneClick();
  }, [setMenu, handlePaneClick]);

  return (
    <ReactFlow
      ref={ref}
      onInit={setReactflowRef}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      elevateEdgesOnSelect={true}
      nodes={nodes}
      edges={edges}
      onNodeContextMenu={onNodeContextMenu}
      maxZoom={Infinity}
      minZoom={-Infinity}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      // @ts-ignore
      onConnectStart={handleStartConnect}
      // @ts-ignore
      onConnectEnd={handleStopConnect}
      snapToGrid={snapGrid}
      fitView
      //TODO. Reconsier this prop for performance
      onlyRenderVisibleElements={true}
      onPaneClick={onPaneClick}
      onPaneContextMenu={handlePaneContextMenu}
    >
      <CustomControls
        playing={playing}
        togglePlay={togglePlay}
        setBehaviorGraph={setGraphJson}
        examples={examples}
        specJson={specJson}
      />
      {showGrid && (
        <Background
          variant={BackgroundVariant.Lines}
          color="#373737"
          style={{ backgroundColor: 'var(--colors-bgCanvas)' }}
        />
      )}
      {showMinimap && <MiniMap />}
      {menu && <NodeContextMenu {...menu} />}
      {nodePickerVisibility && (
        <NodePicker
          position={nodePickerVisibility}
          filters={nodePickFilters}
          onPickNode={handleAddNode}
          onClose={closeNodePicker}
          specJSON={specJson}
        />
      )}
    </ReactFlow>
  );
};
