import type { GraphJSON, IRegistry } from '@kiberon-labs/behave-graph';
import React from 'react';
import { Background, BackgroundVariant, MiniMap, ReactFlow } from 'reactflow';

import { useBehaveGraphFlow } from '../hooks/useBehaveGraphFlow.js';
import { useFlowHandlers } from '../hooks/useFlowHandlers.js';
import { useGraphRunner } from '../hooks/useGraphRunner.js';
import { useNodeSpecJson } from '../hooks/useNodeSpecJson.js';
import CustomControls from './Controls.js';
import { type Examples } from './modals/LoadModal.js';
import { NodePicker } from './NodePicker.js';
import { useSystem } from '@/system/provider.js';

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
  const showGrid = system.useSystemSettings(x => x.showGrid);
  const showMinimap = system.useSystemSettings(x => x.showMinimap);
  const snapGrid = system.useSystemSettings(x => x.snapGrid);



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

  return (
    <ReactFlow
      nodeTypes={nodeTypes}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      // @ts-ignore
      onConnectStart={handleStartConnect}
      // @ts-ignore
      onConnectEnd={handleStopConnect}
      snapToGrid={snapGrid}
      fitView
      fitViewOptions={{ maxZoom: 1 }}
      onPaneClick={handlePaneClick}
      onPaneContextMenu={handlePaneContextMenu}
    >
      <CustomControls
        playing={playing}
        togglePlay={togglePlay}
        setBehaviorGraph={setGraphJson}
        examples={examples}
        specJson={specJson}
      />
      {showGrid && <Background
        variant={BackgroundVariant.Lines}
        color="#373737"
        style={{ backgroundColor: 'var(--colors-bgCanvas)' }}
      />}
      {showMinimap && <MiniMap />}
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
